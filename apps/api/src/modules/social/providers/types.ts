import type { AudienceAge, AudienceCountries, AudienceGender, Platform } from '@briefluence/shared';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export interface SocialStats {
  externalId: string;
  username: string;
  profileUrl: string;
  avatarUrl: string | null;
  followers: number;
  mediaCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  audienceGender: AudienceGender | null;
  audienceAge: AudienceAge | null;
  audienceCountries: AudienceCountries | null;
}

export interface SocialProvider {
  readonly platform: Platform;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  /** Returns fresh tokens when they are close to expiry, or null when no refresh is needed. */
  refreshIfNeeded(tokens: TokenSet, now: Date): Promise<TokenSet | null>;
  fetchStats(accessToken: string): Promise<SocialStats>;
}

/** The user revoked access or the token can no longer be refreshed; they must reconnect. */
export class TokenRevokedError extends Error {
  constructor(message = 'Token revoked') {
    super(message);
  }
}

export class ProviderError extends Error {}

/** Converts absolute counts to percentages (0–100, 1 decimal). */
export function toPercents(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return {};
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 1000) / 10]));
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderError(`Non-JSON response (${res.status})`);
  }
  return { status: res.status, body: body as T };
}
