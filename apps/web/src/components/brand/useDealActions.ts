'use client';
import { useToast } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';

export function useDealActions() {
  const t = useTranslations('dealForm');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'pause' | 'close' }) => api.post(`/deals/${id}/${action}`),
    onSuccess: (_, { action }) => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal'] });
      void qc.invalidateQueries({ queryKey: ['applicants'] });
      toast(t(`toast.${action}`));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
}
