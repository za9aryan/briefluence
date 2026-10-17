'use client';
import type { ApplicationStatus } from '@briefluence/shared';
import { Alert, Button, EmptyState, Inline, Modal, Progress, Select, Skeleton, Stack, Text, buttonStyles, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { ApplicantCard, type ApplicantAction } from '@/components/brand/ApplicantCard';
import { DealStatusBadge } from '@/components/domain/badges';
import { api, ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { ApplicantsDto } from '@/lib/types';
import { useDealActions } from '@/components/brand/useDealActions';

const FILTERS: ('' | ApplicationStatus)[] = ['', 'VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'COMPLETED'];

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('applications.brand');
  const tf = useTranslations('dealForm');
  const tn = useTranslations('nav');
  const ts = useTranslations('enums.applicationStatus');
  const tc = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [sort, setSort] = useState<'match' | 'followers' | 'newest'>('match');
  const [status, setStatus] = useState<'' | ApplicationStatus>('');
  const [overSlots, setOverSlots] = useState<{ id: string } | null>(null);
  const act = useDealActions();

  const data = useQuery({
    queryKey: ['applicants', id, sort, status],
    queryFn: () => api.get<ApplicantsDto>(`/deals/${id}/applications`, { sort, status: status || undefined }),
  });
  const update = useMutation({
    mutationFn: ({ appId, action, confirmOverSlots }: { appId: string; action: ApplicantAction; confirmOverSlots?: boolean }) =>
      api.patch(`/applications/${appId}/status`, { ...action, confirmOverSlots }),
    onSuccess: (_, { action }) => {
      void qc.invalidateQueries({ queryKey: ['applicants', id] });
      void qc.invalidateQueries({ queryKey: ['deals'] });
      toast(t(`toast.${action.status}`));
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.code === 'SLOTS_EXCEEDED') setOverSlots({ id: vars.appId });
      else toast(errorMessage(e), 'danger');
    },
  });

  const d = data.data?.deal;
  return (
    <Stack gap={6}>
      <PageHeader
        back={{ href: '/brand/deals', label: tn('deals') }}
        title={d?.title ?? '…'}
        actions={
          d && (
            <Inline gap={2} wrap>
              <DealStatusBadge status={d.status} />
              {(d.status === 'DRAFT' || d.status === 'PAUSED') && (
                <Link href={`/brand/deals/${id}/edit`} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                  {tc('edit')}
                </Link>
              )}
              {d.status === 'ACTIVE' && (
                <Button size="sm" variant="secondary" onClick={() => act.mutate({ id, action: 'pause' })}>
                  {tf('pause')}
                </Button>
              )}
              {d.status === 'PAUSED' && (
                <Button size="sm" onClick={() => act.mutate({ id, action: 'publish' })}>
                  {tf('resume')}
                </Button>
              )}
              {['ACTIVE', 'PAUSED'].includes(d.status) && (
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ id, action: 'close' })}>
                  {tf('close')}
                </Button>
              )}
            </Inline>
          )
        }
      />
      {d && (
        <div>
          <Inline justify="between">
            <Text size="small" weight="bold">
              {t('slots', { filled: d.filled, slots: d.slots })}
            </Text>
            <Text size="small" tone="muted">
              {t('total', { count: data.data!.total })}
            </Text>
          </Inline>
          <Progress value={(d.filled / Math.max(1, d.slots)) * 100} label={t('slots', { filled: d.filled, slots: d.slots })} className="mt-2" />
        </div>
      )}
      {d?.status === 'DRAFT' && <Alert tone="info">{t('draftNote')}</Alert>}

      <Inline gap={2} wrap>
        <Select aria-label={t('filter')} value={status} onChange={(e) => setStatus(e.target.value as '' | ApplicationStatus)} className="w-auto">
          {FILTERS.map((s) => (
            <option key={s} value={s}>
              {s ? ts(s) : t('allStatuses')}
            </option>
          ))}
        </Select>
        <Select aria-label={t('sort')} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-auto">
          <option value="match">{t('sortMatch')}</option>
          <option value="followers">{t('sortFollowers')}</option>
          <option value="newest">{t('sortNewest')}</option>
        </Select>
      </Inline>

      {data.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !data.data?.items.length ? (
        <EmptyState icon="users" title={t('emptyTitle')} description={d?.status === 'ACTIVE' ? t('emptyBody') : undefined} />
      ) : (
        <Stack gap={4}>
          {data.data.items.map((a) => (
            <ApplicantCard
              key={a.id}
              a={a}
              currency={data.data!.deal.currency}
              busy={update.isPending && update.variables?.appId === a.id}
              onAction={(action) => update.mutate({ appId: a.id, action })}
            />
          ))}
        </Stack>
      )}

      <Modal
        open={!!overSlots}
        onClose={() => setOverSlots(null)}
        size="sm"
        closeLabel={tc('close')}
        title={t('overSlotsTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverSlots(null)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (overSlots) update.mutate({ appId: overSlots.id, action: { status: 'ACCEPTED' }, confirmOverSlots: true });
                setOverSlots(null);
              }}
            >
              {t('acceptAnyway')}
            </Button>
          </>
        }
      >
        <Text tone="muted">{t('overSlotsBody', { slots: d?.slots ?? 0 })}</Text>
      </Modal>
    </Stack>
  );
}
