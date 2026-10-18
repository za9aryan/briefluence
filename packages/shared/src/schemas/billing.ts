import { z } from 'zod';
import { CURRENCIES, PLAN_CODES } from '../enums';

/** The blogger picks a plan; every plan starts with the free Pro days. */
export const choosePlanSchema = z.object({ plan: z.enum(PLAN_CODES) });
export type ChoosePlanInput = z.infer<typeof choosePlanSchema>;

/** Paying for a Pro plan. */
export const checkoutSchema = z.object({ plan: z.enum(['PRO_MONTHLY', 'PRO_YEARLY']) });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin edits a plan. Basic stays free and always available; Pro plans are unlimited. */
export const planUpdateSchema = z.object({
  priceMinor: z.number().int().min(0).max(100_000_000),
  currency: z.enum(CURRENCIES),
  applicationLimit: z.number().int().min(1).max(1000).nullable(),
  isActive: z.boolean(),
});
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
