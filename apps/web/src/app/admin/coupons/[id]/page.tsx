'use client';
import type { Currency } from '@briefluence/shared';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  ErrorState,
  Grid,
  Inline,
  Skeleton,
  Stack,
  Stat,
  Switch,
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
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/app/AppShell';
import {
  type AdminCouponDetail,
  CouponStateBadge,
  useCouponGives,
  useCouponUses,
} from '@/components/admin/coupons';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

export default function AdminCouponPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin.coupons');
  const td = useTranslations('admin.coupons.detail');
  const ts = useTranslations('admin.coupons.stats');
  const tn = useTranslations('billing.plans.name');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const gives = useCouponGives();
  const usesText = useCouponUses();
  const coupon = useQuery({
    queryKey: ['admin', 'coupons', id],
    queryFn: () => api.get<AdminCouponDetail>(`/admin/coupons/${id}`),
  });
  const toggle = useMutation({
    mutationFn: (active: boolean) => api.patch(`/admin/coupons/${id}`, { active }),
    onSuccess: (_, active) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      toast(active ? t('turnedOn') : t('turnedOff'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const back = { href: '/admin/coupons', label: t('back') };

  if (coupon.isError)
    return (
      <Stack gap={6}>
        <PageHeader title={t('title')} back={back} />
        <ErrorState title={errorMessage(coupon.error)} />
      </Stack>
    );
  const c = coupon.data;
  if (!c)
    return (
      <Stack gap={6}>
        <PageHeader title={t('title')} back={back} />
        <Skeleton className="h-64 rounded-card" />
      </Stack>
    );

  const money = (r: Partial<Record<Currency, number>>) =>
    (Object.entries(r) as [Currency, number][]).map(([cur, v]) => f.money(v, cur)).join(' + ') ||
    f.money(0, 'USD');

  return (
    <Stack gap={6}>
      <PageHeader
        back={back}
        title={<span className="font-mono">{c.code}</span>}
        description={gives(c)}
        actions={
          <Inline gap={2}>
            <CouponStateBadge state={c.state} />
            <Button
              variant="secondary"
              icon="copy"
              onClick={() =>
                void navigator.clipboard.writeText(c.code).then(() => toast(t('copied')))
              }
            >
              {t('copy')}
            </Button>
          </Inline>
        }
      />

      <Grid cols={{ base: 2, lg: 4 }} gap={4}>
        <Stat
          label={ts('uses')}
          value={c.maxUses == null ? c.stats.uses : `${c.stats.uses} / ${c.maxUses}`}
          hint={usesText(c)}
          icon="users"
        />
        <Stat label={ts('paying')} value={c.stats.paying} hint={ts('payingHint')} icon="wallet" />
        <Stat
          label={ts('conversion')}
          value={c.stats.uses ? `${c.stats.conversion}%` : '—'}
          icon="trend"
        />
        <Stat label={ts('renewing')} value={c.stats.renewing} icon="refresh" />
      </Grid>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title={td('who')} />
          {c.redemptions.length === 0 ? (
            <EmptyState size="sm" icon="users" title={td('noneYet')} />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{td('blogger')}</TH>
                  <TH>{td('date')}</TH>
                  <TH>{td('plan')}</TH>
                  <TH>{td('paidSince')}</TH>
                  <TH>{td('now')}</TH>
                </TR>
              </THead>
              <TBody>
                {c.redemptions.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Stack gap={0} className="min-w-0">
                        <Text size="small" weight="bold">
                          {r.name ?? r.email}
                          {r.username ? ` @${r.username}` : ''}
                        </Text>
                        {r.name && (
                          <Text size="small" tone="muted" className="wrap-anywhere">
                            {r.email}
                          </Text>
                        )}
                      </Stack>
                    </TD>
                    <TD className="whitespace-nowrap">{f.date(r.redeemedAt)}</TD>
                    <TD>{tn(r.planCode)}</TD>
                    <TD className="font-bold tabular-nums">{money(r.revenue)}</TD>
                    <TD>
                      <Badge tone={r.renewing ? 'success' : 'neutral'}>
                        {r.renewing ? td('renewing') : td('stopped')}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <Stack gap={4}>
            <Switch
              checked={c.active}
              disabled={toggle.isPending}
              onChange={(v) => toggle.mutate(v)}
              label={td('active')}
            />
            <DescriptionList
              items={[
                { label: td('gives'), value: gives(c) },
                { label: td('plans'), value: c.plans.map((p) => tn(p)).join(', ') },
                {
                  label: td('limit'),
                  value: c.maxUses == null ? t('form.usesUnlimited') : String(c.maxUses),
                },
                {
                  label: td('expires'),
                  value: c.expiresAt ? f.date(c.expiresAt) : t('noExpiry'),
                },
                ...(c.paddleTimesUsed != null
                  ? [{ label: ts('paddle'), value: String(c.paddleTimesUsed) }]
                  : []),
                ...(c.note ? [{ label: td('note'), value: c.note }] : []),
                {
                  label: td('createdBy'),
                  value: c.createdBy
                    ? td('createdLine', { date: f.date(c.createdAt), email: c.createdBy })
                    : f.date(c.createdAt),
                },
              ]}
            />
          </Stack>
        </Card>
      </div>
    </Stack>
  );
}
