'use client';
import { Alert, Stack, useToast } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { EMPTY_OFFER, OfferForm } from '@/components/offers/OfferParts';
import { OfferLimitNotice } from '@/components/offers/useOfferActions';
import { BriefsChecklist, useBloggerUnlocked } from '@/components/influencer/StartTrial';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { OfferDto } from '@/lib/types';

export default function NewOfferPage() {
  const t = useTranslations('offers');
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<React.ReactNode>(null);

  const { me, unlocked } = useBloggerUnlocked();
  if (me && !unlocked) return <BriefsChecklist for="offers" />;
  return (
    <Stack gap={6}>
      <PageHeader
        back={{ href: '/influencer/offers', label: t('mineTitle') }}
        title={t('newTitle')}
        description={t('formLead')}
      />
      <OfferForm
        initial={EMPTY_OFFER}
        busy={busy}
        error={error}
        footerNote={t('publishHint')}
        onSubmit={async (values, publish) => {
          setBusy(publish ? 'publish' : 'draft');
          setError(null);
          let offer: OfferDto | null = null;
          try {
            offer = await api.post<OfferDto>('/offers', values);
            if (publish) {
              const sent = await api.post<OfferDto>(`/offers/${offer.id}/publish`);
              toast(sent.status === 'IN_REVIEW' ? t('toast.sentForReview') : t('toast.live'));
            } else toast(t('toast.saved'));
            await qc.invalidateQueries({ queryKey: ['offers'] });
            router.push('/influencer/offers');
          } catch (e) {
            setBusy(null);
            if (e instanceof ApiError && e.code === 'OFFER_LIMIT_REACHED') {
              // The draft is saved; the limit only blocks going live.
              await qc.invalidateQueries({ queryKey: ['offers'] });
              setError(
                <OfferLimitNotice
                  limit={(e.details as { limit?: number | null } | undefined)?.limit ?? null}
                />,
              );
              if (offer) router.replace(`/influencer/offers/${offer.id}/edit`);
              return;
            }
            setError(<Alert tone="danger">{errorMessage(e)}</Alert>);
          }
        }}
      />
    </Stack>
  );
}
