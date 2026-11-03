'use client';
import { canEditDeal, canReopenDeal } from '@briefluence/shared';
import { Alert, Button, Skeleton, Stack, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { dealToFormValues, toDealInput } from '@/components/brand/deal-form-values';
import { DealWizard } from '@/components/brand/DealWizard';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { DealReviewNotice } from '@/components/brand/DealReviewNotice';
import type { DealDetailDto, DealDto } from '@/lib/types';

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('dealForm');
  const tn = useTranslations('nav');
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const toast = useToast();
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deal = useQuery({
    queryKey: ['deal', id],
    queryFn: () => api.get<DealDetailDto>(`/deals/${id}`),
  });
  const reopen = useMutation({
    mutationFn: () => api.post(`/deals/${id}/reopen`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      return qc.invalidateQueries({ queryKey: ['deal', id] });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (deal.isLoading || !deal.data) return <Skeleton className="h-[70vh] rounded-card" />;
  const status = deal.data.status;
  const editable = canEditDeal(status);
  const live = status === 'ACTIVE';
  // Reopened (or long-paused) brief with a past deadline: say what to do first.
  const needsDate = status === 'PAUSED' && new Date(deal.data.applicationDeadline) <= new Date();

  return (
    <Stack gap={6}>
      <PageHeader
        back={{ href: '/brand/deals', label: tn('deals') }}
        title={t('editTitle')}
        description={deal.data.title}
      />
      <DealReviewNotice deal={deal.data} withFixLink={false} />
      {live && <Alert tone="info">{t('live.banner')}</Alert>}
      {needsDate && <Alert tone="warning">{t('reopenFlow.needsDate')}</Alert>}
      {!editable ? (
        <Alert
          tone="warning"
          action={
            canReopenDeal(status) ? (
              <Button size="sm" loading={reopen.isPending} onClick={() => reopen.mutate()}>
                {t('reopen')}
              </Button>
            ) : undefined
          }
        >
          {canReopenDeal(status) ? t('reopenFlow.lead') : t('notEditable')}
        </Alert>
      ) : (
        <DealWizard
          key={status}
          live={live}
          initial={dealToFormValues(deal.data)}
          submitting={submitting}
          serverError={error}
          onSubmit={async (values, publish) => {
            setSubmitting(publish ? 'publish' : 'draft');
            setError(null);
            try {
              const saved = await api.patch<DealDto>(`/deals/${id}`, toDealInput(values));
              if (live) {
                // The server decides: still live, or back to review for changed content.
                toast(saved.status === 'IN_REVIEW' ? t('toast.sentForReview') : t('live.saved'));
              } else if (publish) {
                const sent = await api.post<DealDto>(`/deals/${id}/publish`);
                toast(sent.status === 'IN_REVIEW' ? t('toast.sentForReview') : t('toast.publish'));
              }
              await qc.invalidateQueries({ queryKey: ['deals'] });
              await qc.invalidateQueries({ queryKey: ['deal', id] });
              router.push(publish || live ? `/brand/deals/${id}/applicants` : '/brand/deals');
            } catch (e) {
              setError(errorMessage(e));
              setSubmitting(null);
            }
          }}
        />
      )}
    </Stack>
  );
}
