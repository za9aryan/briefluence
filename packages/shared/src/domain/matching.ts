import type { DealStatus, Gender, GenderFilter, Platform } from '../enums';
import {
  type AudienceAge,
  type AudienceCountries,
  type AudienceGender,
  mainCountry,
  majorityGender,
  shareInAgeRange,
} from './audience';

export interface MatchAccount {
  id: string;
  platform: Platform;
  followers: number;
  engagementRate: number | null;
  audienceGender: AudienceGender | null;
  audienceAge: AudienceAge | null;
  audienceCountries: AudienceCountries | null;
}

export interface MatchInfluencer {
  country: string;
  city: string | null;
  gender: Gender | null;
  birthYear: number | null;
  niches: string[];
  languages: string[];
  accounts: MatchAccount[];
}

export interface MatchDeal {
  status: DealStatus;
  applicationDeadline: Date;
  platforms: Platform[];
  niches: string[];
  countries: string[];
  cities: string[];
  languages: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  influencerGender: GenderFilter;
  influencerAgeMin: number | null;
  influencerAgeMax: number | null;
  audienceGender: GenderFilter;
  audienceAgeMin: number | null;
  audienceAgeMax: number | null;
  audienceCountry: string | null;
}

export const MATCH_WEIGHTS = {
  niche: 30,
  engagement: 20,
  audienceGender: 15,
  audienceAge: 15,
  audienceCountry: 10,
  language: 10,
} as const;

export type HardFilterFailure =
  | 'NOT_ACTIVE'
  | 'DEADLINE_PASSED'
  | 'COUNTRY'
  | 'CITY'
  | 'PLATFORM_OR_FOLLOWERS'
  | 'GENDER'
  | 'AGE';

export function influencerAge(birthYear: number | null, now: Date): number | null {
  return birthYear == null ? null : now.getUTCFullYear() - birthYear;
}

/** Accounts on one of the deal's platforms with followers inside the deal's range. */
export function eligibleAccounts(deal: MatchDeal, accounts: MatchAccount[]): MatchAccount[] {
  return accounts.filter(
    (a) =>
      deal.platforms.includes(a.platform) &&
      (deal.minFollowers == null || a.followers >= deal.minFollowers) &&
      (deal.maxFollowers == null || a.followers <= deal.maxFollowers),
  );
}

/**
 * Hard filters from the spec. Returns the first failing rule, or null when the deal is
 * visible to the influencer. `ignoreStatus` is used for the brand's reach preview on drafts.
 */
export function checkEligibility(
  deal: MatchDeal,
  inf: MatchInfluencer,
  now: Date,
  opts: { ignoreStatus?: boolean } = {},
): HardFilterFailure | null {
  if (!opts.ignoreStatus) {
    if (deal.status !== 'ACTIVE') return 'NOT_ACTIVE';
    if (deal.applicationDeadline.getTime() <= now.getTime()) return 'DEADLINE_PASSED';
  }
  if (deal.countries.length > 0 && !deal.countries.includes(inf.country)) return 'COUNTRY';
  if (deal.cities.length > 0 && (!inf.city || !deal.cities.includes(inf.city))) return 'CITY';
  if (eligibleAccounts(deal, inf.accounts).length === 0) return 'PLATFORM_OR_FOLLOWERS';
  if (deal.influencerGender !== 'ANY' && inf.gender !== deal.influencerGender) return 'GENDER';
  if (deal.influencerAgeMin != null || deal.influencerAgeMax != null) {
    const age = influencerAge(inf.birthYear, now);
    if (age == null) return 'AGE';
    if (deal.influencerAgeMin != null && age < deal.influencerAgeMin) return 'AGE';
    if (deal.influencerAgeMax != null && age > deal.influencerAgeMax) return 'AGE';
  }
  return null;
}

export interface MatchBreakdown {
  niche: number;
  engagement: number;
  audienceGender: number;
  audienceAge: number;
  audienceCountry: number;
  language: number;
  total: number;
}

const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** Soft fit for one account, 0–100. Missing audience data earns half points for that factor. */
export function scoreAccount(
  deal: MatchDeal,
  inf: Pick<MatchInfluencer, 'niches' | 'languages'>,
  acc: MatchAccount,
): MatchBreakdown {
  const W = MATCH_WEIGHTS;
  const half = (w: number) => w / 2;

  const niche = deal.niches.length === 0 || overlaps(deal.niches, inf.niches) ? W.niche : 0;

  let engagement: number;
  if (deal.minEngagementRate == null || deal.minEngagementRate <= 0) engagement = W.engagement;
  else if (acc.engagementRate == null) engagement = half(W.engagement);
  else engagement = W.engagement * Math.min(1, acc.engagementRate / deal.minEngagementRate);

  let audienceGender: number;
  if (deal.audienceGender === 'ANY') audienceGender = W.audienceGender;
  else {
    const majority = majorityGender(acc.audienceGender);
    if (majority == null) audienceGender = half(W.audienceGender);
    else audienceGender = majority === deal.audienceGender ? W.audienceGender : 0;
  }

  let audienceAge: number;
  if (deal.audienceAgeMin == null && deal.audienceAgeMax == null) audienceAge = W.audienceAge;
  else {
    const share = shareInAgeRange(acc.audienceAge, deal.audienceAgeMin, deal.audienceAgeMax);
    if (share == null) audienceAge = half(W.audienceAge);
    else audienceAge = W.audienceAge * Math.min(1, share / 50);
  }

  let audienceCountry: number;
  if (!deal.audienceCountry) audienceCountry = W.audienceCountry;
  else {
    const main = mainCountry(acc.audienceCountries);
    if (main == null) audienceCountry = half(W.audienceCountry);
    else audienceCountry = main === deal.audienceCountry ? W.audienceCountry : 0;
  }

  let language: number;
  if (deal.languages.length === 0) language = W.language;
  else if (inf.languages.length === 0) language = half(W.language);
  else language = overlaps(deal.languages, inf.languages) ? W.language : 0;

  const total = Math.round(
    niche + engagement + audienceGender + audienceAge + audienceCountry + language,
  );
  return { niche, engagement, audienceGender, audienceAge, audienceCountry, language, total };
}

/**
 * Best match score across the influencer's eligible accounts (or a specific account when
 * applying). Returns null when no account is eligible.
 */
export function matchScore(
  deal: MatchDeal,
  inf: MatchInfluencer,
  accountId?: string,
): { score: number; accountId: string } | null {
  let accounts = eligibleAccounts(deal, inf.accounts);
  if (accountId) accounts = accounts.filter((a) => a.id === accountId);
  let best: { score: number; accountId: string } | null = null;
  for (const acc of accounts) {
    const { total } = scoreAccount(deal, inf, acc);
    if (!best || total > best.score) best = { score: total, accountId: acc.id };
  }
  return best;
}
