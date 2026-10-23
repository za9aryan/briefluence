import type { NotificationType } from '@briefluence/shared';
import { IconBubble, type IconBubbleTone, type IconName } from '@briefluence/ui';

/** Good news is green, things that need the user's action are magenta, plain updates are grey. */
const ICON: Record<NotificationType, { icon: IconName; tone: IconBubbleTone }> = {
  VERIFICATION_APPROVED: { icon: 'verified', tone: 'success' },
  VERIFICATION_REJECTED: { icon: 'alert', tone: 'primary' },
  VERIFICATION_PENDING: { icon: 'shield', tone: 'neutral' },
  NEW_MATCHING_DEALS: { icon: 'sparkles', tone: 'primary' },
  APPLICATION_VIEWED: { icon: 'eye', tone: 'neutral' },
  APPLICATION_SHORTLISTED: { icon: 'star', tone: 'primary' },
  APPLICATION_ACCEPTED: { icon: 'check-circle', tone: 'success' },
  APPLICATION_REJECTED: { icon: 'x-circle', tone: 'neutral' },
  APPLICATION_COMPLETED: { icon: 'heart', tone: 'success' },
  NEW_APPLICANT: { icon: 'users', tone: 'primary' },
  DEAL_FILLED: { icon: 'target', tone: 'success' },
  DEAL_EXPIRED: { icon: 'clock', tone: 'neutral' },
  DEAL_REVIEW_PENDING: { icon: 'shield', tone: 'neutral' },
  DEAL_APPROVED: { icon: 'check-circle', tone: 'success' },
  DEAL_REJECTED: { icon: 'edit', tone: 'primary' },
  TRIAL_ENDING: { icon: 'calendar', tone: 'primary' },
  PAYMENT_SUCCEEDED: { icon: 'wallet', tone: 'success' },
  PAYMENT_FAILED: { icon: 'card', tone: 'primary' },
  SUBSCRIPTION_EXPIRED: { icon: 'card', tone: 'neutral' },
  SOCIAL_TOKEN_REVOKED: { icon: 'link', tone: 'primary' },
  POST_SUBMITTED: { icon: 'link', tone: 'neutral' },
  SOCIAL_ACCOUNT_PENDING: { icon: 'shield', tone: 'neutral' },
  SOCIAL_ACCOUNT_APPROVED: { icon: 'check-circle', tone: 'success' },
  SOCIAL_ACCOUNT_REJECTED: { icon: 'x-circle', tone: 'primary' },
  SOCIAL_ACCOUNT_REUSED: { icon: 'warning', tone: 'primary' },
  OFFER_REVIEW_PENDING: { icon: 'shield', tone: 'neutral' },
  OFFER_APPROVED: { icon: 'check-circle', tone: 'success' },
  OFFER_REJECTED: { icon: 'edit', tone: 'primary' },
  PORTFOLIO_REVIEW_PENDING: { icon: 'image', tone: 'neutral' },
  PORTFOLIO_APPROVED: { icon: 'check-circle', tone: 'success' },
  PORTFOLIO_REJECTED: { icon: 'image', tone: 'primary' },
  SUPPORT_NEW_TICKET: { icon: 'message', tone: 'primary' },
  SUPPORT_USER_MESSAGE: { icon: 'message', tone: 'neutral' },
  SUPPORT_ASSIGNED: { icon: 'user', tone: 'neutral' },
  SUPPORT_REPLY: { icon: 'message', tone: 'success' },
  OFFER_REQUEST_NEW: { icon: 'building', tone: 'primary' },
  OFFER_REQUEST_ACCEPTED: { icon: 'check-circle', tone: 'success' },
  OFFER_REQUEST_DECLINED: { icon: 'x-circle', tone: 'neutral' },
};

export function NotificationIcon({ type, size }: { type: string; size?: 'sm' | 'md' }) {
  const v = ICON[type as NotificationType] ?? { icon: 'bell' as const, tone: 'neutral' as const };
  return <IconBubble name={v.icon} tone={v.tone} size={size} />;
}
