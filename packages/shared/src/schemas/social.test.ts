import { describe, expect, it } from 'vitest';
import { manualAccountSchema, profileUrlFor } from './social';

describe('manual social account', () => {
  it('needs only platform, username and followers', () => {
    const r = manualAccountSchema.parse({
      platform: 'INSTAGRAM',
      username: '@ani.food',
      followers: 12000,
    });
    expect(r).toMatchObject({
      username: 'ani.food',
      followers: 12000,
      engagementRate: null,
      topCountry: null,
    });
  });
  it('rejects bad usernames and percentages', () => {
    expect(
      manualAccountSchema.safeParse({ platform: 'TIKTOK', username: 'two words', followers: 1 })
        .success,
    ).toBe(false);
    expect(
      manualAccountSchema.safeParse({
        platform: 'TIKTOK',
        username: 'ok',
        followers: 1,
        engagementRate: 140,
      }).success,
    ).toBe(false);
    expect(
      manualAccountSchema.safeParse({
        platform: 'TIKTOK',
        username: 'ok',
        followers: 1,
        topCountryShare: 60,
      }).success,
    ).toBe(false);
  });
  it('builds profile links', () => {
    expect(profileUrlFor('TIKTOK', '@ani')).toBe('https://www.tiktok.com/@ani');
    expect(profileUrlFor('INSTAGRAM', 'ani')).toBe('https://www.instagram.com/ani/');
  });
});
