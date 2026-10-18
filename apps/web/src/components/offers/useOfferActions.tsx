'use client';
import { Alert, buttonStyles, useToast } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { OfferDto } from '@/lib/types';

export type OfferAction = 'publish' | 'pause' | 'close';

/** Publish / pause / close an offer with the right toast; the plan limit becomes a friendly notice. */
export function useOfferActions() {
  const t = useTranslations('offers');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [limit, setLimit] = useState<number | null | false>(false);
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: OfferAction }) =>
      api.post<OfferDto>(`/offers/${id}/${action}`),
    onSuccess: (offer, { action }) => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      toast(
        action === 'publish'
          ? offer.status === 'IN_REVIEW'
            ? t('toast.sentForReview')
            : t('toast.live')
          : action === 'pause'
            ? t('toast.paused')
            : t('toast.closed'),
      );
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'OFFER_LIMIT_REACHED') {
        setLimit((e.details as { limit?: number | null } | undefined)?.limit ?? null);
        return;
      }
      toast(errorMessage(e), 'danger');
    },
  });
  return { ...mutation, limit, clearLimit: () => setLimit(false) };
}

/** Shown when the plan's live-offer limit is reached. */
export function OfferLimitNotice({ limit }: { limit: number | null }) {
  const t = useTranslations('offers');
  return (
    <Alert
      tone="warning"
      title={t('limitTitle')}
      action={
        <Link
          href="/influencer/billing"
          className={buttonStyles({ size: 'sm', variant: 'secondary' })}
        >
          {t('seePlans')}
        </Link>
      }
    >
      {t('limitBody', { count: limit ?? 1 })}
    </Alert>
  );
}

/** Status line for the blogger: in review / needs changes with the admin's reason. */
export function OfferReviewNotice({ offer }: { offer: Pick<OfferDto, 'status' | 'reviewNote'> }) {
  const t = useTranslations('offers.review');
  if (offer.status === 'IN_REVIEW') return <Alert tone="info">{t('inReview')}</Alert>;
  if (offer.status === 'REJECTED')
    return <Alert tone="warning">{t('rejected', { reason: offer.reviewNote ?? '—' })}</Alert>;
  return null;
}
