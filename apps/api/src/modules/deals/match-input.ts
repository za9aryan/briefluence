import {
  isAccountUsable,
  type AudienceAge,
  type AudienceCountries,
  type AudienceGender,
  type MatchAccount,
  type MatchDeal,
  type MatchInfluencer,
} from '@briefluence/shared';
import type { Deal, InfluencerProfile, Prisma, SocialAccount } from '@prisma/client';

export function toMatchDeal(d: Deal): MatchDeal {
  return {
    status: d.status,
    applicationDeadline: d.applicationDeadline,
    platforms: d.platforms,
    niches: d.niches,
    countries: d.countries,
    cities: d.cities,
    languages: d.languages,
    minFollowers: d.minFollowers,
    maxFollowers: d.maxFollowers,
    minEngagementRate: d.minEngagementRate,
    influencerGender: d.influencerGender,
    influencerAgeMin: d.influencerAgeMin,
    influencerAgeMax: d.influencerAgeMax,
    audienceGender: d.audienceGender,
    audienceAgeMin: d.audienceAgeMin,
    audienceAgeMax: d.audienceAgeMax,
    audienceCountry: d.audienceCountry,
  };
}

export function toMatchAccount(a: SocialAccount): MatchAccount {
  return {
    id: a.id,
    platform: a.platform,
    followers: a.followers,
    engagementRate: a.engagementRate,
    audienceGender: a.audienceGender as AudienceGender | null,
    audienceAge: a.audienceAge as AudienceAge | null,
    audienceCountries: a.audienceCountries as AudienceCountries | null,
  };
}

/** Accounts with a revoked token are excluded: their stats can no longer be trusted. */
export function toMatchInfluencer(
  p: InfluencerProfile & { socialAccounts: SocialAccount[] },
): MatchInfluencer {
  return {
    country: p.country,
    city: p.city,
    gender: p.gender,
    birthYear: p.birthYear,
    niches: p.niches,
    languages: p.languages,
    accounts: p.socialAccounts.filter(isAccountUsable).map(toMatchAccount),
  };
}

/**
 * Hard filters as a Prisma where clause over Deal for one influencer. Mirrors
 * checkEligibility() in @briefluence/shared, which is re-applied in memory as a safety net.
 */
export function dealHardFilterWhere(inf: MatchInfluencer, now: Date): Prisma.DealWhereInput {
  const year = now.getUTCFullYear();
  const age = inf.birthYear == null ? null : year - inf.birthYear;
  const genders: ('ANY' | 'MALE' | 'FEMALE')[] = ['ANY'];
  if (inf.gender === 'MALE' || inf.gender === 'FEMALE') genders.push(inf.gender);

  return {
    status: 'ACTIVE',
    applicationDeadline: { gt: now },
    brand: { user: { blockedAt: null } },
    AND: [
      { OR: [{ countries: { isEmpty: true } }, { countries: { has: inf.country } }] },
      { OR: [{ cities: { isEmpty: true } }, ...(inf.city ? [{ cities: { has: inf.city } }] : [])] },
      {
        OR: inf.accounts.map((a) => ({
          platforms: { has: a.platform },
          AND: [
            { OR: [{ minFollowers: null }, { minFollowers: { lte: a.followers } }] },
            { OR: [{ maxFollowers: null }, { maxFollowers: { gte: a.followers } }] },
          ],
        })),
      },
      { influencerGender: { in: genders } },
      age == null
        ? { influencerAgeMin: null, influencerAgeMax: null }
        : {
            AND: [
              { OR: [{ influencerAgeMin: null }, { influencerAgeMin: { lte: age } }] },
              { OR: [{ influencerAgeMax: null }, { influencerAgeMax: { gte: age } }] },
            ],
          },
    ],
  };
}
