import { BetaAnalyticsDataClient, protos } from '@google-analytics/data';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TIMEZONE } from '@briefluence/shared';
import { AppError } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import {
  byIndex,
  dailySeries,
  lastDays,
  periodTotals,
  points,
  readRows,
  share,
  type GaReport,
} from './traffic.report';

export const TRAFFIC_PERIODS = [7, 30, 90] as const;
export type TrafficPeriod = (typeof TRAFFIC_PERIODS)[number];

type RunReport = protos.google.analytics.data.v1beta.IRunReportRequest;
type RunRealtime = protos.google.analytics.data.v1beta.IRunRealtimeReportRequest;

const DAY = 86_400_000;
const REPORT_TTL = 10 * 60_000;
const LIVE_TTL = 30_000;
const yerevanDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
const dims = (...names: string[]) => names.map((name) => ({ name }));
const mets = (...names: string[]) => names.map((name) => ({ name }));
const desc = (metricName: string) => [{ metric: { metricName }, desc: true }];

/** KPI metrics, in this order, for the period and the one before it. */
const KPI_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'screenPageViews',
  'averageSessionDuration',
  'engagementRate',
  'bounceRate',
] as const;

/**
 * Website traffic for the admin Statistics page, read from Google Analytics 4 with the Data API
 * (https://developers.google.com/analytics/devguides/reporting/data/v1). Reports are cached for
 * 10 minutes and the realtime one for 30 seconds to stay well inside the property's quota
 * (https://developers.google.com/analytics/devguides/reporting/data/v1/quotas). Sign-ups come
 * from our own database so the page can show how many visitors became accounts.
 */
