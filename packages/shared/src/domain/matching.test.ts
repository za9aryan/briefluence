import { describe, expect, it } from 'vitest';
import { checkEligibility, matchScore, scoreAccount, type MatchDeal, type MatchInfluencer } from './matching';

const now = new Date('2026-10-15T12:00:00Z');

const deal = (over: Partial<MatchDeal> = {}): MatchDeal => ({
  status: 'ACTIVE',
  applicationDeadline: new Date('2026-11-01T00:00:00Z'),
  platforms: ['INSTAGRAM'],
  niches: [],
  countries: ['AM'],
  cities: [],
  languages: [],
  minFollowers: null,
  maxFollowers: null,
  minEngagementRate: null,
  influencerGender: 'ANY',
  influencerAgeMin: null,
  influencerAgeMax: null,
  audienceGender: 'ANY',
  audienceAgeMin: null,
  audienceAgeMax: null,
  audienceCountry: null,
  ...over,
});

const inf = (over: Partial<MatchInfluencer> = {}): MatchInfluencer => ({
  country: 'AM',
  city: 'Yerevan',
  gender: 'FEMALE',
  birthYear: 2000,
  niches: ['beauty'],
  languages: ['hy', 'ru'],
  accounts: [
    {
      id: 'ig',
      platform: 'INSTAGRAM',
      followers: 20_000,
      engagementRate: 4,
      audienceGender: { male: 30, female: 70 },
      audienceAge: { '18-24': 40, '25-34': 40, '35-44': 20 },
      audienceCountries: { AM: 80, RU: 20 },
    },
  ],
  ...over,
});

describe('checkEligibility', () => {
  it('passes a matching deal', () => {
    expect(checkEligibility(deal(), inf(), now)).toBeNull();
  });
  it('hides non-active and past-deadline deals', () => {
    expect(checkEligibility(deal({ status: 'PAUSED' }), inf(), now)).toBe('NOT_ACTIVE');
    expect(checkEligibility(deal({ applicationDeadline: now }), inf(), now)).toBe('DEADLINE_PASSED');
  });
  it('ignores status for reach preview', () => {
    expect(checkEligibility(deal({ status: 'DRAFT' }), inf(), now, { ignoreStatus: true })).toBeNull();
  });
  it('filters by country and city', () => {
    expect(checkEligibility(deal({ countries: ['GE'] }), inf(), now)).toBe('COUNTRY');
    expect(checkEligibility(deal({ cities: ['Gyumri'] }), inf(), now)).toBe('CITY');
    expect(checkEligibility(deal({ cities: ['Yerevan'] }), inf(), now)).toBeNull();
    expect(checkEligibility(deal({ cities: ['Yerevan'] }), inf({ city: null }), now)).toBe('CITY');
  });
  it('requires an account on the platform within the follower range', () => {
    expect(checkEligibility(deal({ platforms: ['TIKTOK'] }), inf(), now)).toBe('PLATFORM_OR_FOLLOWERS');
    expect(checkEligibility(deal({ minFollowers: 50_000 }), inf(), now)).toBe('PLATFORM_OR_FOLLOWERS');
    expect(checkEligibility(deal({ maxFollowers: 10_000 }), inf(), now)).toBe('PLATFORM_OR_FOLLOWERS');
    expect(checkEligibility(deal({ minFollowers: 10_000, maxFollowers: 50_000 }), inf(), now)).toBeNull();
  });
  it('filters by influencer gender and age', () => {
    expect(checkEligibility(deal({ influencerGender: 'MALE' }), inf(), now)).toBe('GENDER');
    expect(checkEligibility(deal({ influencerGender: 'FEMALE' }), inf(), now)).toBeNull();
    expect(checkEligibility(deal({ influencerAgeMin: 30 }), inf(), now)).toBe('AGE');
    expect(checkEligibility(deal({ influencerAgeMax: 30 }), inf(), now)).toBeNull();
    expect(checkEligibility(deal({ influencerAgeMax: 30 }), inf({ birthYear: null }), now)).toBe('AGE');
  });
});

describe('scoreAccount / matchScore', () => {
  it('gives 100 when the deal has no soft preferences', () => {
    expect(matchScore(deal(), inf())).toEqual({ score: 100, accountId: 'ig' });
  });

  it('weights each factor', () => {
    const d = deal({
      niches: ['auto'], // miss: -30
      minEngagementRate: 8, // 4/8 → 10 of 20
      audienceGender: 'MALE', // miss: -15
      audienceAgeMin: 18,
      audienceAgeMax: 24, // 40% → 12 of 15
      audienceCountry: 'RU', // miss: -10
      languages: ['en'], // miss: -10
    });
    const b = scoreAccount(d, inf(), inf().accounts[0]!);
    expect(b).toMatchObject({ niche: 0, engagement: 10, audienceGender: 0, audienceCountry: 0, language: 0 });
    expect(b.audienceAge).toBeCloseTo(12);
    expect(b.total).toBe(22);
  });

  it('gives half points when audience data is missing', () => {
    const tiktok = {
      id: 'tt',
      platform: 'TIKTOK' as const,
      followers: 20_000,
      engagementRate: null,
      audienceGender: null,
      audienceAge: null,
      audienceCountries: null,
    };
    const d = deal({
      platforms: ['TIKTOK'],
      minEngagementRate: 3,
      audienceGender: 'FEMALE',
      audienceAgeMin: 18,
      audienceAgeMax: 34,
      audienceCountry: 'AM',
    });
    // niche 30 + engagement 10 + gender 7.5 + age 7.5 + country 5 + language 10 = 70
    expect(matchScore(d, inf({ accounts: [tiktok] }))?.score).toBe(70);
  });

  it('picks the best eligible account and can be pinned to one account', () => {
    const accounts = [
      { ...inf().accounts[0]!, id: 'a', audienceCountries: { RU: 90 } },
      { ...inf().accounts[0]!, id: 'b' },
    ];
    const d = deal({ audienceCountry: 'AM' });
    expect(matchScore(d, inf({ accounts }))).toEqual({ score: 100, accountId: 'b' });
    expect(matchScore(d, inf({ accounts }), 'a')?.score).toBe(90);
  });

  it('returns null with no eligible account', () => {
    expect(matchScore(deal({ platforms: ['YOUTUBE'] }), inf())).toBeNull();
  });
});
