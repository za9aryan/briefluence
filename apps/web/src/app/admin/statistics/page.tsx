'use client';
import {
  Alert,
  BarList,
  Card,
  CardHeader,
  ChartCard,
  ColumnChart,
  DonutChart,
  ErrorState,
  Grid,
  Inline,
  Skeleton,
  Stack,
  Stat,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Tabs,
  Text,
  type ChartRow,
} from '@briefluence/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

type Period = 7 | 30 | 90;
type Point = { key: string; count: number };
type Kpi = { value: number; previous: number };
interface TrafficDto {
  enabled: true;
  days: Period;
  kpis: Record<
    | 'visitors'
    | 'newVisitors'
    | 'sessions'
    | 'pageViews'
    | 'avgSession'
    | 'engagementRate'
    | 'bounceRate'
    | 'signups'
    | 'conversion',
    Kpi
  >;
  daily: { day: string; visitors: number; sessions: number; pageViews: number; signups: number }[];
  channels: Point[];
  sources: Point[];
  countries: Point[];
  cities: Point[];
  devices: Point[];
  browsers: Point[];
  os: Point[];
  languages: Point[];
  newVsReturning: Point[];
  pages: { path: string; views: number; visitors: number }[];
  landing: { path: string; sessions: number; engagementRate: number }[];
  hours: number[];
  weekdays: number[];
}
interface LiveDto {
  enabled: true;
  active: number;
  perMinute: number[];
  pages: Point[];
  countries: Point[];
  devices: Point[];
}
type Off = { enabled: false };

const PERIODS: { value: Period; key: 'last7' | 'last30' | 'last90' }[] = [
  { value: 7, key: 'last7' },
  { value: 30, key: 'last30' },
  { value: 90, key: 'last90' },
];

/** Website traffic from Google Analytics (who visits, from where) next to our own sign-ups. */
export default function AdminStatisticsPage() {
  const t = useTranslations('admin.traffic');
  const errorMessage = useErrorMessage();
  const [days, setDays] = useState<Period>(30);
  const q = useQuery({
    queryKey: ['admin', 'traffic', days],
    queryFn: () => api.get<TrafficDto | Off>('/admin/traffic', { days }),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      {d && !d.enabled ? (
        <Alert tone="info" title={t('setup.title')}>
          {t('setup.body')}
        </Alert>
      ) : (
        <>
          <LivePanel />
          <Tabs
            aria-label={t('period')}
            value={String(days)}
            onChange={(v) => setDays(Number(v) as Period)}
            items={PERIODS.map((p) => ({ value: String(p.value), label: t(p.key) }))}
          />
          {q.isError && !d ? (
            <ErrorState title={t('error')} description={errorMessage(q.error)} />
          ) : !d ? (
            <Grid cols={{ base: 1, md: 2 }} gap={6}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 rounded-card" />
              ))}
            </Grid>
          ) : (
            <Report d={d} fetching={q.isFetching} />
          )}
        </>
      )}
    </Stack>
  );
}

/** People on the site in the last 30 minutes; refreshes every 30 seconds. */
function LivePanel() {
  const t = useTranslations('admin.traffic.live');
  const tt = useTranslations('admin.traffic');
  const f = useFormat();
  const live = useQuery({
    queryKey: ['admin', 'traffic', 'live'],
    queryFn: () => api.get<LiveDto | Off>('/admin/traffic/live'),
    refetchInterval: 30_000,
  });
  const l = live.data;
  if (!l || !l.enabled) return <Skeleton className="h-48 rounded-card" />;
  const n = (v: number) => f.number(v);
  const minutes: ChartRow[] = l.perMinute.map((v, i) => {
    const ago = l.perMinute.length - 1 - i;
    return {
      key: String(ago),
      label: ago % 5 === 0 ? (ago === 0 ? '0' : `−${ago}`) : '',
      detail: t('minutesAgo', { count: ago }),
      value: v,
    };
  });
  const list = (title: string, rows: Point[], label?: (k: string) => string) => (
    <Stack gap={2}>
      <Text size="label" tone="muted">
        {title}
      </Text>
      {rows.length === 0 ? (
        <Text size="small" tone="muted">
          —
        </Text>
      ) : (
        <BarList
          rows={rows.map((p) => ({ key: p.key, label: label?.(p.key) ?? p.key, value: p.count }))}
          format={n}
          max={5}
        />
      )}
    </Stack>
  );
  const device = (k: string) => (tt.has(`device.${k}`) ? tt(`device.${k}`) : k);

  return (
    <Card>
      <Stack gap={6}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Stack gap={1}>
            <Inline gap={2} align="center">
              <span className="relative flex size-3" aria-hidden>
                {l.active > 0 && (
                  <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                )}
                <span
                  className={`relative inline-flex size-3 rounded-full ${l.active > 0 ? 'bg-success' : 'bg-line'}`}
                />
              </span>
              <Text size="label" tone="muted">
                {t('title')}
              </Text>
            </Inline>
            <p className="text-h1 font-bold text-ink md:text-display" aria-live="polite">
              {t('people', { count: l.active })}
            </p>
            <Text size="small" tone="muted">
              {t('hint')}
            </Text>
          </Stack>
          <Stack gap={2} className="w-full lg:max-w-md">
            <Text size="label" tone="muted">
              {t('perMinute')}
            </Text>
            <ColumnChart rows={minutes} format={n} height={80} xLabelEvery={1} />
          </Stack>
        </div>
        {l.active === 0 ? (
          <Text size="small" tone="muted">
            {t('nobody')}
          </Text>
        ) : (
          <Grid cols={{ base: 1, md: 3 }} gap={6}>
            {list(t('pages'), l.pages)}
            {list(t('countries'), l.countries)}
            {list(t('devices'), l.devices, device)}
          </Grid>
        )}
      </Stack>
    </Card>
  );
}