@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);
  private readonly client: BetaAnalyticsDataClient | null;
  private readonly property: string | null;
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) env: Env,
  ) {
    const on = env.GA_PROPERTY_ID && env.GA_CLIENT_EMAIL && env.GA_PRIVATE_KEY;
    this.property = on ? `properties/${env.GA_PROPERTY_ID}` : null;
    // Service-account credentials passed directly (google-auth-library JWTInput) instead of a
    // key file, so the key can live in .env.
    this.client = on
      ? new BetaAnalyticsDataClient({
          credentials: {
            client_email: env.GA_CLIENT_EMAIL,
            private_key: env.GA_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          },
        })
      : null;
  }

  get enabled() {
    return this.client != null;
  }

  private cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const now = this.clock.now().getTime();
    const hit = this.cache.get(key);
    if (hit && now - hit.at < ttl) return hit.value as Promise<T>;
    const value = load();
    this.cache.set(key, { at: now, value });
    // A failed call is not cached: the next request tries again.
    value.catch(() => this.cache.delete(key));
    return value;
  }

  private async report(req: Omit<RunReport, 'property'>): Promise<GaReport> {
    const [res] = await this.client!.runReport({ property: this.property!, ...req });
    return res;
  }

  private async realtime(req: Omit<RunRealtime, 'property'>): Promise<GaReport> {
    const [res] = await this.client!.runRealtimeReport({ property: this.property!, ...req });
    return res;
  }

  /** Google's errors carry no secrets, but keep only the message and hide details from the page. */
  private failed(e: unknown): never {
    this.logger.warn(`Google Analytics request failed: ${(e as Error)?.message ?? e}`);
    throw new AppError('PROVIDER_ERROR', 'Google Analytics did not answer');
  }

  overview(days: TrafficPeriod) {
    if (!this.client) return Promise.resolve({ enabled: false as const });
    return this.cached(`overview:${days}`, REPORT_TTL, () =>
      this.loadOverview(days).catch((e) => this.failed(e)),
    );
  }

  live() {
    if (!this.client) return Promise.resolve({ enabled: false as const });
    return this.cached('live', LIVE_TTL, () => this.loadLive().catch((e) => this.failed(e)));
  }

  private async loadOverview(days: TrafficPeriod) {
    const now = this.clock.now();
    // Relative GA dates use the property's reporting time zone (set it to Yerevan).
    const current = { startDate: `${days - 1}daysAgo`, endDate: 'today' };
    const previous = { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo` };
    const range = [current];
    const top = (dimension: string, metric = 'activeUsers', limit = 10) =>
      this.report({
        dateRanges: range,
        dimensions: dims(dimension),
        metrics: mets(metric),
        orderBys: desc(metric),
        limit,
      });

    const [
      totals,
      daily,
      channels,
      sources,
      countries,
      cities,
      devices,
      browsers,
      os,
      languages,
      newVsReturning,
      pages,
      landing,
      hours,
      weekdays,
    ] = await Promise.all([
      this.report({ dateRanges: [current, previous], metrics: mets(...KPI_METRICS) }),
      this.report({
        dateRanges: range,
        dimensions: dims('date'),
        metrics: mets('activeUsers', 'sessions', 'screenPageViews'),
      }),
      top('sessionDefaultChannelGroup', 'sessions'),
      top('sessionSourceMedium', 'sessions'),
      top('country'),
      top('city'),
      top('deviceCategory'),
      top('browser'),
      top('operatingSystem'),
      top('language'),
      top('newVsReturning'),
      this.report({
        dateRanges: range,
        dimensions: dims('pagePath'),
        metrics: mets('screenPageViews', 'activeUsers'),
        orderBys: desc('screenPageViews'),
        limit: 15,
      }),
      this.report({
        dateRanges: range,
        dimensions: dims('landingPage'),
        metrics: mets('sessions', 'engagementRate'),
        orderBys: desc('sessions'),
        limit: 10,
      }),
      top('hour', 'activeUsers', 24),
      top('dayOfWeek', 'sessions', 7),
    ]);

    // Our own sign-ups (bloggers and companies) per Yerevan day, for this period and the last.
    const dayList = lastDays(yerevanDay(now), days);
    const since = new Date(`${dayList[0]}T00:00:00+04:00`);
    const prevSince = new Date(since.getTime() - days * DAY);
    const roles = { in: ['INFLUENCER' as const, 'BRAND' as const] };
    const [signupRows, signupsPrevious] = await Promise.all([
      this.prisma.$queryRaw<{ key: string; count: bigint }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') AS key,
               count(*) AS count
        FROM "User"
        WHERE "createdAt" >= ${since} AND "role" IN ('INFLUENCER', 'BRAND')
        GROUP BY 1`,
      this.prisma.user.count({
        where: { role: roles, createdAt: { gte: prevSince, lt: since } },
      }),
    ]);
    const signupsByDay = new Map(signupRows.map((r) => [r.key, Number(r.count)]));
    const signups = signupRows.reduce((a, r) => a + Number(r.count), 0);

    const t = periodTotals(totals, KPI_METRICS.length);
    const kpi = (i: number) => ({ value: t.current[i] ?? 0, previous: t.previous[i] ?? 0 });

    return {
      enabled: true as const,
      days,
      kpis: {
        visitors: kpi(0),
        newVisitors: kpi(1),
        sessions: kpi(2),
        pageViews: kpi(3),
        /** Seconds. */
        avgSession: kpi(4),
        /** 0–1. */
        engagementRate: kpi(5),
        bounceRate: kpi(6),
        signups: { value: signups, previous: signupsPrevious },
        /** Sign-ups per 100 new visitors. */
        conversion: {
          value: share(signups, t.current[1] ?? 0),
          previous: share(signupsPrevious, t.previous[1] ?? 0),
        },
      },
      daily: dailySeries(daily, dayList, 3).map(({ day, values }) => ({
        day,
        visitors: values[0] ?? 0,
        sessions: values[1] ?? 0,
        pageViews: values[2] ?? 0,
        signups: signupsByDay.get(day) ?? 0,
      })),
      channels: points(channels),
      sources: points(sources),
      countries: points(countries),
      cities: points(cities),
      devices: points(devices),
      browsers: points(browsers),
      os: points(os),
      languages: points(languages),
      newVsReturning: points(newVsReturning),
      pages: readRows(pages).map((r) => ({
        path: r.keys[0] ?? '',
        views: r.values[0] ?? 0,
        visitors: r.values[1] ?? 0,
      })),
      landing: readRows(landing)
        .filter((r) => r.keys[0] && r.keys[0] !== '(not set)')
        .map((r) => ({
          path: r.keys[0] ?? '',
          sessions: r.values[0] ?? 0,
          engagementRate: r.values[1] ?? 0,
        })),
      /** Visitors per hour of the day (property time zone), 0–23. */
      hours: byIndex(hours, 24),
      /** Sessions per weekday, 0 = Sunday. */
      weekdays: byIndex(weekdays, 7),
    };
  }

  /**
   * People on the site in the last 30 minutes. Realtime reports allow only some dimensions
   * (https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema):
   * page titles (unifiedScreenName), not paths.
   */
  private async loadLive() {
    const top = (dimension: string, limit = 8) =>
      this.realtime({
        dimensions: dims(dimension),
        metrics: mets('activeUsers'),
        orderBys: desc('activeUsers'),
        limit,
      });
    const [total, minutes, pages, countries, devices] = await Promise.all([
      this.realtime({ metrics: mets('activeUsers') }),
      this.realtime({ dimensions: dims('minutesAgo'), metrics: mets('activeUsers') }),
      top('unifiedScreenName'),
      top('country'),
      top('deviceCategory', 3),
    ]);
    return {
      enabled: true as const,
      active: readRows(total)[0]?.values[0] ?? 0,
      /** Visitors per minute, oldest first (29 minutes ago … now). */
      perMinute: byIndex(minutes, 30).reverse(),
      pages: points(pages),
      countries: points(countries),
      devices: points(devices),
    };
  }
}
