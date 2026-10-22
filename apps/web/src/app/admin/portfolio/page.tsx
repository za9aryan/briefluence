'use client';
import type { AccountReviewStatus } from '@briefluence/shared';
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
import { PortfolioLink } from '@/components/portfolio/PortfolioParts';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { PortfolioItemDto } from '@/lib/types';

type Row = PortfolioItemDto & {
  influencer: { id: string; displayName: string; avatarUrl: string | null; email: string };
};
const TABS: { value: AccountReviewStatus; key: 'tabPending' | 'tabApproved' | 'tabRejected' }[] = [
  { value: 'PENDING', key: 'tabPending' },
  { value: 'APPROVED', key: 'tabApproved' },
  { value: 'REJECTED', key: 'tabRejected' },
];

/** Every portfolio item is checked before brands see it; edited items come back here. */
export default function AdminPortfolioPage() {
  const t = useTranslations('portfolio.admin');
  const tc = useTranslations('common');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<AccountReviewStatus>('PENDING');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'portfolio', status],
    queryFn: () => api.get<Row[]>('/admin/portfolio', { status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(
        `/admin/portfolio/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason },
      ),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'portfolio'] });
      setRejecting(null);
      setReason('');
      toast(v.approve ? t('approved') : t('rejected'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      <Tabs
        aria-label={t('title')}
        value={status}
        onChange={setStatus}
        items={TABS.map((x) => ({ value: x.value, label: t(x.key) }))}
      />
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="check-circle" title={t('empty')} />
      ) : (
        <Stack gap={4}>
          {list.data.map((i) => (
            <Card key={i.id}>
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href={i.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full shrink-0 overflow-hidden rounded-card border border-line bg-surface sm:w-48"
                >
                  <img
                    src={i.imageUrl}
                    alt={i.title}
                    className="aspect-[4/5] w-full object-cover"
                  />
                </a>
                <Stack gap={2} className="min-w-0 flex-1">
                  <Inline gap={2} align="start">
                    <Avatar
                      size="sm"
                      name={i.influencer.displayName}
                      src={i.influencer.avatarUrl}
                    />
                    <Stack gap={0} className="min-w-0">
                      <Text size="small" weight="bold" className="truncate">
                        {i.influencer.displayName}
                      </Text>
                      <Text size="small" tone="muted" className="truncate">
                        {i.influencer.email} · {t('updated', { date: f.dateTime(i.updatedAt) })}
                      </Text>
                    </Stack>
                  </Inline>
                  <Text weight="bold" className="break-words">
                    {i.title}
                  </Text>
                  {i.description && (
                    <Text size="small" tone="muted" className="whitespace-pre-line break-words">
                      {i.description}
                    </Text>
                  )}
                  {i.linkUrl && <PortfolioLink url={i.linkUrl} className="self-start" />}
                  {i.reviewNote && (
                    <Text size="small" tone="muted">
                      {t('previousReason', { reason: i.reviewNote })}
                    </Text>
                  )}
                  {i.reviewStatus !== 'REJECTED' && (
                    <Inline gap={2} justify="end" wrap className="mt-auto">
                      <Button variant="ghost" onClick={() => setRejecting(i)}>
                        {t('reject')}
                      </Button>
                      {i.reviewStatus === 'PENDING' && (
                        <Button
                          loading={
                            decide.isPending &&
                            decide.variables?.id === i.id &&
                            decide.variables.approve
                          }
                          onClick={() => decide.mutate({ id: i.id, approve: true })}
                        >
                          {t('approve')}
                        </Button>
                      )}
                    </Inline>
                  )}
                </Stack>
              </div>
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
