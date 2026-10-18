import { PLAN_WINDOW_DAYS, RENEWAL_RETRY_DAYS, TRIAL_DAYS } from '../constants';
import type { PlanCode, SubscriptionStatus } from '../enums';

/**
 * Blogger plans:
 * - BASIC: free, limited number of applications per rolling 30 days (limit set by admin).
 * - PRO_MONTHLY / PRO_YEARLY: paid, unlimited.
 * Everyone who chooses a plan first gets TRIAL_DAYS of Pro for free. `planCode` is the plan the
 * blogger chose (or is on); when free days or a paid period end without payment they move to
 * BASIC — nobody "expires" any more.
 */
export type PlanTier = 'BASIC' | 'PRO';

/** Length of one paid period per plan, in months (BASIC is never charged). */
export const PLAN_MONTHS: Record<PlanCode, number> = { BASIC: 0, PRO_MONTHLY: 1, PRO_YEARLY: 12 };

export const isPaidPlan = (code: PlanCode) => code !== 'BASIC';

export interface SubscriptionState {
  status: SubscriptionStatus;
  planCode: PlanCode;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  bindingId: string | null;
  /** Consecutive failed renewal charges (0 when healthy). */
  failedAttempts: number;
  /** When the first renewal charge failed; retries are scheduled from this date. */
  pastDueSince: Date | null;
  /** When the blogger moved to Basic; Basic's limit only counts applications from then on. */
  basicSince: Date | null;
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

/** The blogger chose a plan: free Pro days start now, whatever they chose. */
export function startPlan(now: Date, planCode: PlanCode): SubscriptionState {
  return {
    status: 'TRIALING',
    planCode,
    trialEndsAt: addDays(now, TRIAL_DAYS),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    bindingId: null,
    failedAttempts: 0,
    pastDueSince: null,
    basicSince: null,
  };
}

/** Back to the free plan (keeps the saved card so upgrading again is one click). */
export function toBasic(s: SubscriptionState, now: Date): SubscriptionState {
  return {
    ...s,
    status: 'ACTIVE',
    planCode: 'BASIC',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    failedAttempts: 0,
    pastDueSince: null,
    basicSince:
      s.planCode === 'BASIC' && s.status === 'ACTIVE' && s.basicSince ? s.basicSince : now,
  };
}

export const inFreeDays = (s: SubscriptionState, now: Date) =>
  s.status === 'TRIALING' && s.trialEndsAt.getTime() > now.getTime();

/** A paid Pro period is running (including the retry window and a cancelled-but-not-ended period). */
export function hasPaidPro(s: SubscriptionState, now: Date): boolean {
  if (!isPaidPlan(s.planCode)) return false;
  if (s.status === 'PAST_DUE') return true;
  return (
    (s.status === 'ACTIVE' || s.status === 'CANCELED') &&
    s.currentPeriodEnd != null &&
    s.currentPeriodEnd.getTime() > now.getTime()
  );
}

/** What the blogger gets right now: Pro during free days or a paid period, otherwise Basic. */
export function effectiveTier(s: SubscriptionState, now: Date): PlanTier {
  return inFreeDays(s, now) || hasPaidPro(s, now) ? 'PRO' : 'BASIC';
}

/** Whether the blogger may apply at all: they chose a plan (Basic limits are checked separately). */
export function hasAccess(s: SubscriptionState | null, _now?: Date): boolean {
  return s != null;
}

export function trialDaysLeft(
  s: Pick<SubscriptionState, 'status' | 'trialEndsAt'>,
  now: Date,
): number {
  if (s.status !== 'TRIALING') return 0;
  return Math.max(0, Math.ceil((s.trialEndsAt.getTime() - now.getTime()) / DAY));
}

/**
 * First payment for a Pro plan or a successful renewal. Paying during the free days does not
 * waste them: the paid period starts when the free days end.
 */
export function applyPaymentSucceeded(
  s: SubscriptionState,
  now: Date,
  planCode: PlanCode,
  binding?: { bindingId: string },
): SubscriptionState {
  const months = PLAN_MONTHS[planCode] || 1;
  const isRenewal =
    (s.status === 'ACTIVE' || s.status === 'PAST_DUE') &&
    s.planCode === planCode &&
    s.currentPeriodEnd != null;
  const freeDaysLeft = inFreeDays(s, now);
  const start = isRenewal ? s.currentPeriodEnd! : freeDaysLeft ? s.trialEndsAt : now;
  let periodEnd = addMonths(start, months);
  if (periodEnd.getTime() <= now.getTime()) periodEnd = addMonths(now, months);
  return {
    ...s,
    status: 'ACTIVE',
    planCode,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    bindingId: binding?.bindingId ?? s.bindingId,
    failedAttempts: 0,
    pastDueSince: null,
    basicSince: null,
  };
}

/** A renewal charge failed. After the last retry the blogger moves to Basic. */
export function applyRenewalFailed(s: SubscriptionState, now: Date): SubscriptionState {
  const failedAttempts = s.failedAttempts + 1;
  if (failedAttempts > RENEWAL_RETRY_DAYS.length) return toBasic(s, now);
  return { ...s, status: 'PAST_DUE', failedAttempts, pastDueSince: s.pastDueSince ?? now };
}

/** When the next renewal charge should be attempted, or null if none is due. */
export function nextChargeAt(s: SubscriptionState): Date | null {
  if (!s.bindingId || !isPaidPlan(s.planCode)) return null;
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
 * Time-based transitions run by the daily job: free days over without payment, or a paid period
 * over that will not renew (cancelled or no card) → Basic. Older EXPIRED / ended CANCELED → Basic.
 */
export function applyTimeTransitions(s: SubscriptionState, now: Date): SubscriptionState {
  const t = now.getTime();
  if (s.status === 'TRIALING' && s.trialEndsAt.getTime() <= t) return toBasic(s, now);
  if (s.status === 'EXPIRED') return toBasic(s, now);
  if (s.status === 'CANCELED' && (!s.currentPeriodEnd || s.currentPeriodEnd.getTime() <= t))
    return toBasic(s, now);
  if (
    s.status === 'ACTIVE' &&
    isPaidPlan(s.planCode) &&
    s.currentPeriodEnd &&
    s.currentPeriodEnd.getTime() <= t
  ) {
    if (s.cancelAtPeriodEnd || !s.bindingId) return toBasic(s, now);
  }
  return s;
}

/**
 * Cancel Pro: a paid period keeps Pro until it ends, then Basic; during the free days the
 * chosen plan simply becomes Basic (nothing is ever charged).
 */
export function applyCancel(s: SubscriptionState, now: Date): SubscriptionState {
  if (s.status === 'TRIALING') return { ...s, planCode: 'BASIC' };
  if (s.status === 'ACTIVE' && isPaidPlan(s.planCode)) return { ...s, cancelAtPeriodEnd: true };
  if (s.status === 'PAST_DUE') return toBasic(s, now);
  return s;
}

export function applyResume(s: SubscriptionState): SubscriptionState {
  if (s.status === 'ACTIVE' && s.cancelAtPeriodEnd) return { ...s, cancelAtPeriodEnd: false };
  return s;
}

/** Whether the blogger can buy a Pro plan right now (not while a paid period is running). */
export function canCheckout(s: SubscriptionState | null, now: Date = new Date()): boolean {
  if (!s) return false;
  if (s.status === 'PAST_DUE') return true;
  return !hasPaidPro(s, now);
}

/** Start of the window Basic's limit counts in: the last 30 days, but not before Basic began. */
export function basicWindowStart(s: SubscriptionState, now: Date): Date {
  const window = addDays(now, -PLAN_WINDOW_DAYS);
  return s.basicSince && s.basicSince.getTime() > window.getTime() ? s.basicSince : window;
}

/** Applications left this window, or null when unlimited (Pro). */
export function applicationsLeft(
  tier: PlanTier,
  limit: number | null,
  used: number,
): number | null {
  if (tier === 'PRO' || limit == null) return null;
  return Math.max(0, limit - used);
}

export type PlanSegment = 'TRIAL' | 'PRO' | 'BASIC' | 'NONE';

/** Analytics bucket: free Pro days, paid Pro, Basic, or no plan chosen yet. */
export function planSegment(s: SubscriptionState | null, now: Date): PlanSegment {
  if (!s) return 'NONE';
  if (hasPaidPro(s, now)) return 'PRO';
  if (inFreeDays(s, now)) return 'TRIAL';
  return 'BASIC';
}
