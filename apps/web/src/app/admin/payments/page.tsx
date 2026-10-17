'use client';
import type { Currency, PaymentStatus, SubscriptionStatus } from '@briefluence/shared';
import { EmptyState, Grid, Skeleton, Stack, Stat, TBody, TD, TH, THead, TR, Table, Text } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/AppShell';
import { PaymentStatusBadge, SubscriptionBadge } from '@/components/domain/badges';
import { api } from '@/lib/api';
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
    subscription: { status: SubscriptionStatus; user: { id: string; email: string } };
  }[];
  totals: { currency: Currency; amount: number }[];
}

export default function AdminPaymentsPage() {
  const t = useTranslations('admin.payments');
  const tb = useTranslations('billing');
  const f = useFormat();
  const q = useQuery({ queryKey: ['admin', 'payments'], queryFn: () => api.get<PaymentsDto>('/admin/payments') });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} />
      {q.data && (
        <Grid cols={{ base: 1, sm: 3 }} gap={4}>
          {q.data.totals.map((x) => (
            <Stat key={x.currency} label={t('collected', { currency: x.currency })} value={f.money(x.amount, x.currency)} icon="wallet" />
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
                  <SubscriptionBadge status={p.subscription.status} />
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
