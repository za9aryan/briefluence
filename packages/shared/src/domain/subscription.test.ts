import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  applyCancel,
  applyPaymentSucceeded,
  applyRenewalFailed,
  applyTimeTransitions,
  hasAccess,
  isChargeDue,
  nextChargeAt,
  startOfUtcDay,
  startTrial,
  trialDaysLeft,
} from './subscription';

const now = new Date('2026-10-15T09:00:00Z');

describe('subscription state', () => {
  it('starts a 30-day trial with access', () => {
    const s = startTrial(now);
    expect(s.status).toBe('TRIALING');
    expect(trialDaysLeft(s, now)).toBe(30);
    expect(hasAccess(s, now)).toBe(true);
    expect(hasAccess(s, addDays(now, 31))).toBe(false);
  });

  it('expires an unpaid trial', () => {
    const s = applyTimeTransitions(startTrial(now), addDays(now, 30));
    expect(s.status).toBe('EXPIRED');
    expect(hasAccess(s, addDays(now, 30))).toBe(false);
  });

  it('activates on first payment for one month and stores the binding', () => {
    const s = applyPaymentSucceeded(startTrial(now), now, { bindingId: 'b1' });
    expect(s.status).toBe('ACTIVE');
    expect(s.currentPeriodEnd).toEqual(addMonths(now, 1));
    expect(s.bindingId).toBe('b1');
    expect(nextChargeAt(s)).toEqual(addMonths(now, 1));
  });

  it('renews from the previous period end', () => {
    const active = applyPaymentSucceeded(startTrial(now), now, { bindingId: 'b1' });
    const due = active.currentPeriodEnd!;
    expect(isChargeDue(active, due)).toBe(true);
    const renewed = applyPaymentSucceeded(active, addDays(due, 0));
    expect(renewed.currentPeriodEnd).toEqual(addMonths(due, 1));
  });

  it('retries on days 1, 3, 5 then expires', () => {
    let s = applyPaymentSucceeded(startTrial(now), now, { bindingId: 'b1' });
    const due = s.currentPeriodEnd!;
    s = applyRenewalFailed(s, due);
    expect(s.status).toBe('PAST_DUE');
    expect(hasAccess(s, due)).toBe(true);
    expect(nextChargeAt(s)).toEqual(addDays(startOfUtcDay(due), 1));
    expect(isChargeDue(s, addDays(startOfUtcDay(due), 1))).toBe(true);
    s = applyRenewalFailed(s, addDays(due, 1));
    expect(nextChargeAt(s)).toEqual(addDays(startOfUtcDay(due), 3));
    s = applyRenewalFailed(s, addDays(due, 3));
    expect(nextChargeAt(s)).toEqual(addDays(startOfUtcDay(due), 5));
    s = applyRenewalFailed(s, addDays(due, 5));
    expect(s.status).toBe('EXPIRED');
    expect(nextChargeAt(s)).toBeNull();
  });

  it('a retry success restores ACTIVE', () => {
    let s = applyPaymentSucceeded(startTrial(now), now, { bindingId: 'b1' });
    const due = s.currentPeriodEnd!;
    s = applyRenewalFailed(s, due);
    s = applyPaymentSucceeded(s, addDays(due, 1));
    expect(s.status).toBe('ACTIVE');
    expect(s.failedAttempts).toBe(0);
    expect(s.currentPeriodEnd).toEqual(addMonths(due, 1));
  });

  it('cancel keeps access until period end, then expires and stops charging', () => {
    let s = applyPaymentSucceeded(startTrial(now), now, { bindingId: 'b1' });
    s = applyCancel(s);
    expect(s.cancelAtPeriodEnd).toBe(true);
    expect(nextChargeAt(s)).toBeNull();
    expect(hasAccess(s, addDays(now, 10))).toBe(true);
    s = applyTimeTransitions(s, s.currentPeriodEnd!);
    expect(s.status).toBe('EXPIRED');
  });

  it('clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
});
