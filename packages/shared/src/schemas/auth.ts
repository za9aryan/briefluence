import { z } from 'zod';
import { CURRENCIES } from '../enums';

export const emailSchema = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z
  .string()
  .min(8, 'passwordShort')
  .max(128)
  .regex(/[A-Za-z]/, 'passwordLetter')
  .regex(/\d/, 'passwordDigit');

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['INFLUENCER', 'BRAND']),
  acceptTerms: z.literal(true, { error: 'acceptTerms' }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenSchema = z.object({ token: z.string().min(10).max(2000) });
export type TokenInput = z.infer<typeof tokenSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(2000),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Account preferences; send only what changes. */
export const notificationSettingsSchema = z
  .object({ digestEmails: z.boolean(), currency: z.enum(CURRENCIES) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'invalid' });
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
