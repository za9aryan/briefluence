import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  applicationsLeft,
  applyCancel,
  applyPaymentSucceeded,
  applyRenewalFailed,
  applyTimeTransitions,
  basicWindowStart,
  canCheckout,
  effectiveTier,
  isChargeDue,
  nextChargeAt,
  planSegment,
  startPlan,
  trialDaysLeft,
} from './subscription';

const now = new Date('2026-10-15T09:00:00Z');
const day = (n: number) => addDays(now, n);

describe('plans', () => {
  it('every plan starts with 30 free Pro days', () => {
    const s = startPlan(now, 'BASIC');
    expect(s).toMatchObject({ status: 'TRIALING', planCode: 'BASIC' });
    expect(trialDaysLeft(s, now)).toBe(30);
    expect(effectiveTier(s, now)).toBe('PRO');
    expect(planSegment(s, now)).toBe('TRIAL');
  });

  it('Basic chosen: after the free days the blogger is on Basic, not expired', () => {
    const s = applyTimeTransitions(startPlan(now, 'BASIC'), day(30));
    expect(s).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC', basicSince: day(30) });
    expect(effectiveTier(s, day(31))).toBe('BASIC');
    expect(planSegment(s, day(31))).toBe('BASIC');
  });

  it('Pro chosen and paid on day 1: the paid month starts after the free days', () => {
    const paid = applyPaymentSucceeded(startPlan(now, 'PRO_MONTHLY'), day(1), 'PRO_MONTHLY', {
      bindingId: 'b1',
    });
    expect(paid).toMatchObject({ status: 'ACTIVE', planCode: 'PRO_MONTHLY', bindingId: 'b1' });
    expect(paid.currentPeriodEnd).toEqual(addMonths(day(30), 1));
    expect(effectiveTier(paid, day(40))).toBe('PRO');
    expect(planSegment(paid, day(2))).toBe('PRO');
    expect(canCheckout(paid, day(2))).toBe(false);
  });

  it('yearly plan runs 12 months and renews from the period end', () => {
    const basic = applyTimeTransitions(startPlan(now, 'BASIC'), day(30));
    const yearly = applyPaymentSucceeded(basic, day(40), 'PRO_YEARLY', { bindingId: 'b' });
    expect(yearly.currentPeriodEnd).toEqual(addMonths(day(40), 12));
    expect(isChargeDue(yearly, addMonths(day(40), 12))).toBe(true);
    const renewed = applyPaymentSucceeded(yearly, addMonths(day(40), 12), 'PRO_YEARLY');
    expect(renewed.currentPeriodEnd).toEqual(addMonths(day(40), 24));
  });

  it('Pro chosen but never paid: Basic after the free days, nothing is charged', () => {
    const s = startPlan(now, 'PRO_MONTHLY');
    expect(nextChargeAt(s)).toBeNull();
    expect(applyTimeTransitions(s, day(30))).toMatchObject({ planCode: 'BASIC', status: 'ACTIVE' });
  });

  it('failed renewals retry on days 1, 3, 5, then move to Basic', () => {
    let s = applyPaymentSucceeded(startPlan(now, 'BASIC'), day(31), 'PRO_MONTHLY', {
      bindingId: 'b',
    });
    const due = s.currentPeriodEnd!;
    s = applyRenewalFailed(s, due);
    expect(s.status).toBe('PAST_DUE');
    expect(effectiveTier(s, due)).toBe('PRO'); // keeps Pro during retries
    s = applyRenewalFailed(applyRenewalFailed(s, due), due);
    expect(s.status).toBe('PAST_DUE');
    s = applyRenewalFailed(s, due);
    expect(s).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC' });
  });

  it('cancel: during free days the plan becomes Basic; a paid period keeps Pro until it ends', () => {
    expect(applyCancel(startPlan(now, 'PRO_YEARLY'), now)).toMatchObject({
      status: 'TRIALING',
      planCode: 'BASIC',
    });
    const paid = applyPaymentSucceeded(
      applyTimeTransitions(startPlan(now, 'BASIC'), day(30)),
      day(31),
      'PRO_MONTHLY',
      { bindingId: 'b' },
    );
    const cancelled = applyCancel(paid, day(32));
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(nextChargeAt(cancelled)).toBeNull();
    expect(effectiveTier(cancelled, day(40))).toBe('PRO');
    expect(applyTimeTransitions(cancelled, paid.currentPeriodEnd!)).toMatchObject({
      planCode: 'BASIC',
    });
  });

  it('Basic limit counts the last 30 days, but only since Basic started', () => {
    const basic = applyTimeTransitions(startPlan(now, 'BASIC'), day(30));
    expect(basicWindowStart(basic, day(35))).toEqual(day(30));
    expect(basicWindowStart(basic, day(90))).toEqual(day(60));
    expect(applicationsLeft('BASIC', 10, 4)).toBe(6);
    expect(applicationsLeft('BASIC', 10, 12)).toBe(0);
    expect(applicationsLeft('PRO', 10, 50)).toBeNull();
  });

  it('old expired subscriptions become Basic', () => {
    const old = { ...startPlan(now, 'PRO_MONTHLY'), status: 'EXPIRED' as const };
    expect(applyTimeTransitions(old, now)).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC' });
  });

  it('clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
