import { z } from 'zod';
import { LANGUAGES, NICHES } from '../constants';
import { isValidContact, normalizeContact } from '../contact';
import { CONTACT_METHODS, GENDERS } from '../enums';
import { countryCode, optionalText, optionalUrl } from './common';

const currentYear = new Date().getUTCFullYear();

export const influencerProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  avatarUrl: optionalUrl,
  bio: optionalText(1000),
  country: countryCode,
  city: optionalText(80),
  gender: z.enum(GENDERS).nullable().optional().transform((v) => v ?? null),
  birthYear: z
    .number()
    .int()
    .min(currentYear - 100)
    .max(currentYear - 13)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length).default([]),
  niches: z.array(z.enum(NICHES)).min(1, 'pickOne').max(NICHES.length),
  contactEmail: z
    .union([z.email().max(254), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  contactPhone: optionalText(32),
  telegram: optionalText(64),
});
export type InfluencerProfileInput = z.input<typeof influencerProfileSchema>;
export type InfluencerProfileData = z.output<typeof influencerProfileSchema>;

export const brandProfileSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120),
    logoUrl: optionalUrl,
    website: optionalUrl,
    instagramUrl: optionalUrl,
    description: optionalText(2000),
    country: countryCode,
    city: optionalText(80),
    // Contact person, revealed to a blogger only after the brand accepts them.
    contactName: optionalText(120),
    contactPosition: optionalText(80),
    contactMethod: z.enum(CONTACT_METHODS).nullable().optional().transform((v) => v ?? null),
    contactValue: optionalText(120),
  })
  .superRefine((v, ctx) => {
    if (v.contactMethod && !v.contactValue) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'required' });
    } else if (v.contactMethod && v.contactValue && !isValidContact(v.contactMethod, v.contactValue)) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'contactInvalid' });
    }
  })
  .transform((v) => ({
    ...v,
    contactValue: v.contactMethod && v.contactValue ? normalizeContact(v.contactMethod, v.contactValue) : null,
  }));
export type BrandProfileInput = z.input<typeof brandProfileSchema>;
export type BrandProfileData = z.output<typeof brandProfileSchema>;

export const verificationDecisionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;
