import { Injectable } from '@nestjs/common';
import { convertMinor, TIMEZONE } from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { RatesService } from '../currency/rates.service';

export const INSIGHT_PERIODS = [7, 30, 90] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

/** Minimum-budget buckets in AMD (major units); the last is open-ended. */
export const BUDGET_BUCKETS = [0, 20_000, 50_000, 100_000, 200_000] as const;

type Row = { key: string; count: bigint };

/**
 * What bloggers look for in the deal feed, aggregated over all searches (never per blogger).
 * Counts are "searches that used this filter value"; one search can count in several values.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly rates: RatesService,
  ) {}

  private async searches(days: InsightPeriod) {
    const now = this.clock.now();
    const since = new Date(now.getTime() - days * 86_400_000);
    const where = { createdAt: { gte: since } };

    const unnest = (
      column: 'platforms' | 'niches' | 'cities' | 'paymentTypes' | 'collaborationTypes',
    ) =>
      this.prisma.$queryRaw<Row[]>`
        SELECT x::text AS key, count(*) AS count
        FROM "FeedSearch", unnest(${Prisma.raw(`"${column}"`)}) AS x
        WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 2 DESC`;

    const [
      total,
      bloggers,
      filtered,
      platforms,
      niches,
      cities,
      payments,
      perDay,
      budgets,
      verified,
      collaboration,
    ] = await Promise.all([
      this.prisma.feedSearch.count({ where }),
      this.prisma.feedSearch.findMany({
        where,
        distinct: ['influencerId'],
        select: { influencerId: true },
      }),
      this.prisma.feedSearch.count({
        where: {
          ...where,
          OR: [
            { platforms: { isEmpty: false } },
            { niches: { isEmpty: false } },
            { cities: { isEmpty: false } },
            { paymentTypes: { isEmpty: false } },
            { collaborationTypes: { isEmpty: false } },
            { budgetMin: { not: null } },
          ],
        },
      }),
      unnest('platforms'),
      unnest('niches'),
      unnest('cities'),
      unnest('paymentTypes'),
      this.prisma.$queryRaw<Row[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') AS key, count(*) AS count
        FROM "FeedSearch" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<Row[]>`
        SELECT width_bucket("budgetMin" / 100.0, ARRAY[${Prisma.join(BUDGET_BUCKETS.map((b) => b))}]::numeric[])::text AS key, count(*) AS count
        FROM "FeedSearch" WHERE "createdAt" >= ${since} AND "budgetMin" IS NOT NULL
        GROUP BY 1`,
      this.prisma.influencerProfile.count({
        where: { status: 'APPROVED', user: { blockedAt: null } },
      }),
      unnest('collaborationTypes'),
    ]);

    const list = (rows: Row[]) => rows.map((r) => ({ key: r.key, count: Number(r.count) }));

    // Fill every day of the period (in Yerevan time) so the column chart has no gaps.
    const counts = new Map(list(perDay).map((r) => [r.key, r.count]));
    const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
    const series = Array.from({ length: days }, (_, i) => {
      const key = dayKey(new Date(now.getTime() - (days - 1 - i) * 86_400_000));
      return { date: key, count: counts.get(key) ?? 0 };
    });

    const budgetCounts = new Map(list(budgets).map((r) => [Number(r.key), r.count]));
    const budgetBuckets = BUDGET_BUCKETS.map((min, i) => ({
      min,
      max: BUDGET_BUCKETS[i + 1] ?? null,
      count: budgetCounts.get(i + 1) ?? 0, // width_bucket is 1-based for values >= the first bound
    }));

    return {
      days,
      totalSearches: total,
      bloggerIds: bloggers.map((b) => b.influencerId),
      filteredShare: total ? filtered / total : 0,
      verifiedBloggers: verified,
      platforms: list(platforms),
      niches: list(niches),
      cities: list(cities),
      paymentTypes: list(payments),
      collaborationTypes: list(collaboration),
      budgetBuckets,
      perDay: series,
    };
  }

  /**
   * What is inside the briefs bloggers open: each open (one blogger, one brief, one day) counts
   * once for every characteristic of that brief. Aggregated across the marketplace; no brief,
   * brand or blogger is identifiable.
   */
  private async opens(days: InsightPeriod) {
    const now = this.clock.now();
    const since = new Date(now.getTime() - days * 86_400_000);
    const where = { createdAt: { gte: since } };

    const [perDeal, bloggers, perDayRows, verified, { rates }] = await Promise.all([
      this.prisma.dealView.groupBy({ by: ['dealId'], where, _count: true }),
      this.prisma.dealView.findMany({
        where,
        distinct: ['influencerId'],
        select: { influencerId: true },
      }),
      this.prisma.dealView.groupBy({ by: ['day'], where, _count: true }),
      this.prisma.influencerProfile.count({
        where: { status: 'APPROVED', user: { blockedAt: null } },
      }),
      this.rates.get(),
    ]);
    const deals = await this.prisma.deal.findMany({
      where: { id: { in: perDeal.map((d) => d.dealId) } },
      select: {
        id: true,
        platforms: true,
        niches: true,
        cities: true,
        contentFormats: true,
        paymentType: true,
        collaborationType: true,
        budgetMin: true,
        budgetMax: true,
        currency: true,
      },
    });
    const opens = new Map(perDeal.map((d) => [d.dealId, d._count]));

    const tally = () => new Map<string, number>();
    const add = (m: Map<string, number>, key: string, n: number) =>
      m.set(key, (m.get(key) ?? 0) + n);
    const t = {
      platforms: tally(),
      niches: tally(),
      cities: tally(),
      formats: tally(),
      payment: tally(),
      collaboration: tally(),
    };
    const budget = new Array<number>(BUDGET_BUCKETS.length).fill(0);
    for (const d of deals) {
      const n = opens.get(d.id) ?? 0;
      d.platforms.forEach((x) => add(t.platforms, x, n));
      d.niches.forEach((x) => add(t.niches, x, n));
      d.cities.forEach((x) => add(t.cities, x, n));
      d.contentFormats.forEach((x) => add(t.formats, x, n));
      add(t.payment, d.paymentType, n);
      add(t.collaboration, d.collaborationType, n);
      // Top of the offered range, in AMD (major units); barter-only briefs have no budget.
      const top = d.budgetMax ?? d.budgetMin;
      if (top != null) {
        const amd = convertMinor(top, d.currency, 'AMD', rates) / 100;
        let i = BUDGET_BUCKETS.length - 1;
        while (i > 0 && amd < BUDGET_BUCKETS[i]!) i--;
        budget[i]! += n;
      }
    }
    const sorted = (m: Map<string, number>) =>
      [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

    const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
    const byDay = new Map(perDayRows.map((r) => [r.day, r._count]));
    const perDay = Array.from({ length: days }, (_, i) => {
      const key = dayKey(new Date(now.getTime() - (days - 1 - i) * 86_400_000));
      return { date: key, count: byDay.get(key) ?? 0 };
    });

    return {
      days,
      totalOpens: perDeal.reduce((sum, d) => sum + d._count, 0),
      bloggerIds: bloggers.map((b) => b.influencerId),
      briefsOpened: perDeal.length,
      verifiedBloggers: verified,
      platforms: sorted(t.platforms),
      niches: sorted(t.niches),
      cities: sorted(t.cities),
      contentFormats: sorted(t.formats),
      paymentTypes: sorted(t.payment),
      collaborationTypes: sorted(t.collaboration),
      budgetBuckets: BUDGET_BUCKETS.map((min, i) => ({
        min,
        max: BUDGET_BUCKETS[i + 1] ?? null,
        count: budget[i]!,
      })),
      perDay,
    };
  }

  /**
   * One summary of what bloggers want, from two signals: the filters they search with and the
   * briefs they open. Every value counts searches + opens; both parts are returned for the detail.
   */
  async forBrands(days: InsightPeriod) {
    const [s, o] = await Promise.all([this.searches(days), this.opens(days)]);
    type Part = { key: string; count: number }[];
    const merge = (a: Part, b: Part) => {
      const keys = new Set([...a.map((x) => x.key), ...b.map((x) => x.key)]);
      return [...keys]
        .map((key) => {
          const searches = a.find((x) => x.key === key)?.count ?? 0;
          const opens = b.find((x) => x.key === key)?.count ?? 0;
          return { key, count: searches + opens, searches, opens };
        })
        .sort((x, y) => y.count - x.count);
    };
    const activeBloggers = new Set([...s.bloggerIds, ...o.bloggerIds]).size;
    return {
      days,
      totalSignals: s.totalSearches + o.totalOpens,
      totalSearches: s.totalSearches,
      totalOpens: o.totalOpens,
      briefsOpened: o.briefsOpened,
      activeBloggers,
      verifiedBloggers: s.verifiedBloggers,
      filteredShare: s.filteredShare,
      platforms: merge(s.platforms, o.platforms),
      niches: merge(s.niches, o.niches),
      cities: merge(s.cities, o.cities).slice(0, 8),
      paymentTypes: merge(s.paymentTypes, o.paymentTypes),
      collaborationTypes: merge(s.collaborationTypes, o.collaborationTypes),
      // Searches cannot filter by format, so formats come from opened briefs only.
      contentFormats: merge([], o.contentFormats),
      budgetBuckets: s.budgetBuckets.map((b, i) => ({
        ...b,
        count: b.count + o.budgetBuckets[i]!.count,
        searches: b.count,
        opens: o.budgetBuckets[i]!.count,
      })),
      perDay: s.perDay.map((d, i) => ({
        date: d.date,
        count: d.count + (o.perDay[i]?.count ?? 0),
        searches: d.count,
        opens: o.perDay[i]?.count ?? 0,
      })),
    };
  }
}
