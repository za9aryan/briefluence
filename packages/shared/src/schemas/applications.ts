import { z } from 'zod';
import { PITCH_MAX_LENGTH } from '../constants';
import { APPLICATION_STATUSES, REJECTION_REASONS } from '../enums';
import { idSchema, minorAmount, paginationSchema } from './common';

export const applySchema = z.object({
  /** Optional: by default the best-matching connected account is used; brands see all accounts. */
  socialAccountId: idSchema.optional(),
  pitch: z.string().trim().min(10).max(PITCH_MAX_LENGTH),
  proposedPrice: minorAmount.nullable().optional().transform((v) => v ?? null),
});
export type ApplyInput = z.input<typeof applySchema>;

export const applicationStatusUpdateSchema = z
  .object({
    status: z.enum(['VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'COMPLETED']),
    rejectionReason: z.enum(REJECTION_REASONS).optional(),
    /** Brand confirmed accepting beyond the deal's slot count. */
    confirmOverSlots: z.boolean().optional(),
  })
  .refine((v) => v.status !== 'REJECTED' || !!v.rejectionReason, {
    message: 'pickReason',
    path: ['rejectionReason'],
  });
export type ApplicationStatusUpdateInput = z.infer<typeof applicationStatusUpdateSchema>;

export const postUrlSchema = z.object({ postUrl: z.url({ protocol: /^https?$/ }).max(500) });
export type PostUrlInput = z.infer<typeof postUrlSchema>;

export const applicantsQuerySchema = paginationSchema.extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
  sort: z.enum(['match', 'followers', 'newest']).default('match'),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});
export type ApplicantsQuery = z.infer<typeof applicantsQuerySchema>;
