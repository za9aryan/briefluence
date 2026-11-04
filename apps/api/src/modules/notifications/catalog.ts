import type { NotificationType } from '@briefluence/shared';

/**
 * Email policy per event. Every event is always stored in-app and sent as a push.
 * - instant: email right away, even with push on (money and access: cannot be missed)
 * - unless-push: email only when the user has no push device; otherwise the push is enough
 * - digest: only part of a daily digest email (respects the user's digest setting)
 * - none: in-app and push only
 * Admin events are in-app only: admins work in the admin panel.
 */
export const EMAIL_POLICY: Record<NotificationType, 'instant' | 'unless-push' | 'digest' | 'none'> =
  {
    VERIFICATION_APPROVED: 'unless-push',
    VERIFICATION_REJECTED: 'unless-push',
    VERIFICATION_PENDING: 'none',
    NEW_MATCHING_DEALS: 'digest',
    APPLICATION_VIEWED: 'none',
    APPLICATION_SHORTLISTED: 'none',
    APPLICATION_ACCEPTED: 'unless-push',
    APPLICATION_REJECTED: 'none',
    APPLICATION_COMPLETED: 'none',
    NEW_APPLICANT: 'digest',
    DEAL_FILLED: 'none',
    DEAL_EXPIRED: 'none',
    DEAL_REVIEW_PENDING: 'none',
    DEAL_APPROVED: 'none',
    DEAL_REJECTED: 'unless-push',
    SOCIAL_ACCOUNT_PENDING: 'none',
    SOCIAL_ACCOUNT_APPROVED: 'none',
    SOCIAL_ACCOUNT_REJECTED: 'none',
    SOCIAL_ACCOUNT_REUSED: 'none',
    OFFER_REVIEW_PENDING: 'none',
    OFFER_APPROVED: 'none',
    OFFER_REJECTED: 'none',
    OFFER_REQUEST_NEW: 'unless-push',
    OFFER_REQUEST_ACCEPTED: 'unless-push',
    OFFER_REQUEST_DECLINED: 'none',
    PORTFOLIO_REVIEW_PENDING: 'none',
    PORTFOLIO_APPROVED: 'none',
    PORTFOLIO_REJECTED: 'none',
    SUPPORT_NEW_TICKET: 'none',
    SUPPORT_USER_MESSAGE: 'none',
    SUPPORT_ASSIGNED: 'none',
    // Guests without an account get replies by email from the support service directly.
    SUPPORT_REPLY: 'unless-push',
    TRIAL_ENDING: 'instant',
    // Paddle emails its own receipt.
    PAYMENT_SUCCEEDED: 'none',
    PAYMENT_FAILED: 'instant',
    SUBSCRIPTION_EXPIRED: 'instant',
    SOCIAL_TOKEN_REVOKED: 'unless-push',
    POST_SUBMITTED: 'none',
  };
