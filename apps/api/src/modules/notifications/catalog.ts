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
  TRIAL_ENDING: 'instant',
  PAYMENT_SUCCEEDED: 'instant',
  PAYMENT_FAILED: 'instant',
  SUBSCRIPTION_EXPIRED: 'instant',
  SOCIAL_TOKEN_REVOKED: 'instant',
  POST_SUBMITTED: 'none',
};

export const CTA_LABEL: Partial<Record<NotificationType, string>> = {
  VERIFICATION_APPROVED: 'Browse deals',
  VERIFICATION_REJECTED: 'Update your profile',
  VERIFICATION_PENDING: 'Open review queue',
  APPLICATION_ACCEPTED: 'See contacts',
  APPLICATION_REJECTED: 'Find other deals',
  TRIAL_ENDING: 'Subscribe',
  PAYMENT_SUCCEEDED: 'View billing',
  PAYMENT_FAILED: 'Update card',
  SUBSCRIPTION_EXPIRED: 'Resubscribe',
  SOCIAL_TOKEN_REVOKED: 'Reconnect account',
};
