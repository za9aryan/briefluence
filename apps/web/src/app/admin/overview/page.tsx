'use client';
import { DEAL_STATUSES, PLATFORMS } from '@briefluence/shared';
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
  type ChartRow,
} from '@briefluence/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';

type Period = 30 | 90 | 365;
type Unit = 'day' | 'week' | 'month';
type Kpi = { period: number; total: number };
type Point = { key: string; count: number };
interface AnalyticsDto {
  days: Period;
  unit: Unit;
  kpis: Record<'bloggers' | 'brands' | 'briefs' | 'applications' | 'shortlisted' | 'accepted', Kpi>;
  plans: Record<'TRIAL' | 'PRO' | 'BASIC' | 'NONE', number>;
  verification: Record<'APPROVED' | 'PENDING_REVIEW' | 'NOT_VERIFIED', number>;
  funnel: Record<'sent' | 'shortlisted' | 'accepted' | 'completed', number>;
  outcomes: Record<'WAITING' | 'ACCEPTED' | 'NOT_SELECTED', number>;
  dealStatuses: Point[];
  platforms: Point[];
  formats: Point[];
  series: Record<'applications' | 'briefs' | 'bloggers' | 'brands', Point[]>;
}

const PERIODS: { value: Period; key: 'last30' | 'last90' | 'last365' }[] = [
  { value: 30, key: 'last30' },
  { value: 90, key: 'last90' },
  { value: 365, key: 'last365' },
];

