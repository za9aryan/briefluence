import { Injectable } from '@nestjs/common';
import { planTier, TIMEZONE, type PlanTier } from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';

export const ANALYTICS_PERIODS = [30, 90, 365] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
type Unit = 'day' | 'week' | 'month';
type Row = { key: string; count: bigint };

/** Bucket size per period so every chart has a readable number of columns. */
const UNIT: Record<AnalyticsPeriod, Unit> = { 30: 'day', 90: 'week', 365: 'month' };

const DAY = 86_400_000;
const yerevanDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);

/** Start of the bucket a Yerevan calendar day (YYYY-MM-DD) falls in. */
function bucketOf(day: string, unit: Unit): string {
  if (unit === 'day') return day;
  if (unit === 'month') return `${day.slice(0, 8)}01`;
  const d = new Date(`${day}T00:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
  return monday.toISOString().slice(0, 10);
}

/**
 * Admin overview: activity in a period (sign-ups, briefs, applications and the funnel) plus the
 * current state of bloggers (plan, verification) and briefs. Read-only aggregates.
 */
@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /** Counts per Yerevan day for one timestamp column. Table/column names are constants, never input. */
  private perDay(table: string, column: string, since: Date, extra: Prisma.Sql = Prisma.empty) {
    return this.prisma.$queryRaw<Row[]>`
      SELECT to_char((${Prisma.raw(`"${column}"`)} AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') AS key, count(*) AS count
      FROM ${Prisma.raw(`"${table}"`)}
      WHERE ${Prisma.raw(`"${column}"`)} >= ${since} ${extra}
      GROUP BY 1`;
  }

  async overview(days: AnalyticsPeriod) {
    const now = this.clock.now();
    const since = new Date(now.getTime() - days * DAY);
    const unit = UNIT[days];
    const inPeriod = { gte: since };

    const [
      bloggersTotal,
      brandsTotal,
      bloggersNew,
      brandsNew,
      briefsTotal,
      briefsNew,
      appsTotal,
      appsNew,
      shortlistedTotal,
      shortlistedNew,
      acceptedTotal,
      acceptedNew,
      cohort,
      dealStatuses,
      verification,
      subscriptions,
      bloggersWithoutPlan,
      platforms,
      formats,
      appsDaily,
      briefsDaily,
      bloggersDaily,
      brandsDaily,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'INFLUENCER' } }),
      this.prisma.user.count({ where: { role: 'BRAND' } }),
      this.prisma.user.count({ where: { role: 'INFLUENCER', createdAt: inPeriod } }),
      this.prisma.user.count({ where: { role: 'BRAND', createdAt: inPeriod } }),
      this.prisma.deal.count({ where: { publishedAt: { not: null } } }),
      this.prisma.deal.count({ where: { publishedAt: inPeriod } }),
      this.prisma.application.count(),
      this.prisma.application.count({ where: { createdAt: inPeriod } }),
      this.prisma.application.count({ where: { shortlistedAt: { not: null } } }),
      this.prisma.application.count({ where: { shortlistedAt: inPeriod } }),
      this.prisma.application.count({ where: { acceptedAt: { not: null } } }),
      this.prisma.application.count({ where: { acceptedAt: inPeriod } }),
      // Funnel of the applications sent in the period (what happened to them so far).
      this.prisma.application.findMany({
        where: { createdAt: inPeriod },
        select: { status: true, shortlistedAt: true, acceptedAt: true },
      }),
      this.prisma.deal.groupBy({ by: ['status'], _count: true }),
      this.prisma.influencerProfile.groupBy({ by: ['status'], _count: true }),
      this.prisma.subscription.findMany({
        where: { user: { role: 'INFLUENCER' } },
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          bindingId: true,
          failedAttempts: true,
          pastDueSince: true,
        },
      }),
      this.prisma.user.count({ where: { role: 'INFLUENCER', subscription: null } }),
      this.prisma.$queryRaw<Row[]>`
        SELECT x::text AS key, count(*) AS count FROM "Deal", unnest("platforms") AS x
        WHERE "publishedAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<Row[]>`
        SELECT x::text AS key, count(*) AS count FROM "Deal", unnest("contentFormats") AS x
        WHERE "publishedAt" >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
      this.perDay('Application', 'createdAt', since),
      this.perDay('Deal', 'publishedAt', since),
      this.perDay('User', 'createdAt', since, Prisma.sql`AND "role" = 'INFLUENCER'`),
      this.perDay('User', 'createdAt', since, Prisma.sql`AND "role" = 'BRAND'`),
    ]);

    const list = (rows: Row[]) => rows.map((r) => ({ key: r.key, count: Number(r.count) }));

    // Every bucket of the period, oldest first, so charts have no gaps.
    const buckets: string[] = [];
    for (let t = since.getTime() + DAY; t <= now.getTime(); t += DAY) {
      const b = bucketOf(yerevanDay(new Date(t)), unit);
      if (buckets[buckets.length - 1] !== b) buckets.push(b);
    }
    const series = (rows: Row[]) => {
      const counts = new Map<string, number>();
      for (const r of rows)
        counts.set(
          bucketOf(r.key, unit),
          (counts.get(bucketOf(r.key, unit)) ?? 0) + Number(r.count),
        );
      return buckets.map((key) => ({ key, count: counts.get(key) ?? 0 }));
    };

    const tiers: Record<PlanTier, number> = { FREE: 0, PAID: 0, NONE: bloggersWithoutPlan };
    for (const s of subscriptions) tiers[planTier(s, now)]++;

    const verified = verification.find((v) => v.status === 'APPROVED')?._count ?? 0;
    const inReview = verification.find((v) => v.status === 'PENDING_REVIEW')?._count ?? 0;
    const profiles = verification.reduce((sum, v) => sum + v._count, 0);

    return {
      days,
      unit,
      kpis: {
        bloggers: { period: bloggersNew, total: bloggersTotal },
        brands: { period: brandsNew, total: brandsTotal },
        briefs: { period: briefsNew, total: briefsTotal },
        applications: { period: appsNew, total: appsTotal },
        shortlisted: { period: shortlistedNew, total: shortlistedTotal },
        accepted: { period: acceptedNew, total: acceptedTotal },
      },
      plans: tiers,
      verification: {
        APPROVED: verified,
        PENDING_REVIEW: inReview,
        // Bloggers who signed up but have not finished (no profile yet, draft or rejected).
        NOT_VERIFIED: bloggersTotal - verified - inReview,
        profiles,
      },
      funnel: {
        sent: cohort.length,
        shortlisted: cohort.filter((a) => a.shortlistedAt).length,
        accepted: cohort.filter((a) => a.acceptedAt).length,
        completed: cohort.filter((a) => a.status === 'COMPLETED').length,
      },
      outcomes: {
        WAITING: cohort.filter((a) => ['APPLIED', 'VIEWED', 'SHORTLISTED'].includes(a.status))
          .length,
        ACCEPTED: cohort.filter((a) => a.status === 'ACCEPTED' || a.status === 'COMPLETED').length,
        NOT_SELECTED: cohort.filter((a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN')
          .length,
      },
      dealStatuses: dealStatuses.map((d) => ({ key: d.status, count: d._count })),
      platforms: list(platforms),
      formats: list(formats),
      series: {
        applications: series(appsDaily),
        briefs: series(briefsDaily),
        bloggers: series(bloggersDaily),
        brands: series(brandsDaily),
      },
    };
  }
}
