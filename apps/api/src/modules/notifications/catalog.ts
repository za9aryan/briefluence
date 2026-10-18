import type { NotificationType } from '@briefluence/shared';

/**
 * Email policy per event, from the spec's Notifications table.
 * - instant: transactional email right away (cannot be switched off)
 * - digest: only part of a daily digest email (respects the user's digest setting)
 * - none: in-app only
 */
export const EMAIL_POLICY: Record<NotificationType, 'instant' | 'digest' | 'none'> = {
  VERIFICATION_APPROVED: 'instant',
  VERIFICATION_REJECTED: 'instant',
  VERIFICATION_PENDING: 'instant',
  NEW_MATCHING_DEALS: 'digest',
  APPLICATION_VIEWED: 'none',
  APPLICATION_SHORTLISTED: 'none',
  APPLICATION_ACCEPTED: 'instant',
  APPLICATION_REJECTED: 'instant',
  APPLICATION_COMPLETED: 'none',
  NEW_APPLICANT: 'digest',
  DEAL_FILLED: 'none',
  DEAL_EXPIRED: 'none',
  DEAL_REVIEW_PENDING: 'instant',
  DEAL_APPROVED: 'instant',
  DEAL_REJECTED: 'instant',
  SOCIAL_ACCOUNT_PENDING: 'instant',
  SOCIAL_ACCOUNT_APPROVED: 'instant',
  SOCIAL_ACCOUNT_REJECTED: 'instant',
  SOCIAL_ACCOUNT_REUSED: 'instant',
  TRIAL_ENDING: 'instant',
  PAYMENT_SUCCEEDED: 'instant',
  PAYMENT_FAILED: 'instant',
  SUBSCRIPTION_EXPIRED: 'instant',
  SOCIAL_TOKEN_REVOKED: 'instant',
  POST_SUBMITTED: 'none',
};