/** Admin landing: how the marketplace is doing in a period, plus the current state of bloggers and briefs. */
export default function AdminOverviewPage() {
  const t = useTranslations('admin.overview');
  const te = useTranslations('enums');
  const f = useFormat();
  const locale = useLocale();
  const [days, setDays] = useState<Period>(30);
  const q = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => api.get<AnalyticsDto>('/admin/analytics', { days }),
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  const n = (v: number) => f.number(v);
  const labels = {
    table: t('table'),
    chart: t('chart'),
    empty: t('empty'),
    category: t('category'),
  };

  // Bucket keys are Yerevan calendar dates (YYYY-MM-DD, start of day / week / month).
  const at = (key: string) => new Date(`${key}T12:00:00+04:00`);
  const short = (key: string, unit: Unit) =>
    unit === 'month'
      ? new Intl.DateTimeFormat(locale, { month: 'short' }).format(at(key))
      : unit === 'week'
        ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(at(key))
        : String(at(key).getDate());
  const long = (key: string, unit: Unit) =>
    unit === 'month'
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(at(key))
      : f.date(at(key).toISOString());
  const timeRows = (points: Point[], unit: Unit): ChartRow[] =>
    points.map((p) => ({
      key: p.key,
      label: short(p.key, unit),
      detail: long(p.key, unit),
      value: p.count,
    }));
  const tableRows = (points: Point[], unit: Unit): ChartRow[] =>
    points.map((p) => ({ key: p.key, label: long(p.key, unit), value: p.count }));

  const timeChart = (
    title: string,
    valueLabel: string,
    points: Point[],
    unit: Unit,
    subtitle?: string,
  ) => (
    <ChartCard
      title={title}
      subtitle={subtitle}
      valueLabel={valueLabel}
      labels={labels}
      format={n}
      rows={tableRows(points, unit)}
    >
      <ColumnChart
        format={n}
        rows={timeRows(points, unit)}
        xLabelEvery={unit === 'day' ? 5 : unit === 'week' ? 2 : 1}
      />
    </ChartCard>
  );
  const donut = (
    title: string,
    subtitle: string | undefined,
    rows: ChartRow[],
    centerLabel: string,
  ) => (
    <ChartCard
      title={title}
      subtitle={subtitle}
      valueLabel={t('series.count')}
      labels={labels}
      format={n}
      rows={rows}
    >
      <DonutChart rows={rows} order={rows.map((r) => r.key)} centerLabel={centerLabel} format={n} />
    </ChartCard>
  );
  const bars = (title: string, subtitle: string | undefined, rows: ChartRow[]) => (
    <ChartCard
      title={title}
      subtitle={subtitle}
      valueLabel={t('series.count')}
      labels={labels}
      format={n}
      rows={rows}
    >
      <BarList rows={rows} format={n} />
    </ChartCard>
  );

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      <Tabs
        aria-label={t('period')}
        value={String(days)}
        onChange={(v) => setDays(Number(v) as Period)}
        items={PERIODS.map((p) => ({ value: String(p.value), label: t(p.key) }))}
      />

      {!d ? (
        <Grid cols={{ base: 1, md: 2 }} gap={6}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-card" />
          ))}
        </Grid>
      ) : (
        <Stack
          gap={6}
          className={q.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}
        >
          <Grid cols={{ base: 2, lg: 4 }} gap={{ base: 2, md: 4 }}>
            <Stat
              label={t('kpi.bloggers')}
              value={n(d.kpis.bloggers.period)}
              icon="user"
              hint={t('allTime', { count: n(d.kpis.bloggers.total) })}
            />
            <Stat
              label={t('kpi.brands')}
              value={n(d.kpis.brands.period)}
              icon="building"
              hint={t('allTime', { count: n(d.kpis.brands.total) })}
            />
            <Stat
              label={t('kpi.briefs')}
              value={n(d.kpis.briefs.period)}
              icon="briefcase"
              hint={t('allTime', { count: n(d.kpis.briefs.total) })}
            />
            <Stat
              label={t('kpi.applications')}
              value={n(d.kpis.applications.period)}
              icon="send"
              hint={t('allTime', { count: n(d.kpis.applications.total) })}
            />
            <Stat
              label={t('kpi.shortlisted')}
              value={n(d.kpis.shortlisted.period)}
              icon="star"
              hint={t('allTime', { count: n(d.kpis.shortlisted.total) })}
            />
            <Stat
              label={t('kpi.accepted')}
              value={n(d.kpis.accepted.period)}
              icon="check-circle"
              hint={t('allTime', { count: n(d.kpis.accepted.total) })}
            />
            <Stat
              label={t('kpi.free')}
              value={n(d.plans.TRIAL)}
              icon="gift"
              hint={t('ofBloggers', { count: n(d.kpis.bloggers.total) })}
            />
            <Stat
              label={t('kpi.paid')}
              value={n(d.plans.PRO)}
              icon="wallet"
              hint={t('ofBloggers', { count: n(d.kpis.bloggers.total) })}
            />
          </Grid>

          {timeChart(
            t('charts.applications'),
            t('series.applications'),
            d.series.applications,
            d.unit,
          )}

          <Grid cols={{ base: 1, lg: 2 }} gap={6}>
            {donut(
              t('charts.plans'),
              t('noPlan', { count: n(d.plans.NONE) }),
              (['TRIAL', 'PRO', 'BASIC'] as const).map((k) => ({
                key: k,
                label: t(`plan.${k}`),
                value: d.plans[k],
              })),
              t('series.bloggers'),
            )}
            {donut(
              t('charts.who'),
              undefined,
              [
                { key: 'bloggers', label: t('series.bloggers'), value: d.kpis.bloggers.period },
                { key: 'brands', label: t('series.brands'), value: d.kpis.brands.period },
              ],
              t('series.signups'),
            )}
            {bars(
              t('charts.funnel'),
              t('charts.outcomesSubtitle'),
              (['sent', 'shortlisted', 'accepted', 'completed'] as const).map((k) => ({
                key: k,
                label: t(`funnelStep.${k}`),
                value: d.funnel[k],
                detail:
                  k !== 'sent' && d.funnel.sent > 0
                    ? t('ofSent', { value: f.percent((d.funnel[k] / d.funnel.sent) * 100) })
                    : undefined,
              })),
            )}
            {donut(
              t('charts.outcomes'),
              t('charts.outcomesSubtitle'),
              (['WAITING', 'ACCEPTED', 'NOT_SELECTED'] as const).map((k) => ({
                key: k,
                label: t(`outcome.${k}`),
                value: d.outcomes[k],
              })),
              t('series.applications'),
            )}
            {donut(
              t('charts.verification'),
              t('charts.plansSubtitle'),
              (['APPROVED', 'PENDING_REVIEW', 'NOT_VERIFIED'] as const).map((k) => ({
                key: k,
                label: t(`verificationState.${k}`),
                value: d.verification[k],
              })),
              t('series.bloggers'),
            )}
            {bars(
              t('charts.dealStatuses'),
              t('charts.plansSubtitle'),
              DEAL_STATUSES.map((s) => ({
                key: s,
                label: te(`dealStatus.${s}`),
                value: d.dealStatuses.find((x) => x.key === s)?.count ?? 0,
              })).filter((r) => r.value > 0),
            )}
            {timeChart(t('charts.briefs'), t('series.briefs'), d.series.briefs, d.unit)}
            {timeChart(
              t('charts.signups'),
              t('series.signups'),
              d.series.bloggers.map((p, i) => ({
                key: p.key,
                count: p.count + (d.series.brands[i]?.count ?? 0),
              })),
              d.unit,
              t('charts.signupsSubtitle'),
            )}
            {bars(
              t('charts.platforms'),
              undefined,
              PLATFORMS.map((p) => ({
                key: p,
                label: te(`platform.${p}`),
                value: d.platforms.find((x) => x.key === p)?.count ?? 0,
              })),
            )}
            {bars(
              t('charts.formats'),
              undefined,
              d.formats.map((x) => ({
                key: x.key,
                label: te(`contentFormat.${x.key}`),
                value: x.count,
              })),
            )}
          </Grid>
        </Stack>
      )}
    </Stack>
  );
}
