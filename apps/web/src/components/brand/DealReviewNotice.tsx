'use client';
import type { DealStatus } from '@briefluence/shared';
import { Alert, buttonStyles } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/** Tells the brand where its brief is in admin review (nothing for other statuses). */
export function DealReviewNotice({
  deal,
  withFixLink = true,
}: {
  deal: { id: string; status: DealStatus; reviewNote?: string | null };
  withFixLink?: boolean;
}) {
  const t = useTranslations('dealForm.review');
  if (deal.status === 'IN_REVIEW') return <Alert tone="info">{t('inReview')}</Alert>;
  if (deal.status !== 'REJECTED') return null;
  return (
    <Alert
      tone="warning"
      action={
        withFixLink && (
          <Link
            href={`/brand/deals/${deal.id}/edit`}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          >
            {t('fix')}
          </Link>
        )
      }
    >
      {t('rejected', { reason: deal.reviewNote ?? '—' })}
    </Alert>
  );
}

/** Label (dealForm key) of the button that sends a brief out, per status; absent = no such button. */
export const PUBLISH_LABEL: Partial<Record<DealStatus, 'sendForReview' | 'sendAgain' | 'resume'>> =
  {
    DRAFT: 'sendForReview',
    REJECTED: 'sendAgain',
    PAUSED: 'resume',
  };
