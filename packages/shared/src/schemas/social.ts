import { z } from 'zod';
import { AUDIENCE_AGE_BUCKETS } from '../constants';
import { PLATFORMS, type Platform } from '../enums';
import { countryCode, optionalUrl } from './common';

const optionalInt = (max: number) =>
  z
    .number()
    .int()
    .min(0)
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v ?? null);
const optionalPercent = z
  .number()
  .min(0)
  .max(100)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/**
 * A social account the blogger types in by hand (no OAuth). Only platform, username and followers
 * are required; the rest feeds matching when given. Admins see these as "added manually".
 */
export const manualAccountSchema = z
  .object({
    platform: z.enum(PLATFORMS),
    username: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ''))
      .pipe(z.string().regex(/^[A-Za-z0-9._-]{1,60}$/, 'invalidUsername')),
    followers: z.number().int().min(0).max(1_000_000_000),
    profileUrl: optionalUrl,
    avgViews: optionalInt(10_000_000_000),
    engagementRate: optionalPercent,
    audienceFemale: optionalPercent,
    topCountry: countryCode
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    topCountryShare: optionalPercent,
    topAge: z
      .enum(AUDIENCE_AGE_BUCKETS)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    topAgeShare: optionalPercent,
  })
  .superRefine((d, ctx) => {
    if (d.topCountryShare != null && !d.topCountry)
      ctx.addIssue({ code: 'custom', path: ['topCountry'], message: 'required' });
    if (d.topAgeShare != null && !d.topAge)
      ctx.addIssue({ code: 'custom', path: ['topAge'], message: 'required' });
  });
export type ManualAccountInput = z.infer<typeof manualAccountSchema>;

/** Public profile address for a handle, used when the blogger leaves the link empty. */
export function profileUrlFor(platform: Platform, username: string): string {
  const u = encodeURIComponent(username.replace(/^@/, ''));
  return {
    INSTAGRAM: `https://www.instagram.com/${u}/`,
    TIKTOK: `https://www.tiktok.com/@${u}`,
    YOUTUBE: `https://www.youtube.com/@${u}`,
  }[platform];
}
