import type { SubscriptionState } from '@briefluence/shared';
import type { Subscription } from '@prisma/client';

/** Database row ↔ the pure subscription state the shared domain functions work on. */
export const toState = (s: Subscription): SubscriptionState => ({
  status: s.status,
  planCode: s.planCode,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
  basicSince: s.basicSince,
  nextPlanCode: s.nextPlanCode ?? null,
});

export const fromState = (s: SubscriptionState) => ({
  status: s.status,
  planCode: s.planCode,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
  basicSince: s.basicSince,
  nextPlanCode: s.nextPlanCode ?? null,
});
