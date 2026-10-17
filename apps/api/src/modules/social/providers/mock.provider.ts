import type { Platform } from '@briefluence/shared';
import { createHash, randomBytes } from 'node:crypto';
import { TokenRevokedError, type SocialProvider, type SocialStats, type TokenSet } from './types';

/**
 * Local development stand-in for the real OAuth apps (SOCIAL_MOCK=true): "authorizes" instantly
 * and returns plausible stats derived from the token so repeated syncs are stable.
 */
export class MockSocialProvider implements SocialProvider {
  constructor(readonly platform: Platform) {}

  authorizeUrl(state: string, redirectUri: string) {
    const code = `mock-${randomBytes(6).toString('hex')}`;
    return `${redirectUri}?${new URLSearchParams({ code, state })}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    return { accessToken: `${this.platform}:${code}`, refreshToken: null, expiresAt: null };
  }

  async refreshIfNeeded(): Promise<TokenSet | null> {
    return null;
  }

  async fetchStats(accessToken: string): Promise<SocialStats> {
    if (accessToken.endsWith(':revoked')) throw new TokenRevokedError();
    const seed = createHash('sha256').update(accessToken).digest();
    const r = (i: number) => seed[i % seed.length]! / 255;
    const id = seed.subarray(0, 4).toString('hex');
    const followers = Math.round(2_000 + r(1) ** 2 * 200_000);
    const female = Math.round(30 + r(2) * 45);
    const username = `${this.platform.toLowerCase()}_creator_${id}`;
    const hasDemographics = this.platform !== 'TIKTOK';
    const profileUrl = {
      INSTAGRAM: `https://www.instagram.com/${username}`,
      TIKTOK: `https://www.tiktok.com/@${username}`,
      YOUTUBE: `https://www.youtube.com/@${username}`,
    }[this.platform];
    return {
      externalId: `mock-${id}`,
      username,
      profileUrl,
      avatarUrl: null,
      followers,
      mediaCount: Math.round(40 + r(3) * 400),
      avgViews: Math.round(followers * (0.1 + r(4) * 0.5)),
      engagementRate: Math.round((1 + r(5) * 7) * 100) / 100,
      audienceGender: hasDemographics ? { male: 100 - female, female } : null,
      audienceAge: hasDemographics
        ? { '13-17': 4, '18-24': 30 + Math.round(r(6) * 10), '25-34': 35, '35-44': 15, '45-54': 6, '55-64': 3, '65+': 1 }
        : null,
      audienceCountries: hasDemographics ? { AM: 60 + Math.round(r(7) * 25), RU: 10, US: 5 } : null,
    };
  }
}
