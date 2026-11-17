import type { PlanCode } from '../enums';

/**
 * Coupons are Paddle discounts (https://developer.paddle.com/api-reference/discounts/overview)
 * the admin creates in our dashboard: a percentage off (100% = free) for a number of billing
 * periods, on chosen Pro plans. Paddle's `usage_limit` counts all customers together and has no
 * per-customer limit, so "one coupon per account" and the friendly checks before checkout are
 * ours; Paddle still enforces the total limit and expiry itself.
 */
export type CouponProblem =
  'NOT_FOUND' | 'INACTIVE' | 'EXPIRED' | 'USED_UP' | 'ALREADY_USED' | 'WRONG_PLAN';

export interface CouponRule {
  active: boolean;
  expiresAt: Date | null;
  /** Total redemptions allowed (1 = single use); null = unlimited. */
  maxUses: number | null;
  /** Redemptions so far. */
  uses: number;
  /** Pro plans the coupon applies to. */
  plans: PlanCode[];
}

/** Codes are case-insensitive in Paddle; we store and compare them upper-case. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Why this blogger can't use the coupon now (null = fine). `plan` is the plan being bought, or
 * null when only checking the code. `usedCouponBefore`: the account already redeemed a coupon.
 */
export function couponProblem(
  c: CouponRule | null,
  ctx: { now: Date; plan: PlanCode | null; usedCouponBefore: boolean },
): CouponProblem | null {
  if (!c) return 'NOT_FOUND';
  if (!c.active) return 'INACTIVE';
  if (c.expiresAt && c.expiresAt.getTime() <= ctx.now.getTime()) return 'EXPIRED';
  if (c.maxUses != null && c.uses >= c.maxUses) return 'USED_UP';
  if (ctx.usedCouponBefore) return 'ALREADY_USED';
  if (ctx.plan && !c.plans.includes(ctx.plan)) return 'WRONG_PLAN';
  return null;
}

/** Uses left, or null when unlimited. */
export function couponUsesLeft(c: Pick<CouponRule, 'maxUses' | 'uses'>): number | null {
  return c.maxUses == null ? null : Math.max(0, c.maxUses - c.uses);
}

export interface CouponRedemptionView {
  /** Paid amounts (minor units) of payments after the coupon, renewals included. */
  paidAfter: number[];
  /** Pro is still running and renews. */
  renewing: boolean;
}

/** Admin statistics for one coupon from its redemptions. */
export function couponStats(redemptions: CouponRedemptionView[]) {
  const paying = redemptions.filter((r) => r.paidAfter.some((a) => a > 0)).length;
  return {
    uses: redemptions.length,
    /** Paid at least once after redeeming (after the free months, or a discounted price). */
    paying,
    renewing: redemptions.filter((r) => r.renewing).length,
    /** Share of redeemers who paid, 0–100. */
    conversion: redemptions.length ? Math.round((paying / redemptions.length) * 100) : 0,
  };
}
