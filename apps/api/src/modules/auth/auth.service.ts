import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  hasAccess,
  trialDaysLeft,
  type ChangePasswordInput,
  type LoginInput,
  type NotificationSettingsInput,
  type ResetPasswordInput,
  type SignupInput,
} from '@briefluence/shared';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { isNotificationLocale, type NotificationLocale } from '@briefluence/shared';
import { AppError } from '../../common/app-error';
import type { AccessTokenPayload } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { EmailService } from '../notifications/email.service';
import { renderResetPasswordEmail, renderVerifyEmail } from '../notifications/emails/templates';

const localeOf = (v: string | null | undefined): NotificationLocale => (isNotificationLocale(v) ? v : 'en');

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: Pick<User, 'id' | 'role'>;
}

type EmailTokenPayload =
  | { sub: string; purpose: 'verify'; email: string }
  | { sub: string; purpose: 'reset'; pwv: string };

// argon2id with OWASP-recommended parameters.
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  hashPassword(password: string) {
    return argon2.hash(password, ARGON_OPTS);
  }

  async signup(input: SignupInput, locale?: string): Promise<Session> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists');
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await this.hashPassword(input.password),
        role: input.role,
        locale: isNotificationLocale(locale) ? locale : 'en',
      },
    });
    await this.sendVerification(user);
    return this.createSession(user);
  }

  async login(input: LoginInput, locale?: string): Promise<Session> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      // Spend comparable time so response timing does not reveal which emails exist.
      this.dummyHash ??= this.hashPassword('dummy-password-1');
      await argon2.verify(await this.dummyHash, input.password).catch(() => false);
      throw new AppError('INVALID_CREDENTIALS', 'Wrong email or password');
    }
    const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Wrong email or password');
    if (user.blockedAt) throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked');
    // Remember the language the user is browsing in, for emails and notifications.
    if (isNotificationLocale(locale) && locale !== user.locale) {
      await this.prisma.user.update({ where: { id: user.id }, data: { locale } });
    }
    return this.createSession(user);
  }

  /** Rotates the refresh token. Reusing an already-rotated token revokes the whole login family. */
  async refresh(rawToken: string | undefined): Promise<Session> {
    if (!rawToken) throw new AppError('UNAUTHORIZED', 'No session');
    const now = this.clock.now();
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: CryptoService.sha256(rawToken) },
      include: { user: true },
    });
    if (!row) throw new AppError('UNAUTHORIZED', 'Invalid session');
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new AppError('UNAUTHORIZED', 'Session was revoked');
    }
    if (row.expiresAt <= now) throw new AppError('UNAUTHORIZED', 'Session expired');
    if (row.user.blockedAt) throw new AppError('ACCOUNT_BLOCKED', 'This account has been blocked');

    // Conditional update guards against two parallel refreshes both succeeding.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) throw new AppError('UNAUTHORIZED', 'Session was revoked');
    return this.createSession(row.user, row.familyId);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: CryptoService.sha256(rawToken) } });
    if (row) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
    }
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: this.clock.now() } });
  }

  async createSession(user: Pick<User, 'id' | 'role' | 'emailVerifiedAt'>, familyId?: string): Promise<Session> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, ev: !!user.emailVerifiedAt };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS });
    const refreshToken = CryptoService.randomToken();
    const refreshExpiresAt = new Date(this.clock.now().getTime() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: CryptoService.sha256(refreshToken),
        familyId: familyId ?? CryptoService.randomToken(16),
        expiresAt: refreshExpiresAt,
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt, user: { id: user.id, role: user.role } };
  }

  // ─── Email verification ──────────────────────────────────

  async sendVerification(user: Pick<User, 'id' | 'email' | 'emailVerifiedAt' | 'locale'>) {
    if (user.emailVerifiedAt) return;
    const token = await this.signEmailToken({ sub: user.id, purpose: 'verify', email: user.email }, '48h');
    const email = await renderVerifyEmail(`${this.env.WEB_URL}/verify-email?token=${encodeURIComponent(token)}`, localeOf(user.locale));
    await this.email.send(user.email, email);
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<User> {
    const p = await this.readEmailToken(token, 'verify');
    const user = await this.prisma.user.findUnique({ where: { id: p.sub } });
    // Token is bound to the address it was sent to.
    if (!user || user.email !== p.email) throw new AppError('INVALID_TOKEN', 'This link is invalid');
    if (user.emailVerifiedAt) return user;
    return this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: this.clock.now() } });
  }

  // ─── Password reset ──────────────────────────────────────

  /** Always succeeds so the endpoint cannot be used to discover registered emails. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.blockedAt) return;
    const token = await this.signEmailToken(
      { sub: user.id, purpose: 'reset', pwv: this.passwordVersion(user.passwordHash) },
      '1h',
    );
    const mail = await renderResetPasswordEmail(`${this.env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`, localeOf(user.locale));
    await this.email.send(user.email, mail);
  }

  async resetPassword(input: ResetPasswordInput) {
    const p = await this.readEmailToken(input.token, 'reset');
    const user = await this.prisma.user.findUnique({ where: { id: p.sub } });
    // pwv ties the token to the current password, so it stops working once used.
    if (!user || this.passwordVersion(user.passwordHash) !== p.pwv) {
      throw new AppError('INVALID_TOKEN', 'This link is invalid or was already used');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      // Opening the reset link proves control of the inbox.
      data: { passwordHash: await this.hashPassword(input.password), emailVerifiedAt: user.emailVerifiedAt ?? this.clock.now() },
    });
    await this.revokeAllSessions(user.id);
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Current password is wrong');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(input.newPassword) } });
    await this.revokeAllSessions(userId);
    return this.createSession(user);
  }

  async updateSettings(userId: string, settings: NotificationSettingsInput) {
    await this.prisma.user.update({ where: { id: userId }, data: settings });
  }

  // ─── Me ──────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        influencer: { select: { id: true, displayName: true, avatarUrl: true, status: true, rejectionReason: true } },
        brand: { select: { id: true, companyName: true, logoUrl: true } },
        subscription: true,
      },
    });
    if (!user || user.blockedAt) throw new AppError('UNAUTHORIZED', 'Session is no longer valid');
    const now = this.clock.now();
    const sub = user.subscription;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: !!user.emailVerifiedAt,
      digestEmails: user.digestEmails,
      currency: user.currency,
      locale: user.locale,
      createdAt: user.createdAt,
      influencer: user.influencer,
      brand: user.brand,
      subscription: sub
        ? {
            status: sub.status,
            trialEndsAt: sub.trialEndsAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            trialDaysLeft: trialDaysLeft(sub, now),
            hasAccess: hasAccess(sub, now),
          }
        : null,
    };
  }

  // ─── helpers ─────────────────────────────────────────────

  private passwordVersion(hash: string) {
    return CryptoService.sha256(hash).slice(0, 16);
  }

  private signEmailToken(payload: EmailTokenPayload, expiresIn: '1h' | '48h') {
    return this.jwt.signAsync(payload, { secret: this.env.JWT_EMAIL_SECRET, expiresIn });
  }

  private async readEmailToken<P extends EmailTokenPayload['purpose']>(token: string, purpose: P) {
    try {
      const p = await this.jwt.verifyAsync<EmailTokenPayload>(token, { secret: this.env.JWT_EMAIL_SECRET });
      if (p.purpose !== purpose) throw new Error('wrong purpose');
      return p as Extract<EmailTokenPayload, { purpose: P }>;
    } catch {
      throw new AppError('INVALID_TOKEN', 'This link is invalid or has expired');
    }
  }
}
