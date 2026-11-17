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
  needsCardToRenew,
  nextChargePlan,
  scheduleSwitch,
  renewalState,
  nextChargeAt,
  planSegment,
  activateFreePro,
  canActivateFreePro,
  freeDaysLostByPaying,
  startBasic,
  trialDaysLeft,
} from './subscription';

const now = new Date('2026-10-15T09:00:00Z');
const day = (n: number) => addDays(now, n);

describe('plans', () => {
  it('Basic is free from the start: no free Pro unless the blogger activates it', () => {
    const s = startBasic(now);
    expect(s).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC', basicSince: now });
    expect(effectiveTier(s, now)).toBe('BASIC');
    expect(trialDaysLeft(s, now)).toBe(0);
    expect(freeDaysLostByPaying(s, now)).toBe(0);
  });

  it('the free month: activated once, any time, 30 days of Pro with nothing charged', () => {
    expect(canActivateFreePro(null, null, now)).toBe(true);
    expect(canActivateFreePro(startBasic(now), null, day(10))).toBe(true);
    const s = activateFreePro(startBasic(now), day(10));
    expect(s).toMatchObject({ status: 'TRIALING', planCode: 'BASIC' });
    expect(trialDaysLeft(s, day(10))).toBe(30);
    expect(effectiveTier(s, day(10))).toBe('PRO');
    expect(planSegment(s, day(10))).toBe('TRIAL');
    expect(nextChargeAt(s)).toBeNull();
    // Running already, used before, or paid Pro: no second free month.
    expect(canActivateFreePro(s, null, day(11))).toBe(false);
    expect(canActivateFreePro(startBasic(now), day(10), day(90))).toBe(false);
    const paid = applyPaymentSucceeded(startBasic(now), now, 'PRO_MONTHLY', { bindingId: 'b' });
    expect(canActivateFreePro(paid, null, day(1))).toBe(false);
    // The sandbox demo makes it short.
    expect(activateFreePro(null, now, 3_600_000).trialEndsAt).toEqual(
      new Date(now.getTime() + 3_600_000),
    );
  });

  it('after the free month the blogger is on Basic, not expired', () => {
    const s = applyTimeTransitions(activateFreePro(null, now), day(30));
    expect(s).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC', basicSince: day(30) });
    expect(effectiveTier(s, day(31))).toBe('BASIC');
    expect(planSegment(s, day(31))).toBe('BASIC');
  });

  it('paying during the free month ends it: the paid month starts on the day of payment', () => {
    const free = activateFreePro(null, now);
    expect(freeDaysLostByPaying(free, day(1))).toBe(29);
    const paid = applyPaymentSucceeded(free, day(1), 'PRO_MONTHLY', {
      bindingId: 'b1',
    });
    expect(paid).toMatchObject({ status: 'ACTIVE', planCode: 'PRO_MONTHLY', bindingId: 'b1' });
    expect(paid.currentPeriodEnd).toEqual(addMonths(day(1), 1));
    expect(paid.trialEndsAt).toEqual(day(1));
    expect(trialDaysLeft(paid, day(1))).toBe(0);
    expect(effectiveTier(paid, day(20))).toBe('PRO');
    expect(planSegment(paid, day(2))).toBe('PRO');
    expect(canCheckout(paid, day(2))).toBe(false);
  });

  it('yearly plan runs 12 months and renews from the period end', () => {
    const basic = applyTimeTransitions(activateFreePro(null, now), day(30));
    const yearly = applyPaymentSucceeded(basic, day(40), 'PRO_YEARLY', { bindingId: 'b' });
    expect(yearly.currentPeriodEnd).toEqual(addMonths(day(40), 12));
    expect(isChargeDue(yearly, addMonths(day(40), 12))).toBe(true);
    const renewed = applyPaymentSucceeded(yearly, addMonths(day(40), 12), 'PRO_YEARLY');
    expect(renewed.currentPeriodEnd).toEqual(addMonths(day(40), 24));
  });

  it('failed renewals retry on days 1, 3, 5, then move to Basic', () => {
    let s = applyPaymentSucceeded(activateFreePro(null, now), day(31), 'PRO_MONTHLY', {
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

  it('cancel: the free month just runs out; a paid period keeps Pro until it ends', () => {
    expect(applyCancel(activateFreePro(null, now), now)).toMatchObject({
      status: 'TRIALING',
      planCode: 'BASIC',
    });
    const paid = applyPaymentSucceeded(
      applyTimeTransitions(activateFreePro(null, now), day(30)),
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
    const basic = applyTimeTransitions(activateFreePro(null, now), day(30));
    expect(basicWindowStart(basic, day(35))).toEqual(day(30));
    expect(basicWindowStart(basic, day(90))).toEqual(day(60));
    expect(applicationsLeft('BASIC', 10, 4)).toBe(6);
    expect(applicationsLeft('BASIC', 10, 12)).toBe(0);
    expect(applicationsLeft('PRO', 10, 50)).toBeNull();
  });

  it('removing the card stops renewal; paying again renews from the current period end', () => {
    const paid = applyPaymentSucceeded(
      applyTimeTransitions(activateFreePro(null, now), day(30)),
      day(31),
      'PRO_MONTHLY',
      { bindingId: 'b' },
    );
    expect(renewalState(paid, day(32))).toBe('renews');
    const noCard = { ...paid, bindingId: null, cancelAtPeriodEnd: true };
    expect(renewalState(noCard, day(32))).toBe('ends');
    expect(needsCardToRenew(noCard, day(32))).toBe(true);
    expect(canCheckout(noCard, day(32))).toBe(true);
    const renewed = applyPaymentSucceeded(noCard, day(33), 'PRO_MONTHLY', { bindingId: 'b2' });
    expect(renewed.currentPeriodEnd).toEqual(addMonths(paid.currentPeriodEnd!, 1)); // no days lost
    expect(renewalState(renewed, day(34))).toBe('renews');
  });

  it('free Pro days are given once: a later upgrade is paid from day one', () => {
    const basic = applyTimeTransitions(activateFreePro(null, now), day(30));
    const pro = applyPaymentSucceeded(basic, day(40), 'PRO_MONTHLY', { bindingId: 'b' });
    expect(pro.currentPeriodEnd).toEqual(addMonths(day(40), 1));
    expect(trialDaysLeft(pro, day(40))).toBe(0);
  });

  it('switches monthly ↔ yearly at the next renewal without losing paid days', () => {
    const monthly = applyPaymentSucceeded(
      applyTimeTransitions(activateFreePro(null, now), day(30)),
      day(31),
      'PRO_MONTHLY',
      { bindingId: 'b' },
    );
    const end = monthly.currentPeriodEnd!;
    const switched = scheduleSwitch(monthly, 'PRO_YEARLY', day(35))!;
    expect(switched).toMatchObject({ planCode: 'PRO_MONTHLY', nextPlanCode: 'PRO_YEARLY' });
    expect(nextChargePlan(switched)).toBe('PRO_YEARLY');
    expect(scheduleSwitch(switched, 'PRO_MONTHLY', day(36))!.nextPlanCode).toBeNull(); // undo
    const renewed = applyPaymentSucceeded(switched, end, nextChargePlan(switched));
    expect(renewed).toMatchObject({ planCode: 'PRO_YEARLY', nextPlanCode: null });
    expect(renewed.currentPeriodEnd).toEqual(addMonths(end, 12));
    // Not possible without a card or for Basic.
    expect(scheduleSwitch({ ...monthly, bindingId: null }, 'PRO_YEARLY', day(35))).toBeNull();
    expect(scheduleSwitch(monthly, 'BASIC', day(35))).toBeNull();
    // Renewing without a card into yearly starts after the paid month.
    const noCard = { ...monthly, bindingId: null, cancelAtPeriodEnd: true };
    expect(
      applyPaymentSucceeded(noCard, day(35), 'PRO_YEARLY', { bindingId: 'b2' }).currentPeriodEnd,
    ).toEqual(addMonths(end, 12));
  });

  it('old expired subscriptions become Basic', () => {
    const old = {
      ...activateFreePro(null, now),
      planCode: 'PRO_MONTHLY' as const,
      status: 'EXPIRED' as const,
    };
    expect(applyTimeTransitions(old, now)).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC' });
  });

  it('clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
