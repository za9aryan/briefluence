import { z } from 'zod';
import { INFLUENCER_AGE_RANGE, LANGUAGES, NICHES } from '../constants';
import { CONTENT_FORMATS, CURRENCIES, GENDER_FILTERS, PAYMENT_TYPES, PLATFORMS } from '../enums';
import { countryCode, minorAmount, optionalText, optionalUrl, paginationSchema } from './common';

const optionalInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().optional().transform((v) => v ?? null);

/** Shape of the deal wizard (Basics, Targeting, Compensation). */
export const dealBaseSchema = z.object({
  // Basics
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  imageUrl: optionalUrl,
  platforms: z.array(z.enum(PLATFORMS)).min(1, 'pickOne'),
  contentFormats: z.array(z.enum(CONTENT_FORMATS)).min(1, 'pickOne'),
  niches: z.array(z.enum(NICHES)).default([]),
  // Targeting
  countries: z.array(countryCode).min(1, 'pickOne'),
  cities: z.array(z.string().trim().min(1).max(80)).default([]),
  languages: z.array(z.enum(LANGUAGES)).default([]),
  minFollowers: optionalInt(0, 1_000_000_000),
  maxFollowers: optionalInt(0, 1_000_000_000),
  minEngagementRate: z.number().min(0).max(100).nullable().optional().transform((v) => v ?? null),
  influencerGender: z.enum(GENDER_FILTERS).default('ANY'),
  influencerAgeMin: optionalInt(INFLUENCER_AGE_RANGE.min, INFLUENCER_AGE_RANGE.max),
  influencerAgeMax: optionalInt(INFLUENCER_AGE_RANGE.min, INFLUENCER_AGE_RANGE.max),
  audienceGender: z.enum(GENDER_FILTERS).default('ANY'),
  audienceAgeMin: optionalInt(13, 100),
  audienceAgeMax: optionalInt(13, 100),
  audienceCountry: countryCode.nullable().optional().transform((v) => v ?? null),
  // Compensation
  paymentType: z.enum(PAYMENT_TYPES),
  budgetMin: minorAmount.nullable().optional().transform((v) => v ?? null),
  budgetMax: minorAmount.nullable().optional().transform((v) => v ?? null),
  currency: z.enum(CURRENCIES).default('AMD'),
  barterDescription: optionalText(1000),
  barterValue: minorAmount.nullable().optional().transform((v) => v ?? null),
  slots: z.number().int().min(1).max(500).default(1),
  applicationDeadline: z.coerce.date(),
  publishBy: z.coerce.date().nullable().optional().transform((v) => v ?? null),
});

type DealShape = z.output<typeof dealBaseSchema>;

function rangeOk(min: number | null, max: number | null) {
  return min == null || max == null || min <= max;
}

/** Cross-field rules shared by web and API. */
export function refineDeal(d: DealShape, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });
  if (!rangeOk(d.minFollowers, d.maxFollowers)) issue('maxFollowers', 'rangeInverted');
  if (!rangeOk(d.influencerAgeMin, d.influencerAgeMax)) issue('influencerAgeMax', 'rangeInverted');
  if (!rangeOk(d.audienceAgeMin, d.audienceAgeMax)) issue('audienceAgeMax', 'rangeInverted');
  if (!rangeOk(d.budgetMin, d.budgetMax)) issue('budgetMax', 'rangeInverted');
  if (d.paymentType !== 'BARTER' && d.budgetMin == null && d.budgetMax == null) {
    issue('budgetMin', 'budgetRequired');
  }
  if (d.paymentType !== 'MONEY' && !d.barterDescription) {
    issue('barterDescription', 'barterRequired');
  }
  if (d.publishBy && d.publishBy.getTime() < d.applicationDeadline.getTime()) {
    issue('publishBy', 'publishAfterDeadline');
  }
}

export const dealInputSchema = dealBaseSchema.superRefine(refineDeal);
export type DealInput = z.input<typeof dealInputSchema>;
export type DealData = z.output<typeof dealInputSchema>;

/** Targeting subset used by the live "about N influencers match" counter. */
export const reachPreviewSchema = dealBaseSchema.pick({
  platforms: true,
  niches: true,
  countries: true,
  cities: true,
  languages: true,
  minFollowers: true,
  maxFollowers: true,
  minEngagementRate: true,
  influencerGender: true,
  influencerAgeMin: true,
  influencerAgeMax: true,
});
export type ReachPreviewInput = z.input<typeof reachPreviewSchema>;

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(item).optional(),
  );

export const feedQuerySchema = paginationSchema.extend({
  platform: csv(z.enum(PLATFORMS)),
  niche: csv(z.enum(NICHES)),
  city: csv(z.string().max(80)),
  paymentType: csv(z.enum(PAYMENT_TYPES)),
  budgetMin: z.coerce.number().int().min(0).optional(),
  /** Currency the budget filter was entered in; the API converts it per deal currency. */
  budgetCurrency: z.enum(CURRENCIES).default('AMD'),
  deadlineBefore: z.coerce.date().optional(),
  sort: z.enum(['match', 'deadline', 'newest']).default('match'),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;
