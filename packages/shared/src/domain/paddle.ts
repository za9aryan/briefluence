import type { PlanCode } from '../enums';
import { toBasic, type SubscriptionState } from './subscription';

/**
 * Paddle Billing runs the subscription (charges, retries, cancel, plan changes); our row mirrors
 * it from webhooks. Statuses: https://developer.paddle.com/webhooks/subscriptions/subscription-updated
 */
export type PaddleSubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';

export interface PaddleSubscriptionView {
  /** Paddle subscription id (sub_…). */
  id: string;
  status: PaddleSubscriptionStatus;
  /** `current_billing_period.ends_at`; null for paused / canceled. */
  periodEndsAt: Date | null;
  /** `scheduled_change.action === 'cancel'`: renewal is off, Pro ends with the period. */
  cancelScheduled: boolean;
}

/**
 * Our subscription state after a Paddle subscription event. Active (and Paddle trials, which we
 * don't use) → paid Pro until the period ends; past due → Pro while Paddle retries; canceled or
 * paused → Basic. `bindingId` holds the Paddle subscription id: "renews automatically".
 */
export function applyPaddleSubscription(
  s: SubscriptionState,
  p: PaddleSubscriptionView,
  planCode: PlanCode,
  now: Date,
): SubscriptionState {
  if (p.status === 'canceled' || p.status === 'paused')
    return { ...toBasic(s, now), bindingId: null };
  const base: SubscriptionState = {
    ...s,
    planCode,
    bindingId: p.id,
    currentPeriodEnd: p.periodEndsAt ?? s.currentPeriodEnd,
    cancelAtPeriodEnd: p.cancelScheduled,
    basicSince: null,
    nextPlanCode: null,
  };
  if (p.status === 'past_due')
    return {
      ...base,
      status: 'PAST_DUE',
      failedAttempts: Math.max(1, s.failedAttempts),
      pastDueSince: s.pastDueSince ?? now,
    };
  return { ...base, status: 'ACTIVE', failedAttempts: 0, pastDueSince: null };
}

/** Webhooks can arrive out of order: only apply events newer than the last one applied. */
export function isNewerEvent(lastAppliedAt: Date | null, occurredAt: Date): boolean {
  return !lastAppliedAt || occurredAt.getTime() >= lastAppliedAt.getTime();
}

/** Paddle amounts are strings in the lowest denomination ("999" = $9.99). */
export function paddleAmountMinor(value: string | null | undefined): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Paddle checkout languages we can use (it has no Armenian): Russian, else English. */
export function paddleLocale(uiLocale: string | null | undefined): 'en' | 'ru' {
  return uiLocale === 'ru' ? 'ru' : 'en';
}
