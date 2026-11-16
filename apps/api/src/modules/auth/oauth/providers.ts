import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../../../config/env';

export type LoginProvider = 'google';
export const LOGIN_PROVIDERS: LoginProvider[] = ['google'];

/** What we learn about the person from the provider. */
export interface OAuthProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface LoginProviderImpl {
  authorizeUrl(state: string, redirectUri: string): string;
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
 * Local stand-in: "authorizes" via the web app's test page (/oauth/mock), which sends back a code
 * holding the email/name the tester typed. Development and tests only: production refuses to start
 * with it (env check), and it never signs in to an existing account (oauth-login.service).
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
  if (env.OAUTH_LOGIN_MOCK.includes('google')) return { google: new MockLogin('google', env) };
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return { google: new GoogleLogin(env) };
  return {};
}
