'use client';
import { Stack } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { defaultDealValues, toDealInput } from '@/components/brand/deal-form-values';
import { DealWizard } from '@/components/brand/DealWizard';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { DealDto } from '@/lib/types';

export default function NewDealPage() {
  const t = useTranslations('dealForm');
  const tn = useTranslations('nav');
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initial] = useState(defaultDealValues);

  return (
    <Stack gap={6}>
      <PageHeader back={{ href: '/brand/deals', label: tn('deals') }} title={t('newTitle')} description={t('newLead')} />
      <DealWizard
        initial={initial}
        submitting={submitting}
        serverError={error}
        onSubmit={async (values, publish) => {
          setSubmitting(publish ? 'publish' : 'draft');
          setError(null);
          try {
            const deal = await api.post<DealDto>('/deals', toDealInput(values));
            if (publish) await api.post(`/deals/${deal.id}/publish`);
            await qc.invalidateQueries({ queryKey: ['deals'] });
            router.push(publish ? `/brand/deals/${deal.id}/applicants?published=1` : '/brand/deals');
          } catch (e) {
            setError(errorMessage(e));
            setSubmitting(null);
          }
        }}
      />
    </Stack>
  );
}
