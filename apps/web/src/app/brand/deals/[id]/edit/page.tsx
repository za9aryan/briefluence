'use client';
import { isDealEditable } from '@briefluence/shared';
import { Alert, Button, Skeleton, Stack } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { dealToFormValues, toDealInput } from '@/components/brand/deal-form-values';
import { DealWizard } from '@/components/brand/DealWizard';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { DealDetailDto } from '@/lib/types';

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('dealForm');
  const tn = useTranslations('nav');
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deal = useQuery({ queryKey: ['deal', id], queryFn: () => api.get<DealDetailDto>(`/deals/${id}`) });
  const pause = useMutation({
    mutationFn: () => api.post(`/deals/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', id] }),
  });

  if (deal.isLoading || !deal.data) return <Skeleton className="h-[70vh] rounded-card" />;
  const editable = isDealEditable(deal.data.status);

  return (
    <Stack gap={6}>
      <PageHeader back={{ href: '/brand/deals', label: tn('deals') }} title={t('editTitle')} description={deal.data.title} />
      {!editable ? (
        <Alert
          tone="warning"
          action={
            deal.data.status === 'ACTIVE' ? (
              <Button size="sm" variant="secondary" loading={pause.isPending} onClick={() => pause.mutate()}>
                {t('pauseToEdit')}
              </Button>
            ) : undefined
          }
        >
          {deal.data.status === 'ACTIVE' ? t('activeNotEditable') : t('notEditable')}
        </Alert>
      ) : (
        <DealWizard
          key={deal.data.status}
          initial={dealToFormValues(deal.data)}
          submitting={submitting}
          serverError={error}
          onSubmit={async (values, publish) => {
            setSubmitting(publish ? 'publish' : 'draft');
            setError(null);
            try {
              await api.patch(`/deals/${id}`, toDealInput(values));
              if (publish) await api.post(`/deals/${id}/publish`);
              await qc.invalidateQueries({ queryKey: ['deals'] });
              await qc.invalidateQueries({ queryKey: ['deal', id] });
              router.push(publish ? `/brand/deals/${id}/applicants` : '/brand/deals');
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
