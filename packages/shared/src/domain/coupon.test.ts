import { describe, expect, it } from 'vitest';
import { couponProblem, couponStats, couponUsesLeft, normalizeCouponCode } from './coupon';

const now = new Date('2026-11-17T10:00:00Z');
const rule = (over = {}) => ({
  active: true,
  expiresAt: null,
  maxUses: 1,
  uses: 0,
  plans: ['PRO_MONTHLY' as const],
  ...over,
});
const ctx = (over = {}) => ({
  now,
  plan: 'PRO_MONTHLY' as const,
  usedCouponBefore: false,
  ...over,
});

describe('coupons', () => {
  it('codes compare without case or spaces', () => {
    expect(normalizeCouponCode('  blogger2026 ')).toBe('BLOGGER2026');
  });

  it('checks the coupon, then the blogger, then the plan', () => {
    expect(couponProblem(rule(), ctx())).toBeNull();
    expect(couponProblem(null, ctx())).toBe('NOT_FOUND');
    expect(couponProblem(rule({ active: false }), ctx())).toBe('INACTIVE');
    expect(couponProblem(rule({ expiresAt: now }), ctx())).toBe('EXPIRED');
    expect(couponProblem(rule({ uses: 1 }), ctx())).toBe('USED_UP');
    expect(couponProblem(rule({ maxUses: null, uses: 500 }), ctx())).toBeNull();
    expect(couponProblem(rule(), ctx({ usedCouponBefore: true }))).toBe('ALREADY_USED');
    expect(couponProblem(rule(), ctx({ plan: 'PRO_YEARLY' }))).toBe('WRONG_PLAN');
    // Checking just the code (no plan picked yet).
    expect(couponProblem(rule(), ctx({ plan: null }))).toBeNull();
  });

  it('uses left and statistics', () => {
    expect(couponUsesLeft({ maxUses: 10, uses: 3 })).toBe(7);
    expect(couponUsesLeft({ maxUses: null, uses: 3 })).toBeNull();
    expect(
      couponStats([
        { paidAfter: [0, 999], renewing: true },
        { paidAfter: [0], renewing: false },
        { paidAfter: [0], renewing: true },
      ]),
    ).toEqual({ uses: 3, paying: 1, renewing: 2, conversion: 33 });
    expect(couponStats([])).toMatchObject({ uses: 0, conversion: 0 });
  });
});
