import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import type { Env } from '../../../config/env';

export type LoginProvider = 'google' | 'apple';
export const LOGIN_PROVIDERS: LoginProvider[] = ['google', 'apple'];

/** What we learn about the person from the provider. */
export interface OAuthProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface LoginProviderImpl {
  authorizeUrl(state: string, redirectUri: string): string;
  /** `extra` carries provider-specific callback fields (Apple posts the user's name once). */
  exchange(
    code: string,
    redirectUri: string,
    extra: Record<string, string | undefined>,
  ): Promise<OAuthProfile>;
}

/**
 * Google OpenID Connect.
 * Docs: https://developers.google.com/identity/openid-connect/openid-connect
 * Authorize: https://accounts.google.com/o/oauth2/v2/auth (scope "openid email profile");
 * token: https://oauth2.googleapis.com/token; ID token keys: https://www.googleapis.com/oauth2/v3/certs.
 */
export class GoogleLogin implements LoginProviderImpl {
  private readonly jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  constructor(private readonly env: Env) {}

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  async exchange(code: string, redirectUri: string): Promise<OAuthProfile> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error(`Google token exchange failed (${res.status})`);
    const { payload } = await jwtVerify(body.id_token, this.jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: this.env.GOOGLE_CLIENT_ID,
    });
    return {
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  }
}

/**
 * Sign in with Apple (web).
 * Docs: https://developer.apple.com/documentation/sign_in_with_apple
 * Authorize: https://appleid.apple.com/auth/authorize with response_mode=form_post (required when
 * asking for name/email; the name is posted once, in the `user` field). Token:
 * https://appleid.apple.com/auth/token with a client_secret JWT (ES256, kid = key id, iss = team id,
 * sub = Services ID, aud = https://appleid.apple.com, max 6 months). Keys: https://appleid.apple.com/auth/keys.
 */
export class AppleLogin implements LoginProviderImpl {
  private readonly jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  constructor(private readonly env: Env) {}

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.env.APPLE_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
      state,
    });
    return `https://appleid.apple.com/auth/authorize?${q}`;
  }

  private async clientSecret() {
    const key = await importPKCS8(
      (this.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      'ES256',
    );
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.env.APPLE_KEY_ID })
      .setIssuer(this.env.APPLE_TEAM_ID ?? '')
      .setSubject(this.env.APPLE_CLIENT_ID ?? '')
      .setAudience('https://appleid.apple.com')
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(key);
  }

  async exchange(
    code: string,
    redirectUri: string,
    extra: Record<string, string | undefined>,
  ): Promise<OAuthProfile> {
    const res = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.APPLE_CLIENT_ID ?? '',
        client_secret: await this.clientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error(`Apple token exchange failed (${res.status})`);
    const { payload } = await jwtVerify(body.id_token, this.jwks, {
      issuer: 'https://appleid.apple.com',
      audience: this.env.APPLE_CLIENT_ID,
    });
    let name: string | null = null;
    try {
      const u = extra.user
        ? (JSON.parse(extra.user) as { name?: { firstName?: string; lastName?: string } })
        : null;
      name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ') || null;
    } catch {
      // name is optional
    }
    return {
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      // Apple sends "true" as a string.
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name,
    };
  }
}

/**
 * Local stand-in: "authorizes" via the web app's test page (/oauth/mock), which sends back a code
 * holding the email/name the tester typed. Never enabled in production (env check).
 */
export class MockLogin implements LoginProviderImpl {
  constructor(
    private readonly provider: LoginProvider,
    private readonly env: Env,
  ) {}

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ provider: this.provider, state, redirect: redirectUri });
    return `${this.env.WEB_URL}/oauth/mock?${q}`;
  }

  async exchange(code: string): Promise<OAuthProfile> {
    const raw = code.startsWith('mock:') ? code.slice(5) : '';
    const { email, name } = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      email: string;
      name?: string;
    };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('mock: invalid email');
    return {
      subject: `mock-${this.provider}-${email.toLowerCase()}`,
      email: email.toLowerCase(),
      emailVerified: true,
      name: name ?? null,
    };
  }
}

export function configuredProviders(env: Env): Partial<Record<LoginProvider, LoginProviderImpl>> {
  const out: Partial<Record<LoginProvider, LoginProviderImpl>> = {};
  for (const p of LOGIN_PROVIDERS) {
    if (env.OAUTH_LOGIN_MOCK.includes(p)) out[p] = new MockLogin(p, env);
    else if (p === 'google' && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
      out.google = new GoogleLogin(env);
    else if (
      p === 'apple' &&
      env.APPLE_CLIENT_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_KEY_ID &&
      env.APPLE_PRIVATE_KEY
    )
      out.apple = new AppleLogin(env);
  }
  return out;
}