function Report({ d, fetching }: { d: TrafficDto; fetching: boolean }) {
  const t = useTranslations('admin.traffic');
  const to = useTranslations('admin.overview');
  const f = useFormat();
  const locale = useLocale();
  const n = (v: number) => f.number(v);
  const pct = (v: number) => f.percent(v);
  const labels = {
    table: to('table'),
    chart: to('chart'),
    empty: to('empty'),
    category: to('category'),
  };

  /** "▲ 12% vs previous 30 days" for a KPI. */
  const change = (k: Kpi) => {
    if (k.previous === 0 && k.value === 0) return t('change.same', { days: d.days });
    if (k.previous === 0) return t('change.new', { days: d.days });
    const diff = ((k.value - k.previous) / k.previous) * 100;
    if (Math.abs(diff) < 0.5) return t('change.same', { days: d.days });
    return t(diff > 0 ? 'change.up' : 'change.down', { value: pct(Math.abs(diff)), days: d.days });
  };
  const duration = (sec: number) =>
    t('duration', { min: Math.floor(sec / 60), sec: Math.round(sec % 60) });

  const at = (day: string) => new Date(`${day}T12:00:00+04:00`);
  const dayRows = (pick: (x: TrafficDto['daily'][number]) => number): ChartRow[] =>
    d.daily.map((x) => ({
      key: x.day,
      label: String(at(x.day).getDate()),
      detail: f.date(at(x.day).toISOString()),
      value: pick(x),
    }));
  const labelled = (rows: Point[], prefix?: 'channel' | 'device' | 'visitor'): ChartRow[] =>
    rows.map((p) => ({
      key: p.key,
      label: prefix && t.has(`${prefix}.${p.key}`) ? t(`${prefix}.${p.key}`) : p.key,
      value: p.count,
    }));

  const bars = (title: string, rows: ChartRow[], valueLabel: string, subtitle?: string) => (
    <ChartCard
      title={title}
      subtitle={subtitle}
      valueLabel={valueLabel}
      labels={labels}
      format={n}
      rows={rows}
    >
      <BarList rows={rows} format={n} />
    </ChartCard>
  );
  const columns = (
    title: string,
    rows: ChartRow[],
    valueLabel: string,
    subtitle?: string,
    xLabelEvery?: number,
  ) => (
    <ChartCard
      title={title}
      subtitle={subtitle}
      valueLabel={valueLabel}
      labels={labels}
      format={n}
      rows={rows.map((r) => ({ ...r, label: r.detail ?? r.label }))}
    >
      <ColumnChart rows={rows} format={n} xLabelEvery={xLabelEvery} />
    </ChartCard>
  );
  const donut = (title: string, rows: ChartRow[], order: string[], center: string) => (
    <ChartCard title={title} valueLabel={center} labels={labels} format={n} rows={rows}>
      <DonutChart rows={rows} order={order} centerLabel={center} format={n} />
    </ChartCard>
  );

  const hourFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const hourRows: ChartRow[] = d.hours.map((v, h) => ({
    key: String(h),
    label: String(h),
    detail: hourFmt.format(new Date(2026, 0, 1, h)),
    value: v,
  }));
  // dayOfWeek: 0 = Sunday; show Monday first. 2026-01-04 was a Sunday.
  const wd = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const wdLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const weekdayRows: ChartRow[] = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    key: String(i),
    label: wd.format(new Date(2026, 0, 4 + i)),
    detail: wdLong.format(new Date(2026, 0, 4 + i)),
    value: d.weekdays[i] ?? 0,
  }));
  const k = d.kpis;
  const every = d.days === 7 ? 1 : d.days === 30 ? 5 : 15;

  return (
    <Stack gap={6} className={fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <Grid cols={{ base: 2, lg: 4 }} gap={{ base: 2, md: 4 }}>
        <Stat
          label={t('kpi.visitors')}
          value={n(k.visitors.value)}
          icon="users"
          hint={change(k.visitors)}
        />
        <Stat
          label={t('kpi.newVisitors')}
          value={n(k.newVisitors.value)}
          icon="user"
          hint={change(k.newVisitors)}
        />
        <Stat
          label={t('kpi.sessions')}
          value={n(k.sessions.value)}
          icon="globe"
          hint={change(k.sessions)}
        />
        <Stat
          label={t('kpi.pageViews')}
          value={n(k.pageViews.value)}
          icon="eye"
          hint={change(k.pageViews)}
        />
        <Stat
          label={t('kpi.avgSession')}
          value={duration(k.avgSession.value)}
          icon="clock"
          hint={change(k.avgSession)}
        />
        <Stat
          label={t('kpi.engagementRate')}
          value={pct(k.engagementRate.value * 100)}
          icon="target"
          hint={t('kpi.engagementHint')}
        />
        <Stat
          label={t('kpi.signups')}
          value={n(k.signups.value)}
          icon="send"
          hint={change(k.signups)}
        />
        <Stat
          label={t('kpi.conversion')}
          value={pct(k.conversion.value)}
          icon="trend"
          hint={t('kpi.conversionHint')}
        />
      </Grid>

      {columns(
        t('charts.daily'),
        dayRows((x) => x.visitors),
        t('series.visitors'),
        t('updated'),
        every,
      )}

      <Grid cols={{ base: 1, lg: 2 }} gap={6}>
        {bars(
          t('charts.channels'),
          labelled(d.channels, 'channel'),
          t('series.visits'),
          t('charts.channelsSubtitle'),
        )}
        {bars(
          t('charts.sources'),
          labelled(d.sources),
          t('series.visits'),
          t('charts.sourcesSubtitle'),
        )}
        {columns(
          t('charts.signups'),
          dayRows((x) => x.signups),
          t('series.signups'),
          t('charts.signupsSubtitle'),
          every,
        )}
        {donut(
          t('charts.devices'),
          labelled(d.devices, 'device').filter((r) =>
            ['desktop', 'mobile', 'tablet'].includes(r.key),
          ),
          ['mobile', 'desktop', 'tablet'],
          t('series.visitors'),
        )}
        {bars(t('charts.countries'), labelled(d.countries), t('series.visitors'))}
        {bars(t('charts.cities'), labelled(d.cities), t('series.visitors'))}
        {donut(
          t('charts.newVsReturning'),
          labelled(d.newVsReturning, 'visitor').filter((r) => ['new', 'returning'].includes(r.key)),
          ['new', 'returning'],
          t('series.visitors'),
        )}
        {bars(t('charts.languages'), labelled(d.languages), t('series.visitors'))}
        {columns(t('charts.hours'), hourRows, t('series.visitors'), t('charts.hoursSubtitle'), 3)}
        {columns(
          t('charts.weekdays'),
          weekdayRows,
          t('series.visits'),
          t('charts.weekdaysSubtitle'),
          1,
        )}
        {bars(t('charts.browsers'), labelled(d.browsers), t('series.visitors'))}
        {bars(t('charts.os'), labelled(d.os), t('series.visitors'))}
      </Grid>

      <Grid cols={{ base: 1, '2xl': 2 }} gap={6}>
        <Card>
          <Stack gap={4}>
            <CardHeader title={t('charts.pages')} />
            <PathTable
              head={[t('col.page'), t('col.views'), t('col.visitors')]}
              rows={d.pages.map((p) => [p.path, n(p.views), n(p.visitors)])}
              empty={to('empty')}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardHeader title={t('charts.landing')} description={t('charts.landingSubtitle')} />
            <PathTable
              head={[t('col.page'), t('col.visits'), t('col.engaged')]}
              rows={d.landing.map((p) => [p.path, n(p.sessions), pct(p.engagementRate * 100)])}
              empty={to('empty')}
            />
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}

function PathTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0)
    return (
      <Text size="small" tone="muted" className="py-6 text-center">
        {empty}
      </Text>
    );
  return (
    <Table className="min-w-[420px]">
      <THead>
        <TR>
          {head.map((h, i) => (
            <TH key={h} className={i > 0 ? 'text-right' : undefined}>
              {h}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r[0]}>
            {r.map((c, i) =>
              i === 0 ? (
                <TD key={i} className="font-mono text-small wrap-anywhere">
                  {c}
                </TD>
              ) : (
                <TD key={i} className="text-right font-bold tabular-nums whitespace-nowrap">
                  {c}
                </TD>
              ),
            )}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
