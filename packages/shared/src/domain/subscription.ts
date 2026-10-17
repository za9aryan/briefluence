import { RENEWAL_RETRY_DAYS, TRIAL_DAYS } from '../constants';
import type { SubscriptionStatus } from '../enums';

export interface SubscriptionState {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  bindingId: string | null;
  /** Consecutive failed renewal charges (0 when healthy). */
  failedAttempts: number;
  /** When the first renewal charge failed; retries are scheduled from this date. */
  pastDueSince: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC of the given instant. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

/** Calendar month arithmetic in UTC; clamps Jan 31 + 1 month to the last day of Feb. */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
}

export function startTrial(now: Date): SubscriptionState {
  return {
    status: 'TRIALING',
    trialEndsAt: addDays(now, TRIAL_DAYS),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    bindingId: null,
    failedAttempts: 0,
    pastDueSince: null,
  };
}

/**
 * Whether the influencer may apply to deals right now. PAST_DUE keeps access during the
 * retry window (days 1, 3, 5) so a temporary card problem does not lock them out.
 * CANCELED keeps access until the paid period ends.
 */
export function hasAccess(s: SubscriptionState | null, now: Date): boolean {
  if (!s) return false;
  switch (s.status) {
    case 'TRIALING':
      return s.trialEndsAt.getTime() > now.getTime();
    case 'ACTIVE':
    case 'PAST_DUE':
      return true;
    case 'CANCELED':
      return s.currentPeriodEnd != null && s.currentPeriodEnd.getTime() > now.getTime();
    case 'EXPIRED':
      return false;
  }
}

export function trialDaysLeft(s: Pick<SubscriptionState, 'status' | 'trialEndsAt'>, now: Date): number {
  if (s.status !== 'TRIALING') return 0;
  return Math.max(0, Math.ceil((s.trialEndsAt.getTime() - now.getTime()) / DAY));
}

/** First payment (checkout) or a successful renewal. */
export function applyPaymentSucceeded(
  s: SubscriptionState,
  now: Date,
  binding?: { bindingId: string },
): SubscriptionState {
  // A renewal (ACTIVE / PAST_DUE) extends from the previous period end so the billing date
  // stays stable; a first checkout (trial, canceled, expired) starts the period now.
  const isRenewal = (s.status === 'ACTIVE' || s.status === 'PAST_DUE') && s.currentPeriodEnd != null;
  let periodEnd = addMonths(isRenewal ? s.currentPeriodEnd! : now, 1);
  if (periodEnd.getTime() <= now.getTime()) periodEnd = addMonths(now, 1);
  return {
    ...s,
    status: 'ACTIVE',
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    bindingId: binding?.bindingId ?? s.bindingId,
    failedAttempts: 0,
    pastDueSince: null,
  };
}

/** A renewal charge failed. After the last retry the subscription expires. */
export function applyRenewalFailed(s: SubscriptionState, now: Date): SubscriptionState {
  const failedAttempts = s.failedAttempts + 1;
  if (failedAttempts > RENEWAL_RETRY_DAYS.length) {
    return { ...s, status: 'EXPIRED', failedAttempts, pastDueSince: s.pastDueSince ?? now };
  }
  return { ...s, status: 'PAST_DUE', failedAttempts, pastDueSince: s.pastDueSince ?? now };
}

/** When the next renewal charge should be attempted, or null if none is due. */
export function nextChargeAt(s: SubscriptionState): Date | null {
  if (!s.bindingId) return null;
  if (s.status === 'ACTIVE' && !s.cancelAtPeriodEnd) return s.currentPeriodEnd;
  if (s.status === 'PAST_DUE' && s.pastDueSince) {
    const retryDay = RENEWAL_RETRY_DAYS[s.failedAttempts - 1];
    // Retries are calendar days, so a daily job running at a fixed hour never slips a day
    // because the first failure happened a few seconds after that hour.
    return retryDay == null ? null : addDays(startOfUtcDay(s.pastDueSince), retryDay);
  }
  return null;
}

export function isChargeDue(s: SubscriptionState, now: Date): boolean {
  const at = nextChargeAt(s);
  return at != null && at.getTime() <= now.getTime();
}

/**
 * Time-based transitions run by the daily job: trial over without payment, canceled period
 * over, or active period over without a card to charge.
 */
export function applyTimeTransitions(s: SubscriptionState, now: Date): SubscriptionState {
  const t = now.getTime();
  if (s.status === 'TRIALING' && s.trialEndsAt.getTime() <= t) return { ...s, status: 'EXPIRED' };
  if (s.status === 'CANCELED' && (!s.currentPeriodEnd || s.currentPeriodEnd.getTime() <= t)) {
    return { ...s, status: 'EXPIRED' };
  }
  if (s.status === 'ACTIVE' && s.currentPeriodEnd && s.currentPeriodEnd.getTime() <= t) {
    if (s.cancelAtPeriodEnd) return { ...s, status: 'EXPIRED' };
    if (!s.bindingId) return { ...s, status: 'EXPIRED' };
  }
  return s;
}

export function applyCancel(s: SubscriptionState): SubscriptionState {
  if (s.status === 'ACTIVE') return { ...s, cancelAtPeriodEnd: true };
  if (s.status === 'PAST_DUE') return { ...s, status: 'EXPIRED', cancelAtPeriodEnd: true };
  return s;
}

export function applyResume(s: SubscriptionState): SubscriptionState {
  if (s.status === 'ACTIVE' && s.cancelAtPeriodEnd) return { ...s, cancelAtPeriodEnd: false };
  return s;
}

/** Whether a checkout (first payment / resubscribe) is allowed right now. */
export function canCheckout(s: SubscriptionState | null): boolean {
  if (!s) return false;
  return s.status === 'TRIALING' || s.status === 'EXPIRED' || s.status === 'PAST_DUE' || s.status === 'CANCELED';
}
