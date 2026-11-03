'use client';
import type { Currency, PaymentStatus, SubscriptionStatus, PlanCode } from '@briefluence/shared';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Grid,
  Skeleton,
  Stack,
  Stat,
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
import { PageHeader } from '@/components/app/AppShell';
import { PaymentStatusBadge, PlanBadge } from '@/components/domain/badges';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

interface PaymentsDto {
  items: {
    id: string;
    amount: number;
    currency: Currency;
    status: PaymentStatus;
    kind: 'checkout' | 'renewal';
    provider: string;
    providerOrderId: string;
    failureReason: string | null;
    createdAt: string;
    planCode: PlanCode | null;
    subscription: {
      status: SubscriptionStatus;
      planCode: PlanCode;
      trialEndsAt: string;
      user: { id: string; email: string };
    };
  }[];
  totals: { currency: Currency; amount: number }[];
}

type Scenario = 'renewal_success' | 'renewal_failed' | 'cancellation';
const SCENARIOS: Scenario[] = ['renewal_success', 'renewal_failed', 'cancellation'];

interface DemoSubscription {
  id: string;
  email: string;
  status: SubscriptionStatus;
  planCode: PlanCode;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string;
}

/**
 * Paddle sandbox only: ask Paddle to send renewal / failed payment / cancellation webhooks for a
 * test subscription. The API answers 404 outside test mode, and then the panel is hidden.
 */
function PaddleDemoPanel() {
  const t = useTranslations('admin.payments.demo');
  const tp = useTranslations('admin.payments');
  const tb = useTranslations('billing');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'paddle-demo'],
    queryFn: () => api.get<DemoSubscription[]>('/billing/paddle/demo/subscriptions'),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const simulate = useMutation({
    mutationFn: (v: { subscriptionId: string; scenario: Scenario }) =>
      api.post('/billing/paddle/demo/simulate', v),
    onSuccess: () => {
      toast(t('sent'));
      // Webhooks land a few seconds later; refresh then.
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['admin'] }), 5000);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  if (!q.data) return null;
  return (
    <Card>
      <CardHeader title={t('title')} />
      <Stack gap={4}>
        <Text size="small" tone="muted">
          {t('lead')}
        </Text>
        {!q.data.length ? (
          <Text tone="muted">{t('empty')}</Text>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{tp('user')}</TH>
                <TH>{tb('type')}</TH>
                <TH>{t('periodEnd')}</TH>
                <TH>{t('actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {q.data.map((s) => (
                <TR key={s.id}>
                  <TD className="wrap-anywhere">{s.email}</TD>
                  <TD>
                    <PlanBadge {...s} />
                  </TD>
                  <TD className="tabular-nums">
                    {s.currentPeriodEnd ? f.dateTime(s.currentPeriodEnd) : '—'}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      {SCENARIOS.map((scenario) => (
                        <Button
                          key={scenario}
                          size="sm"
                          variant={scenario === 'renewal_success' ? 'secondary' : 'ghost'}
                          loading={
                            simulate.isPending &&
                            simulate.variables?.subscriptionId === s.id &&
                            simulate.variables.scenario === scenario
                          }
                          disabled={simulate.isPending}
                          onClick={() => simulate.mutate({ subscriptionId: s.id, scenario })}
                        >
                          {t(scenario)}
                        </Button>
                      ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}

export default function AdminPaymentsPage() {
  const t = useTranslations('admin.payments');
  const tb = useTranslations('billing');
  const f = useFormat();
  const q = useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: () => api.get<PaymentsDto>('/admin/payments'),
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} />
      <PaddleDemoPanel />
      {q.data && (
        <Grid cols={{ base: 1, sm: 3 }} gap={4}>
          {q.data.totals.map((x) => (
            <Stat
              key={x.currency}
              label={t('collected', { currency: x.currency })}
              value={f.money(x.amount, x.currency)}
              icon="wallet"
            />
          ))}
          <Stat label={t('count')} value={f.number(q.data.items.length)} icon="card" />
        </Grid>
      )}
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !q.data?.items.length ? (
        <EmptyState icon="wallet" title={t('empty')} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{tb('date')}</TH>
              <TH>{t('user')}</TH>
              <TH>{tb('type')}</TH>
              <TH>{tb('amount')}</TH>
              <TH>{tb('status')}</TH>
              <TH>{t('subscription')}</TH>
              <TH>{tb('order')}</TH>
            </TR>
          </THead>
          <TBody>
            {q.data.items.map((p) => (
              <TR key={p.id}>
                <TD>{f.dateTime(p.createdAt)}</TD>
                <TD>{p.subscription.user.email}</TD>
                <TD>{tb(`kind.${p.kind}`)}</TD>
                <TD className="font-bold tabular-nums">{f.money(p.amount, p.currency)}</TD>
                <TD>
                  <PaymentStatusBadge status={p.status} />
                  {p.failureReason && (
                    <Text size="small" tone="muted">
                      {p.failureReason}
                    </Text>
                  )}
                </TD>
                <TD>
                  <PlanBadge {...p.subscription} />
                </TD>
                <TD className="tabular-nums text-ink-muted">
                  {p.provider} #{p.providerOrderId}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Stack>
  );
}
