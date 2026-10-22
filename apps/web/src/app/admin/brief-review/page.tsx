'use client';
import {
  Badge,
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
import { DealStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { DealDto } from '@/lib/types';

type Row = DealDto & {
  submittedAt: string | null;
  reviewNote: string | null;
  brand: {
    id: string;
    companyName: string;
    website: string | null;
    instagramUrl: string | null;
    user: { email: string };
  };
};
type Queue = 'IN_REVIEW' | 'REJECTED';
const TABS: Queue[] = ['IN_REVIEW', 'REJECTED'];

/** Moderation queue: every brief is checked before bloggers can see it. */
export default function AdminBriefReviewPage() {
  const t = useTranslations('admin.briefReview');
  const tr = useTranslations('deals');
  const te = useTranslations('enums');
  const tc = useTranslations('common');
  const f = useFormat();
  const o = useOptions();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Queue>('IN_REVIEW');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'deals', status, ''],
    queryFn: () => api.get<Row[]>('/admin/deals', { status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(`/admin/deals/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason }),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'deals'] });
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
        items={TABS.map((s) => ({ value: s, label: te(`dealStatus.${s}`) }))}
      />
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="check-circle" title={t('empty')} />
      ) : (
        <Stack gap={4}>
          {list.data.map((d) => {
            const rows = [
              {
                label: tr('req.platforms'),
                value: d.platforms.map((p) => te(`platform.${p}`)).join(', '),
              },
              {
                label: tr('req.formats'),
                value: d.contentFormats.map((x) => te(`contentFormat.${x}`)).join(', '),
              },
              {
                label: tr('req.location'),
                value: [d.countries.map(o.country).join(', '), d.cities.join(', ')]
                  .filter(Boolean)
                  .join(' · '),
              },
              { label: t('slots'), value: String(d.slots) },
              { label: t('deadline'), value: f.date(d.applicationDeadline) },
            ];
            return (
              <Card key={d.id}>
                <Stack gap={4}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <Stack gap={1} className="min-w-0">
                      <Text size="body" weight="bold">
                        {d.title}
                      </Text>
                      <Text size="small" tone="muted" className="wrap-anywhere">
                        {[
                          d.brand.companyName,
                          d.brand.user.email,
                          d.brand.website,
                          d.brand.instagramUrl,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {d.submittedAt && (
                        <Text size="small" tone="muted">
                          {t('submitted', { date: f.dateTime(d.submittedAt) })}
                        </Text>
                      )}
                    </Stack>
                    <Inline gap={1} wrap>
                      {d.isConfidential && <Badge icon="lock">{t('confidential')}</Badge>}
                      <Badge>{te(`collaboration.${d.collaborationType}`)}</Badge>
                      <DealStatusBadge status={d.status} />
                    </Inline>
                  </div>
                  {d.imageUrl && (
                    <img
                      src={d.imageUrl}
                      alt=""
                      className="aspect-video w-full max-w-md rounded-card border border-line object-cover"
                    />
                  )}
                  <Text size="small" className="whitespace-pre-line wrap-anywhere">
                    {d.description}
                  </Text>
                  <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2 text-small sm:grid-cols-[max-content_minmax(0,1fr)]">
                    <dt className="text-ink-muted">{t('pays')}</dt>
                    <dd>
                      <Compensation {...d} />
                    </dd>
                    {rows.map((r) => (
                      <div key={r.label} className="contents">
                        <dt className="text-ink-muted">{r.label}</dt>
                        <dd className="min-w-0 text-ink wrap-anywhere">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {d.reviewNote && (
                    <Text size="small" tone="muted">
                      {t('previousReason', { reason: d.reviewNote })}
                    </Text>
                  )}
                  {d.status === 'IN_REVIEW' && (
                    <Inline gap={2} justify="end" wrap>
                      <Button variant="ghost" onClick={() => setRejecting(d)}>
                        {t('reject')}
                      </Button>
                      <Button
                        loading={
                          decide.isPending &&
                          decide.variables?.id === d.id &&
                          decide.variables.approve
                        }
                        onClick={() => decide.mutate({ id: d.id, approve: true })}
                      >
                        {t('approve')}
                      </Button>
                    </Inline>
                  )}
                </Stack>
              </Card>
            );
          })}
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
