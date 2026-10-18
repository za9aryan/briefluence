import { Injectable } from '@nestjs/common';
import {
  canDealTransition,
  convertMinor,
  CURRENCIES,
  TIMEZONE,
  checkEligibility,
  FILLED_STATUSES,
  isDealEditable,
  isDealHiddenFromBloggers,
  publishTarget,
  matchScore,
  type DealData,
  type DealStatus,
  type FeedQuery,
  type ReachPreviewInput,
  reachPreviewSchema,
} from '@briefluence/shared';
import type { Deal, Prisma } from '@prisma/client';
import { AppError, forbidden, notFound } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { BrandsService } from '../brands/brands.service';
import { RatesService } from '../currency/rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { forBlogger } from './confidential';
import { dealHardFilterWhere, toMatchDeal, toMatchInfluencer } from './match-input';

const brandCard = {
  select: { id: true, companyName: true, logoUrl: true, website: true, instagramUrl: true },
} as const;
const ACTIVE_APPLICATION = { status: { not: 'WITHDRAWN' as const } };

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandsService,
    private readonly clock: Clock,
    private readonly rates: RatesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Brand side ──────────────────────────────────────────

  async create(userId: string, data: DealData) {
    const brand = await this.brands.requireMine(userId);
    return this.prisma.deal.create({ data: { ...data, brandId: brand.id, status: 'DRAFT' } });
  }

  async ownedDeal(userId: string, dealId: string): Promise<Deal> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { brand: { select: { userId: true } } },
    });
    if (!deal) throw notFound('Deal');
    if (deal.brand.userId !== userId) throw forbidden();
    const { brand: _brand, ...rest } = deal;
    return rest;
  }

  async update(userId: string, dealId: string, data: DealData) {
    const deal = await this.ownedDeal(userId, dealId);
    if (!isDealEditable(deal.status)) {
      throw new AppError('DEAL_NOT_EDITABLE', 'Pause the deal before editing it');
    }
    return this.prisma.deal.update({ where: { id: deal.id }, data });
  }

  /**
   * "Publish" sends the brief for admin review, unless its key content was already approved
   * (resuming a paused brief that was not changed in ways that matter).
   */
  async publish(userId: string, dealId: string) {
    const deal = await this.ownedDeal(userId, dealId);
    const to = publishTarget(deal);
    if (to === 'ACTIVE') return this.transition(userId, dealId, 'ACTIVE');
    const updated = await this.transition(userId, dealId, 'IN_REVIEW');
    const brand = await this.prisma.brandProfile.findUniqueOrThrow({
      where: { id: deal.brandId },
      select: { companyName: true },
    });
    await this.notifications.notifyAdmins('DEAL_REVIEW_PENDING', {
      params: { brand: brand.companyName, deal: deal.title },
      link: '/admin/brief-review',
    });
    return updated;
  }

  async transition(userId: string, dealId: string, to: DealStatus) {
    const deal = await this.ownedDeal(userId, dealId);
    if (!canDealTransition(deal.status, to)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot change a ${deal.status.toLowerCase()} deal to ${to.toLowerCase()}`,
      );
    }
    const now = this.clock.now();
    if ((to === 'ACTIVE' || to === 'IN_REVIEW') && deal.applicationDeadline <= now) {
      throw new AppError('VALIDATION_FAILED', 'Application deadline must be in the future');
    }
    return this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: to,
        ...(to === 'ACTIVE' && !deal.publishedAt ? { publishedAt: now } : {}),
        ...(to === 'IN_REVIEW' ? { submittedAt: now } : {}),
      },
    });
  }

  async listMine(userId: string, status?: DealStatus) {
    const brand = await this.brands.requireMine(userId);
    const deals = await this.prisma.deal.findMany({
      where: { brandId: brand.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { applications: { select: { status: true } } },
    });
    return deals.map(({ applications, ...d }) => ({
      ...d,
      applicantCount: applications.filter((a) => a.status !== 'WITHDRAWN').length,
      newApplicantCount: applications.filter((a) => a.status === 'APPLIED').length,
      filled: applications.filter((a) => FILLED_STATUSES.includes(a.status)).length,
    }));
  }

  /** Number of approved influencers passing the hard filters (niche/language/ER are soft factors). */
  async previewReach(input: ReachPreviewInput): Promise<{ count: number }> {
    const t = reachPreviewSchema.parse(input);
    const year = this.clock.now().getUTCFullYear();
    const where: Prisma.InfluencerProfileWhereInput = {
      status: 'APPROVED',
      user: { blockedAt: null },
      ...(t.countries.length ? { country: { in: t.countries } } : {}),
      ...(t.cities.length ? { city: { in: t.cities } } : {}),
      ...(t.influencerGender !== 'ANY' ? { gender: t.influencerGender } : {}),
      ...(t.influencerAgeMin != null || t.influencerAgeMax != null
        ? {
            birthYear: {
              ...(t.influencerAgeMax != null ? { gte: year - t.influencerAgeMax } : {}),
              ...(t.influencerAgeMin != null ? { lte: year - t.influencerAgeMin } : {}),
            },
          }
        : {}),
      socialAccounts: {
        some: {
          tokenRevokedAt: null,
          platform: { in: t.platforms },
          followers: {
            ...(t.minFollowers != null ? { gte: t.minFollowers } : {}),
            ...(t.maxFollowers != null ? { lte: t.maxFollowers } : {}),
          },
        },
      },
    };
    return { count: await this.prisma.influencerProfile.count({ where }) };
  }

  // ─── Influencer side ─────────────────────────────────────

  private async influencerFor(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: true },
    });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    return p;
  }

  async feed(userId: string, q: FeedQuery) {
    const profile = await this.influencerFor(userId);
    const inf = toMatchInfluencer(profile);
    const now = this.clock.now();
    if (inf.accounts.length === 0)
      return { items: [], total: 0, page: q.page, pageSize: q.pageSize };

    const userFilters: Prisma.DealWhereInput[] = [];
    if (q.platform?.length) userFilters.push({ platforms: { hasSome: q.platform } });
    if (q.niche?.length) userFilters.push({ niches: { hasSome: q.niche } });
    if (q.city?.length) userFilters.push({ cities: { hasSome: q.city } });
    if (q.paymentType?.length) userFilters.push({ paymentType: { in: q.paymentType } });
    if (q.collaboration?.length) userFilters.push({ collaborationType: { in: q.collaboration } });
    if (q.budgetMin != null) {
      // The filter is in the blogger's currency; compare against each deal in the deal's own currency.
      const { rates } = await this.rates.get();
      userFilters.push({
        OR: CURRENCIES.map((currency) => {
          const min = convertMinor(q.budgetMin!, q.budgetCurrency, currency, rates);
          return {
            currency,
            OR: [{ budgetMax: { gte: min } }, { budgetMax: null, budgetMin: { gte: min } }],
          };
        }),
      });
    }
    if (q.deadlineBefore) userFilters.push({ applicationDeadline: { lte: q.deadlineBefore } });

    if (q.page === 1) void this.recordSearch(profile.id, q, now);

    const hard = dealHardFilterWhere(inf, now);
    const deals = await this.prisma.deal.findMany({
      where: { ...hard, AND: [...(hard.AND as Prisma.DealWhereInput[]), ...userFilters] },
      include: {
        brand: brandCard,
        _count: { select: { applications: { where: ACTIVE_APPLICATION } } },
        applications: { where: { influencerId: profile.id }, select: { id: true, status: true } },
      },
      take: 1000,
    });

    const scored = deals
      .filter((d) => checkEligibility(toMatchDeal(d), inf, now) === null)
      .map((d) => {
        const { applications, _count, brand: rawBrand, ...rawDeal } = d;
        const { deal, brand } = forBlogger(rawDeal, rawBrand, applications[0]?.status);
        return {
          ...deal,
          brand,
          matchScore: matchScore(toMatchDeal(d), inf)?.score ?? 0,
          applicantCount: _count.applications,
          myApplication: applications[0] ?? null,
        };
      });
    const sorters = {
      match: (a: (typeof scored)[number], b: (typeof scored)[number]) =>
        b.matchScore - a.matchScore ||
        a.applicationDeadline.getTime() - b.applicationDeadline.getTime(),
      deadline: (a: (typeof scored)[number], b: (typeof scored)[number]) =>
        a.applicationDeadline.getTime() - b.applicationDeadline.getTime(),
      newest: (a: (typeof scored)[number], b: (typeof scored)[number]) =>
        (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime(),
    };
    scored.sort(sorters[q.sort]);
    const start = (q.page - 1) * q.pageSize;
    return {
      items: scored.slice(start, start + q.pageSize),
      total: scored.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /**
   * Logs the filters of a feed search for brand insights. Identical repeats within 10 minutes
   * (refreshes, sorting) are skipped. Fire-and-forget: a logging failure never breaks the feed.
   */
  private async recordSearch(influencerId: string, q: FeedQuery, now: Date) {
    const data = {
      influencerId,
      platforms: q.platform ?? [],
      niches: q.niche ?? [],
      cities: q.city ?? [],
      paymentTypes: q.paymentType ?? [],
      collaborationTypes: q.collaboration ?? [],
      budgetMin: null as number | null,
    };
    try {
      // Stored in AMD so insights compare searches made in different currencies.
      if (q.budgetMin != null)
        data.budgetMin = convertMinor(
          q.budgetMin,
          q.budgetCurrency,
          'AMD',
          (await this.rates.get()).rates,
        );
      const recent = await this.prisma.feedSearch.findFirst({
        where: { influencerId, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } },
        orderBy: { createdAt: 'desc' },
      });
      const same = (a: unknown[], b: unknown[]) =>
        a.length === b.length && a.every((x) => b.includes(x));
      if (
        recent &&
        same(recent.platforms, data.platforms) &&
        same(recent.niches, data.niches) &&
        same(recent.cities, data.cities) &&
        same(recent.paymentTypes, data.paymentTypes) &&
        same(recent.collaborationTypes, data.collaborationTypes) &&
        recent.budgetMin === data.budgetMin
      ) {
        return;
      }
      await this.prisma.feedSearch.create({ data: { ...data, createdAt: now } });
    } catch {
      // Analytics only.
    }
  }

  /** Counts one view per blogger per day (Yerevan time); brands and admins are not counted. */
  private async recordView(dealId: string, influencerId: string) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(this.clock.now());
    const { count } = await this.prisma.dealView.createMany({
      data: [{ dealId, influencerId, day }],
      skipDuplicates: true,
    });
    if (count > 0)
      await this.prisma.deal.update({
        where: { id: dealId },
        data: { viewCount: { increment: 1 } },
      });
  }

  /** Deal detail for any role: owner and admin see everything; influencers see published, eligible deals. */
  async getForViewer(viewer: AuthUser, dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        brand: {
          select: {
            ...brandCard.select,
            userId: true,
            description: true,
            country: true,
            city: true,
          },
        },
        _count: { select: { applications: { where: ACTIVE_APPLICATION } } },
      },
    });
    if (!deal) throw notFound('Deal');
    const { brand, _count, ...rest } = deal;
    const { userId: brandUserId, ...brandPublic } = brand;
    const filled = await this.prisma.application.count({
      where: { dealId, status: { in: FILLED_STATUSES } },
    });
    const base = { ...rest, brand: brandPublic, applicantCount: _count.applications, filled };

    if (viewer.role === 'ADMIN') return base;
    if (viewer.role === 'BRAND') {
      if (brandUserId !== viewer.id) throw notFound('Deal');
      return base;
    }

    const profile = await this.influencerFor(viewer.id);
    const myApplication = await this.prisma.application.findUnique({
      where: { dealId_influencerId: { dealId, influencerId: profile.id } },
    });
    // Influencers can always see deals they applied to; otherwise only published, eligible ones,
    // and only once they have started the free month.
    if (!myApplication) {
      const sub = await this.prisma.subscription.findUnique({
        where: { userId: viewer.id },
        select: { id: true },
      });
      if (!sub) throw new AppError('TRIAL_NOT_STARTED', 'Start your free month to see briefs');
      if (isDealHiddenFromBloggers(deal.status)) throw notFound('Deal');
      const failure = checkEligibility(
        toMatchDeal(deal),
        toMatchInfluencer(profile),
        this.clock.now(),
      );
      if (failure && failure !== 'DEADLINE_PASSED' && failure !== 'NOT_ACTIVE')
        throw notFound('Deal');
    }
    const inf = toMatchInfluencer(profile);
    const accounts = profile.socialAccounts
      .filter((a) => !a.tokenRevokedAt)
      .map((a) => ({
        id: a.id,
        platform: a.platform,
        username: a.username,
        followers: a.followers,
        score: matchScore(toMatchDeal(deal), inf, a.id)?.score ?? null,
      }));
    if (!isDealHiddenFromBloggers(deal.status)) await this.recordView(deal.id, profile.id);
    const masked = forBlogger(base, base.brand, myApplication?.status);
    return {
      ...masked.deal,
      brand: masked.brand,
      matchScore: matchScore(toMatchDeal(deal), inf)?.score ?? 0,
      eligibleAccounts: accounts.filter((a) => a.score != null),
      myApplication,
    };
  }
}
