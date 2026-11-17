import { PLAN_WINDOW_DAYS, RENEWAL_RETRY_DAYS, TRIAL_DAYS } from '../constants';
import type { PlanCode, SubscriptionStatus } from '../enums';

/**
 * Blogger plans:
 * - BASIC: free, limited number of applications per rolling 30 days (limit set by admin).
 * - PRO_MONTHLY / PRO_YEARLY: paid, unlimited. PRO_DAILY: the same, renews daily (sandbox test).
 * Every account can activate one free month of Pro (TRIAL_DAYS) whenever it wants, no card. Paying
 * for Pro during the free month ends it: the paid period starts on the day of payment. When free
 * days or a paid period end without payment the blogger moves to BASIC.
 */
export type PlanTier = 'BASIC' | 'PRO';

/** Length of one paid period per plan, in months (BASIC is never charged). */
export const PLAN_MONTHS: Record<PlanCode, number> = {
  BASIC: 0,
  PRO_DAILY: 0,
  PRO_MONTHLY: 1,
  PRO_YEARLY: 12,
};

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
  /** Pro plan to switch to at the next renewal (monthly ↔ yearly); null = keep the current one. */
  nextPlanCode?: PlanCode | null;
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

/** The blogger chose Basic: free, from now on (Pro is bought separately). */
export function startBasic(now: Date): SubscriptionState {
  return {
    status: 'ACTIVE',
    planCode: 'BASIC',
    trialEndsAt: now,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    bindingId: null,
    failedAttempts: 0,
    pastDueSince: null,
    basicSince: now,
    nextPlanCode: null,
  };
}

/**
 * The one free month of Pro can be activated once per account, and not while Pro is already
 * running (free days or a paid period). `usedAt` is when it was activated before (or null).
 */
export function canActivateFreePro(
  s: SubscriptionState | null,
  usedAt: Date | null,
  now: Date,
): boolean {
  if (usedAt) return false;
  return !s || (!inFreeDays(s, now) && !hasPaidPro(s, now));
}

/**
 * Activates the free month: Pro for `freeMs` (TRIAL_DAYS; 1 hour in the Paddle sandbox demo),
 * then Basic. Nothing is ever charged. Call only when `canActivateFreePro` is true.
 */
export function activateFreePro(
  s: SubscriptionState | null,
  now: Date,
  freeMs: number = TRIAL_DAYS * DAY,
): SubscriptionState {
  const base = s ?? startBasic(now);
  return {
    ...base,
    status: 'TRIALING',
    planCode: 'BASIC',
    trialEndsAt: new Date(now.getTime() + freeMs),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    failedAttempts: 0,
    pastDueSince: null,
    nextPlanCode: null,
  };
}

/**
 * Whole days of free Pro the blogger gives up by paying now (shown before checkout). 0 when not
 * in free days. Shorter than a day (sandbox demo) still counts as 1 so the warning shows.
 */
export function freeDaysLostByPaying(s: SubscriptionState | null, now: Date): number {
  return s && inFreeDays(s, now) ? Math.max(1, trialDaysLeft(s, now)) : 0;
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
    nextPlanCode: null,
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
 * First payment for a Pro plan or a successful renewal. Paying during the free month ends it: the
 * paid period starts now (the blogger was warned before paying).
 */
export function applyPaymentSucceeded(
  s: SubscriptionState,
  now: Date,
  planCode: PlanCode,
  binding?: { bindingId: string },
): SubscriptionState {
  const months = PLAN_MONTHS[planCode] || 1;
  // A running paid period (renewal, scheduled switch, or renewing without a card): the new
  // period starts where the paid one ends, so no paid days are lost.
  const paidRunning =
    (s.status === 'ACTIVE' || s.status === 'PAST_DUE') &&
    isPaidPlan(s.planCode) &&
    s.currentPeriodEnd != null;
  const start = paidRunning ? s.currentPeriodEnd! : now;
  const add = (d: Date) => (planCode === 'PRO_DAILY' ? addDays(d, 1) : addMonths(d, months));
  let periodEnd = add(start);
  if (periodEnd.getTime() <= now.getTime()) periodEnd = add(now);
  return {
    ...endFreeDays(s, now),
    status: 'ACTIVE',
    planCode,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    bindingId: binding?.bindingId ?? s.bindingId,
    failedAttempts: 0,
    pastDueSince: null,
    basicSince: null,
    nextPlanCode: null,
  };
}

/** Free days that are still running end now (Pro was bought); other states are unchanged. */
export function endFreeDays(s: SubscriptionState, now: Date): SubscriptionState {
  return inFreeDays(s, now) ? { ...s, trialEndsAt: now } : s;
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
 * Cancel Pro: a paid period keeps Pro until it ends, then Basic. The free month needs no
 * cancelling (nothing is ever charged); it just runs out.
 */
export function applyCancel(s: SubscriptionState, now: Date): SubscriptionState {
  if (s.status === 'TRIALING') return { ...s, planCode: 'BASIC' };
  if (s.status === 'ACTIVE' && isPaidPlan(s.planCode))
    return { ...s, cancelAtPeriodEnd: true, nextPlanCode: null };
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
  return !hasPaidPro(s, now) || needsCardToRenew(s, now);
}

/**
 * Pro is paid but will not renew because there is no saved card (it was removed). Paying again
 * buys the next period (it starts when the current one ends) and saves the new card.
 */
export function needsCardToRenew(s: SubscriptionState, now: Date): boolean {
  return s.status === 'ACTIVE' && hasPaidPro(s, now) && s.cancelAtPeriodEnd && !s.bindingId;
}

/** How a paid Pro plan continues: renews with the card, ends (renewal off), or n/a. */
export function renewalState(s: SubscriptionState, now: Date): 'renews' | 'ends' | null {
  if (!hasPaidPro(s, now) || s.status !== 'ACTIVE') return null;
  return s.cancelAtPeriodEnd || !s.bindingId ? 'ends' : 'renews';
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

/** The plan the next renewal charges (a scheduled switch, or the current plan). */
export function nextChargePlan(s: SubscriptionState): PlanCode {
  return s.nextPlanCode ?? s.planCode;
}

/**
 * Switch between Pro monthly and yearly while Pro is paid and a card is saved: takes effect at
 * the next renewal (no double charge, no refunds). Choosing the current plan undoes a pending
 * switch. Also turns renewal back on, since the blogger clearly wants to continue.
 */
export function scheduleSwitch(
  s: SubscriptionState,
  planCode: PlanCode,
  now: Date,
): SubscriptionState | null {
  if (!isPaidPlan(planCode) || !hasPaidPro(s, now) || s.status !== 'ACTIVE' || !s.bindingId)
    return null;
  return {
    ...s,
    nextPlanCode: planCode === s.planCode ? null : planCode,
    cancelAtPeriodEnd: false,
  };
}
