'use client';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Inline,
  Modal,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Textarea,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { CollaborationBadge } from '@/components/domain/badges';
import { OfferMeta, OfferPrice, OfferStatusBadge } from '@/components/offers/OfferParts';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { OfferBloggerDto, OfferDto } from '@/lib/types';

type Row = OfferDto & { blogger: OfferBloggerDto & { email: string } };
type Queue = 'IN_REVIEW' | 'REJECTED';

/** Moderation of blogger offers before brands see them. */
export default function AdminOfferReviewPage() {
  const t = useTranslations('offers');
  const ts = useTranslations('offers.status');
  const tc = useTranslations('common');
  const f = useFormat();
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
                <Inline justify="between" align="start" gap={2}>
                  <Inline gap={2} align="center">
                    <Avatar name={o.blogger.displayName} src={o.blogger.avatarUrl} size="sm" />
                    <Stack gap={0}>
                      <Text weight="bold">{o.title}</Text>
                      <Text size="small" tone="muted">
                        {o.blogger.displayName} · {o.blogger.email}
                        {o.submittedAt ? ` · ${f.dateTime(o.submittedAt)}` : ''}
                      </Text>
                    </Stack>
                  </Inline>
                  <Inline gap={1}>
                    <CollaborationBadge type={o.collaborationType} />
                    <OfferStatusBadge status={o.status} />
                  </Inline>
                </Inline>
                <OfferMeta offer={o} />
                <OfferPrice offer={o} size="body" />
                <Text size="small" className="whitespace-pre-line">
                  {o.description}
                </Text>
                {o.idealBrands && (
                  <Text size="small">{t('wantsToWorkWith', { value: o.idealBrands })}</Text>
                )}
                {o.reviewNote && (
                  <Text size="small" tone="muted">
                    {t('review.rejected', { reason: o.reviewNote })}
                  </Text>
                )}
                {o.status === 'IN_REVIEW' && (
                  <Inline gap={2} justify="end">
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
