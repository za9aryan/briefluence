'use client';
import { PLATFORMS, type Platform } from '@briefluence/shared';
import { Alert, Button, Card, CardHeader, Grid, Icon, Inline, Modal, Skeleton, Stack, Stepper, Text, buttonStyles, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { VerificationBadge } from '@/components/domain/badges';
import { API_BASE, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import { ME_KEY } from '@/lib/hooks/session';
import type { InfluencerProfileDto, SocialAccountDto } from '@/lib/types';

function OAuthResult() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('verification');
  const tp = useTranslations('enums.platform');
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const connected = params.get('connected');
    const error = params.get('error');
    if (!connected && !error) return;
    handled.current = true;
    if (connected) toast(t('connectedToast', { platform: tp(connected.toUpperCase() as Platform) }));
    if (error) toast(error, 'danger');
    router.replace('/influencer/verification');
  }, [params, router, toast, t, tp]);
  return null;
}

export default function VerificationPage() {
  const t = useTranslations('verification');
  const tc = useTranslations('common');
  const tp = useTranslations('enums.platform');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const f = useFormat();
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<SocialAccountDto | null>(null);
  const profile = useQuery({ queryKey: ['influencer', 'me'], queryFn: () => api.get<InfluencerProfileDto>('/influencers/me') });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['influencer', 'me'] });
    void qc.invalidateQueries({ queryKey: ME_KEY });
  };
  const submit = useMutation({
    mutationFn: () => api.post('/influencers/me/submit'),
    onSuccess: () => {
      refresh();
      toast(t('submittedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const sync = useMutation({
    mutationFn: (id: string) => api.post(`/social/accounts/${id}/sync`),
    onSuccess: () => {
      refresh();
      toast(t('syncedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/social/accounts/${id}`),
    onSuccess: () => {
      setRemoving(null);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const p = profile.data;
  const accounts = p?.socialAccounts ?? [];
  const status = p?.status ?? 'DRAFT';
  const step = status === 'APPROVED' ? 3 : status === 'PENDING_REVIEW' ? 2 : accounts.length ? 2 : 1;
  const canSubmit = (status === 'DRAFT' || status === 'REJECTED') && accounts.some((a) => !a.needsReconnect);

  return (
    <Stack gap={6}>
      <Suspense>
        <OAuthResult />
      </Suspense>
      <Stepper steps={[t('stepProfile'), t('stepConnect'), t('stepReview')]} current={Math.min(step, 2)} />
      <PageHeader title={t('title')} description={t('lead')} actions={p && <VerificationBadge status={status} />} />

      {status === 'REJECTED' && p?.rejectionReason && (
        <Alert tone="danger" title={t('rejectedTitle')}>
          {p.rejectionReason}
        </Alert>
      )}
      {status === 'PENDING_REVIEW' && (
        <Alert tone="info" title={t('pendingTitle')}>
          {t('pendingBody')}
        </Alert>
      )}
      {status === 'APPROVED' && (
        <Alert tone="success" title={t('approvedTitle')}>
          {t('approvedBody')}
        </Alert>
      )}

      <Card>
        <CardHeader title={t('connectTitle')} description={t('connectLead')} />
        <Grid cols={{ base: 1, sm: 3 }} gap={2}>
          {PLATFORMS.map((pl) => (
            <a key={pl} href={`${API_BASE}/social/${pl.toLowerCase()}/connect`} className={buttonStyles({ variant: 'secondary', block: true })}>
              <Icon name={PLATFORM_ICON[pl]} />
              {t('connect', { platform: tp(pl) })}
            </a>
          ))}
        </Grid>
        <Text size="small" tone="muted" className="mt-4">
          {t('instagramNote')}
        </Text>
      </Card>

      <Card>
        <CardHeader title={t('accountsTitle')} />
        {profile.isLoading ? (
          <Skeleton className="h-32" />
        ) : accounts.length === 0 ? (
          <Text tone="muted">{t('noAccounts')}</Text>
        ) : (
          <Stack gap={6}>
            {accounts.map((a) => (
              <Stack key={a.id} gap={4} className="border-b border-line pb-6 last:border-0 last:pb-0">
                <Inline justify="between" gap={2} wrap>
                  <AccountLine account={a} />
                  <Inline gap={1}>
                    <Button variant="ghost" size="sm" icon="refresh" loading={sync.isPending && sync.variables === a.id} onClick={() => sync.mutate(a.id)}>
                      {t('sync')}
                    </Button>
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => setRemoving(a)}>
                      {tc('remove')}
                    </Button>
                  </Inline>
                </Inline>
                <AccountStats account={a} />
                {a.lastSyncedAt && (
                  <Text size="small" tone="muted">
                    {t('lastSynced', { date: f.dateTime(a.lastSyncedAt) })}
                  </Text>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Card>

      {(status === 'DRAFT' || status === 'REJECTED') && (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stack gap={1}>
            <Text weight="bold">{t('submitTitle')}</Text>
            <Text size="small" tone="muted">
              {canSubmit ? t('submitReady') : t('submitNeedsAccount')}
            </Text>
          </Stack>
          <Button size="lg" disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()} className="w-full sm:w-auto">
            {t('submit')}
          </Button>
        </Card>
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        closeLabel={tc('close')}
        title={t('removeTitle')}
        description={removing ? `@${removing.username}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
              {tc('remove')}
            </Button>
          </>
        }
      >
        <Text tone="muted">{t('removeBody')}</Text>
      </Modal>
    </Stack>
  );
}
