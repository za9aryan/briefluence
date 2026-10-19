'use client';
import type { PlanCode } from '@briefluence/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  Inline,
  Modal,
  Progress,
  Skeleton,
  Stack,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Text,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { PaymentStatusBadge } from '@/components/domain/badges';
import { PlanPicker } from '@/components/influencer/StartTrial';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { ME_KEY } from '@/lib/hooks/session';
import type { PaymentDto, SubscriptionDto } from '@/lib/types';

function ReturnStatus() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('billing');
  const qc = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    const status = params.get('payment');
    if (!status || done.current) return;
    done.current = true;
    if (status === 'success') toast(t('paidToast'));
    else if (status === 'pending') toast(t('pendingToast'), 'info');
    else toast(t('failedToast'), 'danger');
    void qc.invalidateQueries({ queryKey: ['billing'] });
    void qc.invalidateQueries({ queryKey: ME_KEY });
    router.replace('/influencer/billing');
  }, [params, router, toast, t, qc]);
  return null;
}

export default function BillingPage() {
  const t = useTranslations('billing');
  const tp = useTranslations('billing.plans');
  const tc = useTranslations('common');
  const tk = useTranslations('enums.paymentStatus');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'cancel' | 'card' | null>(null);
  const sub = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get<SubscriptionDto>('/billing/subscription'),
  });
  const payments = useQuery({
    queryKey: ['billing', 'payments'],
    queryFn: () => api.get<PaymentDto[]>('/billing/payments'),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['billing'] });
    void qc.invalidateQueries({ queryKey: ME_KEY });
  };
  const action = useMutation({
    mutationFn: (kind: 'cancel' | 'resume' | 'card') =>
      kind === 'card' ? api.del('/billing/card') : api.post(`/billing/${kind}`),
    onSuccess: (_, kind) => {
      setConfirm(null);
      refresh();
      toast(
        kind === 'cancel'
          ? t('cancelledToast')
          : kind === 'resume'
            ? t('resumedToast')
            : t('cardRemovedToast'),
      );
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const s = sub.data?.subscription;
  const planName = (code: PlanCode) => tp(`name.${code}`);
  const planPrice =
    s?.plan && s.plan.code !== 'BASIC' ? f.money(s.plan.priceMinor, s.plan.currency) : null;
  // A paid Pro period is running (renewing or ending).
  const paidPro = !!s?.renewal;
  // Active Pro plans; "other" = the ones the blogger is not on (for switching).
  const proPlans = (sub.data?.plans ?? []).filter((p) => p.code !== 'BASIC');
  const otherProPlans = proPlans.filter((p) => p.code !== s?.planCode);
  const switchPlan = useMutation({
    mutationFn: (plan: PlanCode) => api.post('/billing/switch', { plan }),
    onSuccess: (_, plan) => {
      refresh();
      toast(plan === s?.planCode ? t('switchUndoneToast') : t('switchedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const renew = useMutation({
    mutationFn: (plan: PlanCode) =>
      api.post<{ redirectUrl: string }>('/billing/checkout', { plan }),
    onSuccess: ({ redirectUrl }) => {
      window.location.href = redirectUrl;
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  return (
    <Stack gap={6}>
      <Suspense>
        <ReturnStatus />
      </Suspense>
      <PageHeader title={t('title')} description={t('lead')} />

      {sub.isLoading ? (
        <Skeleton className="h-56 rounded-card" />
      ) : !s ? (
        <PlanPicker mode="start" />
      ) : (
        <Stack gap={6}>
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader
                title={t('yourPlan')}
                actions={
                  <Badge tone={s.tier === 'PRO' ? 'primary' : 'neutral'}>
                    {s.inFreeDays && !paidPro ? 'Pro' : planName(s.planCode)}
                  </Badge>
                }
              />
              <Stack gap={4}>
                {planPrice && (
                  <Inline gap={2} align="baseline">
                    <span className="text-h1 font-extrabold text-ink">{planPrice}</span>
                    <Text tone="muted">
                      {s.planCode === 'PRO_YEARLY' ? tp('perYear') : tp('perMonth')}
                    </Text>
                  </Inline>
                )}
                {s.inFreeDays && (
                  <Text>
                    {t('freeDays', { count: s.trialDaysLeft, date: f.date(s.trialEndsAt) })}
                  </Text>
                )}
                {s.inFreeDays && !paidPro && (
                  <Text tone="muted">{t('afterFreeDays', { plan: planName(s.planCode) })}</Text>
                )}
                {paidPro && s.currentPeriodEnd && (
                  <div className="rounded-card border border-line p-4">
                    <Stack gap={2}>
                      <Badge
                        tone={s.renewal === 'renews' ? 'success' : 'neutral'}
                        className="self-start"
                      >
                        {s.renewal === 'renews' ? t('renewalOn') : t('renewalOff')}
                      </Badge>
                      {s.inFreeDays && (
                        <Text>{t('paidAfterFreeDays', { date: f.date(s.trialEndsAt) })}</Text>
                      )}
                      <Text>
                        {s.renewal === 'renews'
                          ? t('renewsAuto', {
                              date: f.date(s.currentPeriodEnd),
                              price: planPrice ?? '',
                            })
                          : t('endsOff', { date: f.date(s.currentPeriodEnd) })}
                      </Text>
                      {s.nextPlan && s.renewal === 'renews' && (
                        <Text weight="bold">
                          {t('switchScheduled', {
                            date: f.date(s.currentPeriodEnd),
                            plan: planName(s.nextPlan.code),
                            price: f.money(s.nextPlan.priceMinor, s.nextPlan.currency),
                          })}
                        </Text>
                      )}
                    </Stack>
                  </div>
                )}
                {s.tier === 'BASIC' && s.applications.limit != null && (
                  <Stack gap={2}>
                    <Text>
                      {t('basicUsage', { used: s.applications.used, limit: s.applications.limit })}
                    </Text>
                    <Progress
                      value={Math.min(100, (s.applications.used / s.applications.limit) * 100)}
                      label={t('basicUsage', {
                        used: s.applications.used,
                        limit: s.applications.limit,
                      })}
                    />
                  </Stack>
                )}
                {s.status === 'PAST_DUE' && (
                  <Alert tone="danger" title={t('pastDueTitle')}>
                    {s.nextChargeAt
                      ? t('pastDueBody', { date: f.date(s.nextChargeAt) })
                      : t('pastDueNoRetry')}
                  </Alert>
                )}
                <Inline gap={2} wrap>
                  {s.renewal === 'renews' && (
                    <Button variant="secondary" onClick={() => setConfirm('cancel')}>
                      {t('cancel')}
                    </Button>
                  )}
                  {s.renewal === 'ends' && s.hasCard && (
                    <Button loading={action.isPending} onClick={() => action.mutate('resume')}>
                      {t('resume')}
                    </Button>
                  )}
                  {/* Monthly <-> yearly: scheduled for the next renewal (needs the saved card). */}
                  {paidPro &&
                    s.hasCard &&
                    (s.nextPlan ? (
                      <Button
                        variant="ghost"
                        loading={switchPlan.isPending}
                        onClick={() => switchPlan.mutate(s.planCode)}
                      >
                        {t('keepPlan', { plan: planName(s.planCode) })}
                      </Button>
                    ) : (
                      otherProPlans.map((p) => (
                        <Button
                          key={p.code}
                          variant="secondary"
                          loading={switchPlan.isPending && switchPlan.variables === p.code}
                          onClick={() => switchPlan.mutate(p.code)}
                        >
                          {t('switchTo', {
                            plan: planName(p.code),
                            price: f.money(p.priceMinor, p.currency),
                          })}
                        </Button>
                      ))
                    ))}
                  {s.needsCardToRenew &&
                    proPlans.map((p) => (
                      <Button
                        key={p.code}
                        variant={p.code === s.planCode ? 'primary' : 'secondary'}
                        loading={renew.isPending && renew.variables === p.code}
                        onClick={() => renew.mutate(p.code)}
                      >
                        {p.code === s.planCode
                          ? t('renewPro', { price: f.money(p.priceMinor, p.currency) })
                          : t('renewPlan', {
                              plan: planName(p.code),
                              price: f.money(p.priceMinor, p.currency),
                            })}
                      </Button>
                    ))}
                </Inline>
                {s.needsCardToRenew && s.currentPeriodEnd && (
                  <Text size="small" tone="muted">
                    {t('renewNote', { date: f.date(s.currentPeriodEnd) })}
                  </Text>
                )}
                {paidPro &&
                  s.hasCard &&
                  !s.nextPlan &&
                  otherProPlans.length > 0 &&
                  s.currentPeriodEnd && (
                    <Text size="small" tone="muted">
                      {t('switchNote', { date: f.date(s.currentPeriodEnd) })}
                    </Text>
                  )}
                <Text size="small" tone="muted">
                  {t('cardsNote')}
                </Text>
              </Stack>
            </Card>
            <Card>
              <CardHeader title={t('card')} />
              {s.hasCard ? (
                <Stack gap={4}>
                  <Inline gap={2}>
                    <Icon name="card" size="md" />
                    <Text weight="bold" className="tabular-nums">
                      {s.cardMask ?? '•••• ••••'}
                    </Text>
                  </Inline>
                  {s.nextChargeAt && (
                    <Text size="small" tone="muted">
                      {t('nextCharge', { date: f.date(s.nextChargeAt) })}
                    </Text>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setConfirm('card')}>
                    {t('removeCard')}
                  </Button>
                </Stack>
              ) : (
                <Text tone="muted">{t('noCard')}</Text>
              )}
            </Card>
          </div>
          {s.canCheckout && !s.needsCardToRenew && <PlanPicker mode="upgrade" />}
        </Stack>
      )}

      <Card>
        <CardHeader title={t('history')} />
        {payments.data?.length ? (
          <Table>
            <THead>
              <TR>
                <TH>{t('date')}</TH>
                <TH>{t('type')}</TH>
                <TH>{t('amount')}</TH>
                <TH>{t('status')}</TH>
                <TH>{t('order')}</TH>
              </TR>
            </THead>
            <TBody>
              {payments.data.map((p) => (
                <TR key={p.id}>
                  <TD>{f.dateTime(p.createdAt)}</TD>
                  <TD>
                    {p.planCode ? planName(p.planCode) : t(`kind.${p.kind}`)}
                    {p.kind === 'renewal' ? ` · ${t('kind.renewal')}` : ''}
                  </TD>
                  <TD className="font-bold tabular-nums">{f.money(p.amount, p.currency)}</TD>
                  <TD>
                    <PaymentStatusBadge status={p.status} />
                    {p.status === 'FAILED' && p.failureReason && (
                      <span className="sr-only">{tk('FAILED')}</span>
                    )}
                  </TD>
                  <TD className="text-ink-muted tabular-nums">#{p.providerOrderId}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <Text tone="muted">{t('noPayments')}</Text>
        )}
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        closeLabel={tc('close')}
        title={confirm === 'card' ? t('removeCardTitle') : t('cancelTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {tc('back')}
            </Button>
            <Button
              variant="danger"
              loading={action.isPending}
              onClick={() => confirm && action.mutate(confirm)}
            >
              {confirm === 'card' ? t('removeCard') : t('cancel')}
            </Button>
          </>
        }
      >
        <Text tone="muted">
          {confirm === 'card'
            ? t('removeCardBody')
            : t('cancelBody', { date: s?.currentPeriodEnd ? f.date(s.currentPeriodEnd) : '' })}
        </Text>
      </Modal>
    </Stack>
  );
}
