import { Injectable } from '@nestjs/common';
import { TIMEZONE } from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';

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
  ) {}

  async forBrands(days: InsightPeriod) {
    const now = this.clock.now();
    const since = new Date(now.getTime() - days * 86_400_000);
    const where = { createdAt: { gte: since } };

    const unnest = (column: 'platforms' | 'niches' | 'cities' | 'paymentTypes') =>
      this.prisma.$queryRaw<Row[]>`
        SELECT x::text AS key, count(*) AS count
        FROM "FeedSearch", unnest(${Prisma.raw(`"${column}"`)}) AS x
        WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 2 DESC`;

    const [total, bloggers, filtered, platforms, niches, cities, payments, perDay, budgets, verified] = await Promise.all([
      this.prisma.feedSearch.count({ where }),
      this.prisma.feedSearch.findMany({ where, distinct: ['influencerId'], select: { influencerId: true } }),
      this.prisma.feedSearch.count({
        where: {
          ...where,
          OR: [
            { platforms: { isEmpty: false } },
            { niches: { isEmpty: false } },
            { cities: { isEmpty: false } },
            { paymentTypes: { isEmpty: false } },
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
      this.prisma.influencerProfile.count({ where: { status: 'APPROVED', user: { blockedAt: null } } }),
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
      searchingBloggers: bloggers.length,
      filteredShare: total ? filtered / total : 0,
      verifiedBloggers: verified,
      platforms: list(platforms),
      niches: list(niches),
      cities: list(cities).slice(0, 8),
      paymentTypes: list(payments),
      budgetBuckets,
      perDay: series,
    };
  }
}
