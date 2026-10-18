import { Injectable } from '@nestjs/common';
import {
  canBrandTransition,
  canWithdraw,
  isAccountUsable,
  checkEligibility,
  contactsRevealed,
  exceedsSlots,
  FILLED_STATUSES,
  isFilled,
  matchScore,
  type ApplicantsQuery,
  type ApplicationStatusUpdateInput,
  type ApplyInput,
  type NotificationType,
  type RejectionReason,
} from '@briefluence/shared';
import { Prisma, type Application, type Deal } from '@prisma/client';
import { AppError, forbidden, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { publicAccount } from '../influencers/serializers';
import { toMatchDeal, toMatchInfluencer } from '../deals/match-input';
import { brandRevealed, HIDDEN_BRAND } from '../deals/confidential';
import { DealsService } from '../deals/deals.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deals: DealsService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  // ─── Influencer ──────────────────────────────────────────

  async apply(
    userId: string,
    dealId: string,
    input: ApplyInput & { proposedPrice: number | null },
  ) {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { brand: { select: { userId: true } } },
    });
    if (!deal) throw notFound('Deal');

    const now = this.clock.now();
    const inf = toMatchInfluencer(profile);
    const failure = checkEligibility(toMatchDeal(deal), inf, now);
    if (failure)
      throw new AppError('NOT_ELIGIBLE', 'You are not eligible for this deal', { reason: failure });
    // The blogger does not pick an account: the best-matching one is used for the score, and the
    // brand sees all connected accounts. An explicit account id is still honoured if sent.
    if (input.socialAccountId) {
      const chosen = profile.socialAccounts.find((a) => a.id === input.socialAccountId);
      if (!chosen || !isAccountUsable(chosen))
        throw new AppError('VALIDATION_FAILED', 'Choose one of your connected accounts');
    }
    const match = matchScore(toMatchDeal(deal), inf, input.socialAccountId);
    if (!match)
      throw new AppError('NOT_ELIGIBLE', 'No connected account fits the deal requirements', {
        reason: 'PLATFORM_OR_FOLLOWERS',
      });
    const account = { id: match.accountId };

    const data = {
      socialAccountId: account.id,
      pitch: input.pitch,
      proposedPrice: deal.paymentType === 'BARTER' ? null : input.proposedPrice,
      matchScore: match.score,
    };
    const existing = await this.prisma.application.findUnique({
      where: { dealId_influencerId: { dealId, influencerId: profile.id } },
    });
    let application: Application;
    if (existing) {
      if (existing.status !== 'WITHDRAWN')
        throw new AppError('ALREADY_APPLIED', 'You already applied to this deal');
      application = await this.prisma.application.update({
        where: { id: existing.id },
        data: {
          ...data,
          status: 'APPLIED',
          rejectionReason: null,
          postUrl: null,
          shortlistedAt: null,
          acceptedAt: null,
        },
      });
    } else {
      try {
        application = await this.prisma.application.create({
          // Dated by the app clock: Basic's 30-day limit compares against it.
          data: { ...data, dealId, influencerId: profile.id, createdAt: this.clock.now() },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError('ALREADY_APPLIED', 'You already applied to this deal');
        }
        throw err;
      }
    }
    await this.notifications.notify(deal.brand.userId, 'NEW_APPLICANT', {
      params: { name: profile.displayName, deal: deal.title, score: match.score },
      link: `/brand/deals/${deal.id}/applicants`,
    });
    return application;
  }

  async listMine(userId: string) {
    const apps = await this.prisma.application.findMany({
      where: { influencer: { userId } },
      orderBy: { updatedAt: 'desc' },
      include: {
        deal: {
          include: {
            brand: {
              select: {
                id: true,
                companyName: true,
                logoUrl: true,
                website: true,
                instagramUrl: true,
                contactName: true,
                contactPosition: true,
                contactMethod: true,
                contactValue: true,
              },
            },
          },
        },
      },
    });
    return apps.map((a) => {
      const { contactName, contactPosition, contactMethod, contactValue, ...brand } = a.deal.brand;
      return {
        ...a,
        deal: {
          id: a.deal.id,
          title: a.deal.title,
          status: a.deal.status,
          platforms: a.deal.platforms,
          paymentType: a.deal.paymentType,
          budgetMin: a.deal.budgetMin,
          budgetMax: a.deal.budgetMax,
          currency: a.deal.currency,
          barterDescription: a.deal.barterDescription,
          applicationDeadline: a.deal.applicationDeadline,
          publishBy: a.deal.publishBy,
          collaborationType: a.deal.collaborationType,
          isConfidential: a.deal.isConfidential,
          // Confidential briefs reveal the brand only after acceptance.
          brand: a.deal.isConfidential && !brandRevealed(a.status) ? HIDDEN_BRAND : brand,
        },
        brandContact: contactsRevealed(a.status)
          ? {
              name: contactName,
              position: contactPosition,
              method: contactMethod,
              value: contactValue,
            }
          : null,
      };
    });
  }

  private async ownApplication(userId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        influencer: { select: { userId: true, displayName: true } },
        deal: { include: { brand: { select: { userId: true } } } },
      },
    });
    if (!app || app.influencer.userId !== userId) throw notFound('Application');
    return app;
  }

  async withdraw(userId: string, id: string) {
    const app = await this.ownApplication(userId, id);
    if (!canWithdraw(app.status))
      throw new AppError('INVALID_TRANSITION', 'You can only withdraw before the brand accepts');
    return this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }

  // ─── Brand ───────────────────────────────────────────────

  async listForDeal(userId: string, dealId: string, q: ApplicantsQuery) {
    const deal = await this.deals.ownedDeal(userId, dealId);

    // Opening the applicants list marks new applications as viewed.
    const fresh = await this.prisma.application.findMany({
      where: { dealId, status: 'APPLIED' },
      select: { id: true, influencer: { select: { userId: true } } },
    });
    if (fresh.length) {
      await this.prisma.application.updateMany({
        where: { id: { in: fresh.map((f) => f.id) } },
        data: { status: 'VIEWED' },
      });
      await Promise.all(
        fresh.map((f) =>
          this.notifications.notify(f.influencer.userId, 'APPLICATION_VIEWED', {
            params: { deal: deal.title },
            link: '/influencer/applications',
          }),
        ),
      );
    }

    const apps = await this.prisma.application.findMany({
      where: { dealId, ...(q.status ? { status: q.status } : { status: { not: 'WITHDRAWN' } }) },
      include: { influencer: { include: { socialAccounts: true } } },
    });
    const rows = apps.map((a) => {
      const p = a.influencer;
      return {
        id: a.id,
        status: a.status,
        pitch: a.pitch,
        proposedPrice: a.proposedPrice,
        matchScore: a.matchScore,
        rejectionReason: a.rejectionReason,
        postUrl: a.postUrl,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        influencer: {
          id: p.id,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          city: p.city,
          country: p.country,
          niches: p.niches,
          verified: p.status === 'APPROVED',
        },
        /** The account the match score was computed for. */
        matchedAccountId: a.socialAccountId,
        /** All connected accounts (largest first) so the brand can evaluate further collaboration. */
        accounts: p.socialAccounts
          .filter(isAccountUsable)
          .sort((x, y) => y.followers - x.followers)
          .map(publicAccount),
        contacts: contactsRevealed(a.status)
          ? { method: p.contactMethod, value: p.contactValue }
          : null,
      };
    });
    const sorters = {
      match: (a: (typeof rows)[number], b: (typeof rows)[number]) => b.matchScore - a.matchScore,
      followers: (a: (typeof rows)[number], b: (typeof rows)[number]) =>
        (b.accounts[0]?.followers ?? 0) - (a.accounts[0]?.followers ?? 0),
      newest: (a: (typeof rows)[number], b: (typeof rows)[number]) =>
        b.createdAt.getTime() - a.createdAt.getTime(),
    };
    rows.sort(sorters[q.sort]);
    const filled = await this.prisma.application.count({
      where: { dealId, status: { in: FILLED_STATUSES } },
    });
    const start = (q.page - 1) * q.pageSize;
    return {
      deal: {
        id: deal.id,
        title: deal.title,
        status: deal.status,
        slots: deal.slots,
        filled,
        currency: deal.currency,
        viewCount: deal.viewCount,
        isConfidential: deal.isConfidential,
        reviewNote: deal.reviewNote,
      },
      items: rows.slice(start, start + q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async updateStatus(userId: string, id: string, input: ApplicationStatusUpdateInput) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        deal: { include: { brand: { select: { userId: true } } } },
        influencer: { select: { userId: true } },
      },
    });
    if (!app) throw notFound('Application');
    if (app.deal.brand.userId !== userId) throw forbidden();
    const to = input.status;
    if (!canBrandTransition(app.status, to)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Cannot change ${app.status.toLowerCase()} to ${to.toLowerCase()}`,
      );
    }

    let dealFilled = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (to === 'ACCEPTED') {
        // Lock the deal row so two parallel accepts cannot both pass the slot check.
        await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${app.dealId} FOR UPDATE`;
        const filled = await tx.application.count({
          where: { dealId: app.dealId, status: { in: FILLED_STATUSES } },
        });
        if (exceedsSlots(app.deal.slots, filled) && !input.confirmOverSlots) {
          throw new AppError(
            'SLOTS_EXCEEDED',
            `All ${app.deal.slots} slots are already filled. Confirm to accept anyway.`,
            {
              slots: app.deal.slots,
              filled,
            },
          );
        }
        dealFilled = isFilled(app.deal.slots, filled + 1) && app.deal.status === 'ACTIVE';
        if (dealFilled)
          await tx.deal.update({ where: { id: app.dealId }, data: { status: 'CLOSED' } });
      }
      return tx.application.update({
        where: { id },
        data: {
          status: to,
          rejectionReason: to === 'REJECTED' ? input.rejectionReason : app.rejectionReason,
          // Funnel dates survive later status changes (first time only).
          ...(to === 'SHORTLISTED' && !app.shortlistedAt
            ? { shortlistedAt: this.clock.now() }
            : {}),
          ...(to === 'ACCEPTED' && !app.acceptedAt ? { acceptedAt: this.clock.now() } : {}),
        },
      });
    });

    await this.notifyStatus(app.influencer.userId, app.deal, to, input.rejectionReason);
    if (dealFilled) {
      await this.notifications.notify(userId, 'DEAL_FILLED', {
        params: { deal: app.deal.title, slots: app.deal.slots },
        link: `/brand/deals/${app.dealId}/applicants`,
      });
    }
    return updated;
  }

  private async notifyStatus(
    influencerUserId: string,
    deal: Deal,
    status: string,
    reason?: RejectionReason,
  ) {
    const types: Partial<Record<string, NotificationType>> = {
      SHORTLISTED: 'APPLICATION_SHORTLISTED',
      ACCEPTED: 'APPLICATION_ACCEPTED',
      REJECTED: 'APPLICATION_REJECTED',
      COMPLETED: 'APPLICATION_COMPLETED',
    };
    const type = types[status];
    if (type) {
      await this.notifications.notify(influencerUserId, type, {
        params: { deal: deal.title, reason: reason ?? null },
        link: '/influencer/applications',
      });
    }
  }
}
