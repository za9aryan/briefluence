import { z } from 'zod';
import { SUPPORT_MESSAGE_MAX_LENGTH } from '../constants';
import { SUPPORT_TOPICS } from '../enums';
import { idSchema, optionalText, optionalUrl } from './common';

const body = z.string().trim().max(SUPPORT_MESSAGE_MAX_LENGTH);
const needsContent = (v: { body: string; imageUrl: string | null }) => !!v.body || !!v.imageUrl;

/** One message: text and/or one image (uploaded through /support/attachments). */
export const supportMessageSchema = z
  .object({ body: body.default(''), imageUrl: optionalUrl })
  .refine(needsContent, { message: 'required', path: ['body'] });
export type SupportMessageInput = z.input<typeof supportMessageSchema>;
export type SupportMessageData = z.output<typeof supportMessageSchema>;

/**
 * First message of a ticket. Guests (not signed in) must give an email, where replies are sent.
 * `website` is a honeypot: hidden from people, bots fill it in.
 */
export const supportStartSchema = z
  .object({
    topic: z.enum(SUPPORT_TOPICS),
    body: body.default(''),
    imageUrl: optionalUrl,
    guestEmail: z
      .email()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => v?.toLowerCase() ?? null),
    guestName: optionalText(80),
    website: z.string().max(200).optional(),
  })
  .refine(needsContent, { message: 'required', path: ['body'] });
export type SupportStartInput = z.input<typeof supportStartSchema>;
export type SupportStartData = z.output<typeof supportStartSchema>;

export const supportResumeSchema = z.object({ token: z.string().min(20).max(200) });

export const supportAssignSchema = z.object({ assigneeId: idSchema.nullable() });
export type SupportAssignInput = z.infer<typeof supportAssignSchema>;

export const SUPPORT_BOXES = ['unassigned', 'mine', 'open', 'closed'] as const;
export type SupportBox = (typeof SUPPORT_BOXES)[number];
