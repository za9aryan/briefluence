'use client';
import { isOfferEditable } from '@briefluence/shared';
import { Alert, Button, Skeleton, Stack, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { OfferForm } from '@/components/offers/OfferParts';
import { OfferLimitNotice, OfferReviewNotice } from '@/components/offers/useOfferActions';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { OfferDetailDto, OfferDto } from '@/lib/types';

export default function EditOfferPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('offers');
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<React.ReactNode>(null);
  const offer = useQuery({
    queryKey: ['offers', id],
    queryFn: () => api.get<OfferDetailDto>(`/offers/${id}`),
  });
  const pause = useMutation({
    mutationFn: () => api.post(`/offers/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers', id] }),
  });

  if (!offer.data) return <Skeleton className="h-[60vh] rounded-card" />;
  const o = offer.data;
  return (
    <Stack gap={6}>
      <PageHeader
        back={{ href: '/influencer/offers', label: t('mineTitle') }}
        title={t('editTitle')}
        description={o.title}
      />
      <OfferReviewNotice offer={o} />
      {!isOfferEditable(o.status) ? (
        <Alert
          tone="warning"
          action={
            o.status === 'ACTIVE' ? (
              <Button
                size="sm"
                variant="secondary"
                loading={pause.isPending}
                onClick={() => pause.mutate()}
              >
                {t('pause')}
              </Button>
            ) : undefined
          }
        >
          {t('publishHint')}
        </Alert>
      ) : (
        <OfferForm
          key={o.status}
          initial={{
            title: o.title,
            description: o.description,
            priceMinor: o.priceMinor,
            currency: o.currency,
            collaborationType: o.collaborationType,
            platforms: o.platforms,
            contentFormats: o.contentFormats,
            niches: o.niches as never,
            idealBrands: o.idealBrands,
          }}
          busy={busy}
          error={error}
          footerNote={t('publishHint')}
          onSubmit={async (values, publish) => {
            setBusy(publish ? 'publish' : 'draft');
            setError(null);
            try {
              await api.patch(`/offers/${id}`, values);
              if (publish) {
                const sent = await api.post<OfferDto>(`/offers/${id}/publish`);
                toast(sent.status === 'IN_REVIEW' ? t('toast.sentForReview') : t('toast.live'));
              } else toast(t('toast.saved'));
              await qc.invalidateQueries({ queryKey: ['offers'] });
              router.push('/influencer/offers');
            } catch (e) {
              setBusy(null);
              if (e instanceof ApiError && e.code === 'OFFER_LIMIT_REACHED') {
                setError(
                  <OfferLimitNotice
                    limit={(e.details as { limit?: number | null } | undefined)?.limit ?? null}
                  />,
                );
                return;
              }
              setError(<Alert tone="danger">{errorMessage(e)}</Alert>);
            }
          }}
        />
      )}
    </Stack>
  );
}
