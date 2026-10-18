import { z } from 'zod';
import { NICHES } from '../constants';
import { COLLABORATION_TYPES, CONTENT_FORMATS, CURRENCIES, PLATFORMS } from '../enums';
import { minorAmount, optionalText, paginationSchema } from './common';

/** What a blogger offers: "1 Reel for 20,000 AMD", "Long-term work with real estate brokers". */
export const offerInputSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  /** null = price on request */
  priceMinor: minorAmount
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  currency: z.enum(CURRENCIES).default('AMD'),
  collaborationType: z.enum(COLLABORATION_TYPES).default('ONE_TIME'),
  platforms: z.array(z.enum(PLATFORMS)).min(1, 'pickOne'),
  contentFormats: z.array(z.enum(CONTENT_FORMATS)).min(1, 'pickOne'),
  niches: z.array(z.enum(NICHES)).default([]),
  idealBrands: optionalText(200),
});
export type OfferInput = z.infer<typeof offerInputSchema>;

/** A brand asks to work with the blogger on an offer. */
export const offerRequestSchema = z.object({
  message: z.string().trim().min(10).max(1000),
  proposedBudget: minorAmount
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type OfferRequestInput = z.infer<typeof offerRequestSchema>;

const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      (Array.isArray(v) ? v : v ? v.split(',') : []).filter((x): x is T =>
        (values as readonly string[]).includes(x),
      ),
    );

/** Brand-side offer feed filters. */
export const offerFeedQuerySchema = paginationSchema.extend({
  platform: csv(PLATFORMS),
  format: csv(CONTENT_FORMATS),
  niche: csv(NICHES),
  collaboration: csv(COLLABORATION_TYPES),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'price']).default('newest'),
});
export type OfferFeedQuery = z.infer<typeof offerFeedQuerySchema>;
