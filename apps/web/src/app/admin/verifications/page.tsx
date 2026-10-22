'use client';
import type { ContactMethod, VerificationStatus } from '@briefluence/shared';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Grid,
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
import { ReuseWarning } from '@/components/admin/AccountReuse';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { VerificationBadge } from '@/components/domain/badges';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { InfluencerProfileDto } from '@/lib/types';

type Row = Omit<InfluencerProfileDto, 'socialAccounts'> & {
  socialAccounts: (InfluencerProfileDto['socialAccounts'][number] & { reuseWarning: boolean })[];
  email: string;
  emailVerified: boolean;
  submittedAt: string | null;
  contacts: { method: ContactMethod | null; value: string | null };
};
const TABS: VerificationStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'];

export default function AdminVerificationsPage() {
  const t = useTranslations('admin.verifications');
  const tv = useTranslations('enums.verificationStatus');
  const tc = useTranslations('common');
  const f = useFormat();
  const o = useOptions();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<VerificationStatus>('PENDING_REVIEW');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'verifications', status],
    queryFn: () => api.get<Row[]>('/admin/verifications', { status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(
        `/admin/verifications/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason },
      ),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'verifications'] });
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
        items={TABS.map((s) => ({ value: s, label: tv(s) }))}
      />
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="check-circle" title={t('empty')} />
      ) : (
        <Stack gap={4}>
          {list.data.map((p) => (
            <Card key={p.id}>
              <Stack gap={4}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <Inline gap={4} align="start" className="min-w-0">
                    <Avatar size="lg" name={p.displayName} src={p.avatarUrl} />
                    <Stack gap={1} className="min-w-0 wrap-anywhere">
                      <Text size="body" weight="bold">
                        {p.displayName}
                      </Text>
                      <Text size="small" tone="muted">
                        {p.email} {p.emailVerified ? '' : `· ${t('emailNotVerified')}`}
                      </Text>
                      <Text size="small" tone="muted">
                        {[
                          p.city,
                          o.country(p.country),
                          p.birthYear,
                          p.niches.map(o.niche).join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      {p.submittedAt && (
                        <Text size="small" tone="muted">
                          {t('submitted', { date: f.dateTime(p.submittedAt) })}
                        </Text>
                      )}
                    </Stack>
                  </Inline>
                  <VerificationBadge status={p.status} />
                </div>
                {p.bio && <Text size="small">{p.bio}</Text>}
                <Grid cols={{ base: 1, lg: 2 }} gap={4}>
                  {p.socialAccounts.map((a) => (
                    <div key={a.id} className="rounded-card border border-line p-4">
                      <AccountLine account={a} />
                      {a.reuseWarning && (
                        <div className="mt-3">
                          <ReuseWarning accountId={a.id} />
                        </div>
                      )}
                      <div className="mt-4">
                        <AccountStats account={a} />
                      </div>
                    </div>
                  ))}
                </Grid>
                {p.rejectionReason && (
                  <Text size="small" tone="muted">
                    {t('previousReason', { reason: p.rejectionReason })}
                  </Text>
                )}
                {p.status === 'PENDING_REVIEW' && (
                  <Inline gap={2} justify="end" wrap>
                    <Button variant="ghost" onClick={() => setRejecting(p)}>
                      {t('reject')}
                    </Button>
                    <Button
                      loading={
                        decide.isPending &&
                        decide.variables?.id === p.id &&
                        decide.variables.approve
                      }
                      onClick={() => decide.mutate({ id: p.id, approve: true })}
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
        description={rejecting?.displayName}
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
