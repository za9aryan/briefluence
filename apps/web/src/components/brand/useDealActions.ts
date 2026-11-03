'use client';
import { useToast } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { DealDto } from '@/lib/types';
import { useErrorMessage } from '@/lib/hooks/errors';

export function useDealActions() {
  const t = useTranslations('dealForm');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'publish' | 'pause' | 'close' | 'reopen';
    }) => api.post<DealDto>(`/deals/${id}/${action}`),
    onSuccess: (deal, { id, action }) => {
      // Reopened: straight to the editor to set a new deadline and publish.
      if (action === 'reopen') router.push(`/brand/deals/${id}/edit`);
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal'] });
      void qc.invalidateQueries({ queryKey: ['applicants'] });
      toast(deal?.status === 'IN_REVIEW' ? t('toast.sentForReview') : t(`toast.${action}`));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
}
