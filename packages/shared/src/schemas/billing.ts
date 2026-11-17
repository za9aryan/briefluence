import { z } from 'zod';
import { CURRENCIES, PLAN_CODES } from '../enums';

/** The blogger picks Basic (Pro plans are bought through checkout). */
export const choosePlanSchema = z.object({ plan: z.enum(PLAN_CODES) });
export type ChoosePlanInput = z.infer<typeof choosePlanSchema>;

const PRO_PLANS = ['PRO_DAILY', 'PRO_MONTHLY', 'PRO_YEARLY'] as const;

/** Paddle discount codes: letters and numbers, up to 32 (case-insensitive). */
export const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9]+$/);

/** Paying for a Pro plan, optionally with a coupon code. */
export const checkoutSchema = z.object({
  plan: z.enum(PRO_PLANS),
  coupon: couponCodeSchema.optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin edits a plan. Basic stays free and always available; Pro plans are unlimited. */
export const planUpdateSchema = z.object({
  priceMinor: z.number().int().min(0).max(100_000_000),
  currency: z.enum(CURRENCIES),
  applicationLimit: z.number().int().min(1).max(1000).nullable(),
  /** Live offers; null = unlimited. Optional so older clients keep working. */
  offerLimit: z.number().int().min(0).max(100).nullable().optional(),
  isActive: z.boolean(),
});
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

/** Blogger checks a coupon code before checkout. */
export const couponCheckSchema = z.object({ code: couponCodeSchema });
export type CouponCheckInput = z.infer<typeof couponCheckSchema>;

/**
 * Admin creates a coupon (a Paddle discount): `percentOff` (100 = free) for `billingPeriods`
 * periods of the chosen Pro plans (null = every period, only for partial discounts). `maxUses`
 * 1 = single use, null = unlimited. Without `code` Paddle generates one.
 */
export const couponCreateSchema = z
  .object({
    code: couponCodeSchema.optional(),
    note: z.string().trim().max(200).optional(),
    percentOff: z.number().int().min(1).max(100),
    billingPeriods: z.number().int().min(1).max(36).nullable(),
    plans: z.array(z.enum(PRO_PLANS)).min(1).max(3),
    maxUses: z.number().int().min(1).max(100_000).nullable(),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
  })
  .refine((c) => c.billingPeriods != null || c.percentOff < 100, {
    path: ['billingPeriods'],
    message: 'Free Pro needs a number of periods',
  });
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

/** Admin turns a coupon on or off. */
export const couponUpdateSchema = z.object({ active: z.boolean() });
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
