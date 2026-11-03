'use client';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Inline,
  Modal,
  Skeleton,
  Stack,
  Tabs,
  Textarea,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AdminOfferContent, type AdminOffer } from '@/components/admin/ContentViews';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';

type Row = AdminOffer;
type Queue = 'IN_REVIEW' | 'REJECTED';

/** Moderation of blogger offers before brands see them. */
export default function AdminOfferReviewPage() {
  const t = useTranslations('offers');
  const ts = useTranslations('offers.status');
  const tc = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Queue>('IN_REVIEW');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'offers', status],
    queryFn: () => api.get<Row[]>('/admin/offers', { status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(`/admin/offers/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason }),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'offers'] });
      setRejecting(null);
      setReason('');
      toast(v.approve ? t('approvedToast') : t('rejectedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  return (
    <Stack gap={6}>
      <PageHeader title={t('reviewTitle')} description={t('reviewLead')} />
      <Tabs
        aria-label={t('reviewTitle')}
        value={status}
        onChange={setStatus}
        items={(['IN_REVIEW', 'REJECTED'] as const).map((s) => ({ value: s, label: ts(s) }))}
      />
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="check-circle" title={t('reviewEmpty')} />
      ) : (
        <Stack gap={4}>
          {list.data.map((o) => (
            <Card key={o.id}>
              <Stack gap={4}>
                <AdminOfferContent offer={o} />
                {o.status === 'IN_REVIEW' && (
                  <Inline gap={2} justify="end" wrap>
                    <Button variant="ghost" onClick={() => setRejecting(o)}>
                      {t('reject')}
                    </Button>
                    <Button
                      loading={
                        decide.isPending &&
                        decide.variables?.id === o.id &&
                        decide.variables.approve
                      }
                      onClick={() => decide.mutate({ id: o.id, approve: true })}
                    >
                      {t('approve')}
                    </Button>
                  </Inline>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        closeLabel={tc('close')}
        title={t('rejectTitle')}
        description={rejecting?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={decide.isPending}
              onClick={() =>
                rejecting &&
                decide.mutate({ id: rejecting.id, approve: false, reason: reason.trim() })
              }
            >
              {t('reject')}
            </Button>
          </>
        }
      >
        <Field label={t('reason')} hint={t('reasonHint')}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </Modal>
    </Stack>
  );
}
