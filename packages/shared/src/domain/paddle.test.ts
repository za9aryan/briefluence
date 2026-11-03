import { describe, expect, it } from 'vitest';
import { applyPaddleSubscription, isNewerEvent, paddleAmountMinor, paddleLocale } from './paddle';
import { effectiveTier, renewalState, startPlan, type SubscriptionState } from './subscription';

const now = new Date('2026-11-03T12:00:00Z');
const end = new Date('2026-12-03T12:00:00Z');
const trial = (): SubscriptionState => startPlan(new Date('2026-11-01T12:00:00Z'), 'PRO_MONTHLY');

describe('Paddle subscription mirror', () => {
  it('active: paid Pro until the period ends, renews automatically', () => {
    const s = applyPaddleSubscription(
      trial(),
      { id: 'sub_1', status: 'active', periodEndsAt: end, cancelScheduled: false },
      'PRO_MONTHLY',
      now,
    );
    expect(s).toMatchObject({
      status: 'ACTIVE',
      planCode: 'PRO_MONTHLY',
      currentPeriodEnd: end,
      bindingId: 'sub_1',
      cancelAtPeriodEnd: false,
    });
    expect(effectiveTier(s, now)).toBe('PRO');
    expect(renewalState(s, now)).toBe('renews');
  });

  it('a scheduled cancel keeps Pro to the end, renewal off', () => {
    const s = applyPaddleSubscription(
      trial(),
      { id: 'sub_1', status: 'active', periodEndsAt: end, cancelScheduled: true },
      'PRO_YEARLY',
      now,
    );
    expect(renewalState(s, now)).toBe('ends');
    expect(s.planCode).toBe('PRO_YEARLY');
  });

  it('past due keeps Pro while Paddle retries; canceled moves to Basic', () => {
    const active = applyPaddleSubscription(
      trial(),
      { id: 'sub_1', status: 'active', periodEndsAt: end, cancelScheduled: false },
      'PRO_MONTHLY',
      now,
    );
    const due = applyPaddleSubscription(
      active,
      { id: 'sub_1', status: 'past_due', periodEndsAt: end, cancelScheduled: false },
      'PRO_MONTHLY',
      now,
    );
    expect(due).toMatchObject({ status: 'PAST_DUE', failedAttempts: 1, pastDueSince: now });
    expect(effectiveTier(due, now)).toBe('PRO');
    const gone = applyPaddleSubscription(
      due,
      { id: 'sub_1', status: 'canceled', periodEndsAt: null, cancelScheduled: false },
      'PRO_MONTHLY',
      now,
    );
    expect(gone).toMatchObject({
      status: 'ACTIVE',
      planCode: 'BASIC',
      bindingId: null,
      basicSince: now,
    });
    expect(effectiveTier(gone, now)).toBe('BASIC');
  });

  it('applies only newer events; parses amounts; picks a checkout language', () => {
    expect(isNewerEvent(null, now)).toBe(true);
    expect(isNewerEvent(now, new Date(now.getTime() - 1000))).toBe(false);
    expect(paddleAmountMinor('999')).toBe(999);
    expect(paddleAmountMinor(undefined)).toBe(0);
    expect(paddleLocale('ru')).toBe('ru');
    expect(paddleLocale('hy')).toBe('en');
  });

  it('demo mode: free Pro can be shorter than 30 days', () => {
    const s = startPlan(now, 'BASIC', 60 * 60 * 1000);
    expect(s.trialEndsAt.toISOString()).toBe('2026-11-03T13:00:00.000Z');
  });
});
