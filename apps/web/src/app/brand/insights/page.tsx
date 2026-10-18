'use client';
import { COLLABORATION_TYPES, PAYMENT_TYPES, PLATFORMS } from '@briefluence/shared';
import {
  BarList,
  ChartCard,
  ColumnChart,
  DonutChart,
  Grid,
  Skeleton,
  Stack,
  Stat,
  Tabs,
  Text,
  type ChartRow,
} from '@briefluence/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';

type Period = 7 | 30 | 90;
/** Each value: searches that used it + opens of briefs that have it. */
type Signal = { key: string; count: number; searches: number; opens: number };
interface InsightsDto {
  days: Period;
  totalSignals: number;
  totalSearches: number;
  totalOpens: number;
  briefsOpened: number;
  activeBloggers: number;
  verifiedBloggers: number;
  platforms: Signal[];
  niches: Signal[];
  cities: Signal[];
  paymentTypes: Signal[];
  collaborationTypes: Signal[];
  contentFormats: Signal[];
  budgetBuckets: {
    min: number;
    max: number | null;
    count: number;
    searches: number;
    opens: number;
  }[];
  perDay: { date: string; count: number; searches: number; opens: number }[];
}

export default function BrandInsightsPage() {
  const t = useTranslations('insights');
  const te = useTranslations('enums');
  const f = useFormat();
  const o = useOptions();
  const [days, setDays] = useState<Period>(30);
  const q = useQuery({
    queryKey: ['brand', 'insights', days],
    queryFn: () => api.get<InsightsDto>('/brands/me/insights', { days }),
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  const labels = {
    table: t('showTable'),
    chart: t('showChart'),
    empty: t('empty'),
    category: t('category'),
  };
  const n = (v: number) => f.number(v);
  const split = (x?: { searches: number; opens: number }) =>
    x ? t('split', { searches: n(x.searches), opens: n(x.opens) }) : undefined;
  const byKey = (
    rows: Signal[],
    keys: readonly string[],
    label: (k: string) => string,
  ): ChartRow[] =>
    keys.map((k) => {
      const r = rows.find((x) => x.key === k);
      return { key: k, label: label(k), value: r?.count ?? 0, detail: split(r) };
    });
  const signalRows = (rows: Signal[], label: (k: string) => string): ChartRow[] =>
    rows.map((x) => ({ key: x.key, label: label(x.key), value: x.count, detail: split(x) }));

  const topNiche = d?.niches[0];
  // Bucket bounds are AMD; show them in the viewer's currency.
  const amd = (v: number) => f.display(v * 100, 'AMD').main.replace('≈ ', '');

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />

      {/* One filter row scoping everything below */}
      <Tabs
        aria-label={t('period')}
        value={String(days)}
        onChange={(v) => setDays(Number(v) as Period)}
        items={([7, 30, 90] as Period[]).map((p) => ({
          value: String(p),
          label: t('lastDays', { count: p }),
        }))}
      />

      {!d ? (
        <Grid cols={{ base: 1, md: 2 }} gap={6}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-card" />
          ))}
        </Grid>
      ) : (
        // Hold the previous render while a new period loads (no skeleton flash).
        <Stack
          gap={6}
          className={q.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}
        >
          <Grid cols={{ base: 2, lg: 4 }} gap={{ base: 2, md: 4 }}>
            <Stat
              label={t('kpi.searches')}
              value={n(d.totalSignals)}
              icon="search"
              hint={split({ searches: d.totalSearches, opens: d.totalOpens })}
            />
            <Stat
              label={t('kpi.bloggers')}
              value={n(d.activeBloggers)}
              icon="users"
              hint={t('kpi.ofVerified', { count: d.verifiedBloggers })}
            />
            <Stat
              label={t('kpi.opened')}
              value={n(d.briefsOpened)}
              icon="eye"
              hint={t('kpi.openedHint', { count: n(d.totalOpens) })}
            />
            <Stat
              label={t('kpi.topNiche')}
              value={topNiche ? o.niche(topNiche.key) : '—'}
              icon="star"
            />
          </Grid>

          <ChartCard
            title={t('perDay.title')}
            subtitle={t('perDay.subtitle')}
            valueLabel={t('signals')}
            labels={labels}
            format={n}
            rows={d.perDay.map((x) => ({
              key: x.date,
              label: f.date(`${x.date}T12:00:00+04:00`),
              value: x.count,
              detail: split(x),
            }))}
          >
            <ColumnChart
              format={n}
              rows={d.perDay.map((x) => ({
                key: x.date,
                label: new Date(`${x.date}T12:00:00+04:00`).getDate().toString(),
                detail: `${f.date(`${x.date}T12:00:00+04:00`)} · ${split(x)}`,
                value: x.count,
              }))}
            />
          </ChartCard>

          <Grid cols={{ base: 1, lg: 2 }} gap={6}>
            {(() => {
              const rows = byKey(d.platforms, PLATFORMS, (k) => te(`platform.${k}`));
              return (
                <ChartCard
                  title={t('platforms.title')}
                  subtitle={t('platforms.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <DonutChart
                    rows={rows}
                    order={[...PLATFORMS]}
                    centerLabel={t('total')}
                    format={n}
                  />
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = byKey(d.paymentTypes, PAYMENT_TYPES, (k) => te(`paymentType.${k}`));
              return (
                <ChartCard
                  title={t('payment.title')}
                  subtitle={t('payment.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <DonutChart
                    rows={rows}
                    order={['MONEY', 'BARTER', 'MIXED']}
                    centerLabel={t('total')}
                    format={n}
                  />
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = byKey(d.collaborationTypes, COLLABORATION_TYPES, (k) =>
                te(`collaboration.${k}`),
              );
              return (
                <ChartCard
                  title={t('collaboration.title')}
                  subtitle={t('collaboration.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <DonutChart
                    rows={rows}
                    order={[...COLLABORATION_TYPES]}
                    centerLabel={t('total')}
                    format={n}
                  />
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = signalRows(d.contentFormats, (k) => te(`contentFormat.${k}`));
              return (
                <ChartCard
                  title={t('formats.title')}
                  subtitle={t('formats.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <BarList rows={rows} format={n} />
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = signalRows(d.niches, o.niche);
              return (
                <ChartCard
                  title={t('niches.title')}
                  subtitle={t('niches.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <BarList rows={rows} format={n} />
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = d.budgetBuckets.map((b) => ({
                key: String(b.min),
                label: b.max == null ? `${amd(b.min)}+` : `${amd(b.min)}–${amd(b.max)}`,
                value: b.count,
                detail: split(b),
              }));
              return (
                <ChartCard
                  title={t('budget.title')}
                  subtitle={t('budget.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <ColumnChart
                    format={n}
                    xLabelEvery={1}
                    rows={d.budgetBuckets.map((b) => ({
                      key: String(b.min),
                      label:
                        b.max == null
                          ? `${f.compact(f.toDisplay(b.min * 100, 'AMD') / 100)}+`
                          : `${f.compact(f.toDisplay(b.min * 100, 'AMD') / 100)}–${f.compact(f.toDisplay(b.max * 100, 'AMD') / 100)}`,
                      detail: `${b.max == null ? `${amd(b.min)}+` : `${amd(b.min)}–${amd(b.max)}`} · ${split(b)}`,
                      value: b.count,
                    }))}
                  />
                  <Text size="small" tone="muted">
                    {t('budget.note')}
                  </Text>
                </ChartCard>
              );
            })()}
            {(() => {
              const rows = signalRows(d.cities, (k) => k);
              return (
                <ChartCard
                  title={t('cities.title')}
                  subtitle={t('cities.subtitle')}
                  valueLabel={t('signals')}
                  labels={labels}
                  format={n}
                  rows={rows}
                >
                  <BarList rows={rows} format={n} />
                </ChartCard>
              );
            })()}
          </Grid>
          <Text size="small" tone="muted">
            {t('privacy')}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}
