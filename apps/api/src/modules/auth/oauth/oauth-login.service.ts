import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isNotificationLocale, type Role } from '@briefluence/shared';
import type { User } from '@prisma/client';
import { AppError, notFound } from '../../../common/app-error';
import { Clock } from '../../../common/clock';
import { CryptoService } from '../../../common/crypto.service';
import { PrismaService } from '../../../common/prisma.service';
import { ENV } from '../../../config/config.module';
import type { Env } from '../../../config/env';
import { AuthService, type Session } from '../auth.service';
import {
  configuredProviders,
  LOGIN_PROVIDERS,
  type LoginProvider,
  type LoginProviderImpl,
  type OAuthProfile,
} from './providers';

type SignupRole = Extract<Role, 'INFLUENCER' | 'BRAND'>;

interface StateToken {
  purpose: 'oauth-login';
  provider: LoginProvider;
  nonce: string;
  role?: SignupRole;
  next?: string;
}

/** Signed hand-off for a new person who still has to choose a role and accept the terms. */
interface CompleteToken {
  purpose: 'oauth-complete';
  provider: LoginProvider;
  profile: OAuthProfile;
}

export type CallbackResult =
  { kind: 'session'; session: Session; next: string | null } | { kind: 'complete'; token: string };

const safeNext = (v: unknown) =>
  typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : undefined;

/**
 * "Continue with Google / Apple". Existing identity → sign in; existing account with the same
 * verified email → link and sign in; otherwise create the account (role from the sign-up page, or
 * chosen on /signup/complete together with accepting the terms).
 */
@Injectable()
export class OAuthLoginService {
  private readonly logger = new Logger(OAuthLoginService.name);
  private readonly providers: Partial<Record<LoginProvider, LoginProviderImpl>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.providers = configuredProviders(env);
    this.logger.log(
      `Sign-in providers: ${LOGIN_PROVIDERS.map((p) => `${p}=${!this.providers[p] ? 'off' : env.OAUTH_LOGIN_MOCK.includes(p) ? 'mock' : 'on'}`).join(', ')}`,
    );
  }

  available(): LoginProvider[] {
    return LOGIN_PROVIDERS.filter((p) => this.providers[p]);
  }

  private provider(raw: string): [LoginProvider, LoginProviderImpl] {
    const p = raw.toLowerCase() as LoginProvider;
    const impl = this.providers[p];
    if (!impl) throw notFound('Sign-in provider');
    return [p, impl];
  }

  redirectUri(provider: LoginProvider) {
    return `${this.env.WEB_URL}/api/v1/auth/oauth/${provider}/callback`;
  }

  async start(
    raw: string,
    role?: string,
    next?: string,
  ): Promise<{ url: string; nonce: string; provider: LoginProvider }> {
    const [provider, impl] = this.provider(raw);
    const nonce = CryptoService.randomToken(16);
    const state: StateToken = {
      purpose: 'oauth-login',
      provider,
      nonce,
      role: role === 'BRAND' || role === 'INFLUENCER' ? role : undefined,
      next: safeNext(next),
    };
    const token = await this.jwt.signAsync(state, {
      secret: this.env.JWT_EMAIL_SECRET,
      expiresIn: '15m',
    });
    return { url: impl.authorizeUrl(token, this.redirectUri(provider)), nonce, provider };
  }

  async callback(
    raw: string,
    code: string,
    state: string,
    cookieNonce: string | undefined,
    extra: Record<string, string | undefined>,
    locale: string | undefined,
  ): Promise<CallbackResult> {
    const [provider, impl] = this.provider(raw);
    let s: StateToken;
    try {
      s = await this.jwt.verifyAsync<StateToken>(state, { secret: this.env.JWT_EMAIL_SECRET });
    } catch {
      throw new AppError('INVALID_TOKEN', 'Sign-in link expired');
    }
    // The nonce cookie ties the callback to the browser that started the sign-in (login CSRF).
    if (
      s.purpose !== 'oauth-login' ||
      s.provider !== provider ||
      !cookieNonce ||
      cookieNonce !== s.nonce
    ) {
      throw new AppError('INVALID_TOKEN', 'Sign-in could not be verified');
    }
    const profile = await impl.exchange(code, this.redirectUri(provider), extra);

    const user = await this.findOrLink(provider, profile);
    if (user)
      return { kind: 'session', session: await this.sessionFor(user), next: s.next ?? null };

    if (s.role) {
      const created = await this.createUser(provider, profile, s.role, locale);
      return { kind: 'session', session: await this.sessionFor(created), next: s.next ?? null };
    }
    const token = await this.jwt.signAsync(
      { purpose: 'oauth-complete', provider, profile } satisfies CompleteToken,
      {
        secret: this.env.JWT_EMAIL_SECRET,
        expiresIn: '30m',
      },
    );
    return { kind: 'complete', token };
  }

  /** New social sign-up: the person chose a role and accepted the terms. */
  async complete(token: string, role: SignupRole, locale: string | undefined): Promise<Session> {
    let t: CompleteToken;
    try {
      t = await this.jwt.verifyAsync<CompleteToken>(token, { secret: this.env.JWT_EMAIL_SECRET });
      if (t.purpose !== 'oauth-complete') throw new Error('wrong purpose');
    } catch {
      throw new AppError('INVALID_TOKEN', 'This sign-up link expired. Try again.');
    }
    const existing = await this.findOrLink(t.provider, t.profile);
    if (existing) return this.sessionFor(existing);
    return this.sessionFor(await this.createUser(t.provider, t.profile, role, locale));
  }

  private async findOrLink(provider: LoginProvider, p: OAuthProfile): Promise<User | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider, subject: p.subject } },
      include: { user: true },
    });
    if (identity) return identity.user;
    // Link to an existing account only when the provider vouches for the email.
    if (p.email && p.emailVerified) {
      const user = await this.prisma.user.findUnique({ where: { email: p.email } });
      if (user) {
        await this.prisma.authIdentity.create({
          data: { userId: user.id, provider, subject: p.subject, email: p.email },
        });
        if (!user.emailVerifiedAt) {
          return this.prisma.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: this.clock.now() },
          });
        }
        return user;
      }
    }
    return null;
  }

  private async createUser(
    provider: LoginProvider,
    p: OAuthProfile,
    role: SignupRole,
    locale: string | undefined,
  ) {
    if (!p.email)
      throw new AppError('VALIDATION_FAILED', 'The provider did not share an email address');
    return this.prisma.user.create({
      data: {
        email: p.email,
        passwordHash: null,
        role,
        emailVerifiedAt: p.emailVerified ? this.clock.now() : null,
        locale: isNotificationLocale(locale) ? locale : 'en',
        identities: { create: { provider, subject: p.subject, email: p.email } },
      },
    });
  }

  private async sessionFor(user: User): Promise<Session> {
    if (user.blockedAt) throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked');
    if (!user.emailVerifiedAt) await this.auth.sendVerification(user);
    return this.auth.createSession(user);
  }
}
