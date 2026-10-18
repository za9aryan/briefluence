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
  buttonStyles,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { SocialAccountDto } from '@/lib/types';

type Row = SocialAccountDto & {
  createdAt: string;
  influencer: { id: string; displayName: string; avatarUrl: string | null; email: string };
};
type Status = 'PENDING' | 'REJECTED' | 'APPROVED';
const TABS: { value: Status; key: 'tabPending' | 'tabRejected' | 'tabApproved' }[] = [
  { value: 'PENDING', key: 'tabPending' },
  { value: 'REJECTED', key: 'tabRejected' },
  { value: 'APPROVED', key: 'tabApproved' },
];

/** Accounts added by already approved bloggers: each one is checked (public, content fine for brands). */
export default function AdminAccountsPage() {
  const t = useTranslations('admin.accounts');
  const tc = useTranslations('common');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('PENDING');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'accounts', status],
    queryFn: () => api.get<Row[]>('/admin/accounts', { status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(
        `/admin/accounts/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason },
      ),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'accounts'] });
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
          {list.data.map((a) => (
            <Card key={a.id}>
              <Stack gap={4}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Inline gap={4} align="start">
                    <Avatar name={a.influencer.displayName} src={a.influencer.avatarUrl} />
                    <Stack gap={1}>
                      <Text weight="bold">{a.influencer.displayName}</Text>
                      <Text size="small" tone="muted">
                        {a.influencer.email} · {t('added', { date: f.dateTime(a.createdAt) })}
                      </Text>
                    </Stack>
                  </Inline>
                  <a
                    href={a.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonStyles({
                      variant: 'secondary',
                      size: 'sm',
                      className: 'self-start',
                    })}
                  >
                    {t('openProfile')}
                  </a>
                </div>
                <AccountLine account={a} />
                <AccountStats account={a} />
                {a.reviewNote && (
                  <Text size="small" tone="muted">
                    {t('previousReason', { reason: a.reviewNote })}
                  </Text>
                )}
                {a.reviewStatus === 'PENDING' && (
                  <Inline gap={2} justify="end">
                    <Button variant="ghost" onClick={() => setRejecting(a)}>
                      {t('reject')}
                    </Button>
                    <Button
                      loading={
                        decide.isPending &&
                        decide.variables?.id === a.id &&
                        decide.variables.approve
                      }
                      onClick={() => decide.mutate({ id: a.id, approve: true })}
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
        description={rejecting && `@${rejecting.username}`}
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
