'use client';
import type {
  ApplicationStatus,
  CollaborationType,
  DealStatus,
  PaymentStatus,
  Platform,
  SubscriptionStatus,
  VerificationStatus,
} from '@briefluence/shared';
import { Badge, type BadgeTone } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { PLATFORM_ICON } from '@/lib/hooks/options';

const DEAL: Record<DealStatus, BadgeTone> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'primary',
  REJECTED: 'danger',
  ACTIVE: 'success',
  PAUSED: 'primary',
  CLOSED: 'ink',
  EXPIRED: 'neutral',
};
const APP: Record<ApplicationStatus, BadgeTone> = {
  APPLIED: 'neutral',
  VIEWED: 'neutral',
  SHORTLISTED: 'primary',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
  COMPLETED: 'success',
};
const VER: Record<VerificationStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'primary',
  APPROVED: 'success',
  REJECTED: 'danger',
};
const SUB: Record<SubscriptionStatus, BadgeTone> = {
  TRIALING: 'primary',
  ACTIVE: 'success',
  PAST_DUE: 'danger',
  CANCELED: 'neutral',
  EXPIRED: 'neutral',
};
const PAY: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'neutral',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const t = useTranslations('enums.dealStatus');
  return <Badge tone={DEAL[status]}>{t(status)}</Badge>;
}
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const t = useTranslations('enums.applicationStatus');
  return <Badge tone={APP[status]}>{t(status)}</Badge>;
}
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const t = useTranslations('enums.verificationStatus');
  return (
    <Badge tone={VER[status]} icon={status === 'APPROVED' ? 'verified' : undefined}>
      {t(status)}
    </Badge>
  );
}
export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const t = useTranslations('enums.subscriptionStatus');
  return <Badge tone={SUB[status]}>{t(status)}</Badge>;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('enums.paymentStatus');
  return <Badge tone={PAY[status]}>{t(status)}</Badge>;
}
export function PlatformBadge({ platform }: { platform: Platform }) {
  const t = useTranslations('enums.platform');
  return (
    <Badge icon={PLATFORM_ICON[platform]} variant="small">
      {t(platform)}
    </Badge>
  );
}
export function CollaborationBadge({ type }: { type: CollaborationType }) {
  const t = useTranslations('enums.collaboration');
  return (
    <Badge
      tone={type === 'LONG_TERM' ? 'primary' : 'neutral'}
      icon={type === 'LONG_TERM' ? 'repeat' : 'clock'}
    >
      {t(type)}
    </Badge>
  );
}

export function VerifiedBadge() {
  const t = useTranslations('common');
  return (
    <Badge tone="success" icon="verified">
      {t('verified')}
    </Badge>
  );
}
