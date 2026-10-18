import { describe, expect, it } from 'vitest';
import { planTier, type SubscriptionState } from './subscription';

const now = new Date('2026-10-18T10:00:00Z');
const day = 86_400_000;
const base: SubscriptionState = {
  status: 'TRIALING',
  trialEndsAt: new Date(now.getTime() + 5 * day),
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  bindingId: null,
  failedAttempts: 0,
  pastDueSince: null,
};

describe('planTier', () => {
  it('splits bloggers into free trial, paid and no plan', () => {
    expect(planTier(null, now)).toBe('NONE');
    expect(planTier(base, now)).toBe('FREE');
    expect(planTier({ ...base, trialEndsAt: new Date(now.getTime() - day) }, now)).toBe('NONE');
    expect(
      planTier(
        { ...base, status: 'ACTIVE', currentPeriodEnd: new Date(now.getTime() + 20 * day) },
        now,
      ),
    ).toBe('PAID');
    expect(
      planTier(
        { ...base, status: 'PAST_DUE', currentPeriodEnd: new Date(now.getTime() - day) },
        now,
      ),
    ).toBe('PAID');
    expect(planTier({ ...base, status: 'EXPIRED' }, now)).toBe('NONE');
  });
});
