import { Injectable } from '@nestjs/common';
import {
  canBrandTransition,
  canComplete,
  canSubmitPostUrl,
  canWithdraw,
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
import { DealsService } from '../deals/deals.service';
import { NotificationsService } from '../notifications/notifications.service';

const REJECTION_TEXT: Record<RejectionReason, string> = {
  BUDGET: 'the budget did not fit',
  AUDIENCE: 'the audience was not the right fit',
  NICHE: 'the niche was not the right fit',
  OTHER: 'the brand chose other creators',
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deals: DealsService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  // ─── Influencer ──────────────────────────────────────────

  async apply(userId: string, dealId: string, input: ApplyInput & { proposedPrice: number | null }) {
    const profile = await this.prisma.influencerProfile.findUnique({ where: { userId }, include: { socialAccounts: true } });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId }, include: { brand: { select: { userId: true } } } });
    if (!deal) throw notFound('Deal');

    const now = this.clock.now();
    const inf = toMatchInfluencer(profile);
    const failure = checkEligibility(toMatchDeal(deal), inf, now);
    if (failure) throw new AppError('NOT_ELIGIBLE', 'You are not eligible for this deal', { reason: failure });
    const account = profile.socialAccounts.find((a) => a.id === input.socialAccountId);
    if (!account || account.tokenRevokedAt) throw new AppError('VALIDATION_FAILED', 'Choose one of your connected accounts');
    const match = matchScore(toMatchDeal(deal), inf, account.id);
    if (!match) throw new AppError('NOT_ELIGIBLE', 'This account does not fit the deal requirements', { reason: 'PLATFORM_OR_FOLLOWERS' });

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
      if (existing.status !== 'WITHDRAWN') throw new AppError('ALREADY_APPLIED', 'You already applied to this deal');
      application = await this.prisma.application.update({
        where: { id: existing.id },
        data: { ...data, status: 'APPLIED', rejectionReason: null, postUrl: null },
      });
    } else {
      try {
        application = await this.prisma.application.create({ data: { ...data, dealId, influencerId: profile.id } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError('ALREADY_APPLIED', 'You already applied to this deal');
        }
        throw err;
      }
    }
    await this.notifications.notify(deal.brand.userId, 'NEW_APPLICANT', {
      title: 'New applicant',
      body: `${profile.displayName} applied to "${deal.title}" (match ${match.score}%).`,
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
          brand,
        },
        brandContact: contactsRevealed(a.status)
          ? { name: contactName, position: contactPosition, method: contactMethod, value: contactValue }
          : null,
      };
    });
  }

  private async ownApplication(userId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true, displayName: true } }, deal: { include: { brand: { select: { userId: true } } } } },
    });
    if (!app || app.influencer.userId !== userId) throw notFound('Application');
    return app;
  }

  async withdraw(userId: string, id: string) {
    const app = await this.ownApplication(userId, id);
    if (!canWithdraw(app.status)) throw new AppError('INVALID_TRANSITION', 'You can only withdraw before the brand accepts');
    return this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }

  async submitPostUrl(userId: string, id: string, postUrl: string) {
    const app = await this.ownApplication(userId, id);
    if (!canSubmitPostUrl(app.status)) throw new AppError('INVALID_TRANSITION', 'Only accepted applications can get a post URL');
    const updated = await this.prisma.application.update({ where: { id }, data: { postUrl } });
    await this.notifications.notify(app.deal.brand.userId, 'POST_SUBMITTED', {
      title: 'Content published',
      body: `${app.influencer.displayName} published the content for "${app.deal.title}". Review it and mark the deal completed.`,
      link: `/brand/deals/${app.dealId}/applicants`,
    });
    return updated;
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
      await this.prisma.application.updateMany({ where: { id: { in: fresh.map((f) => f.id) } }, data: { status: 'VIEWED' } });
      await Promise.all(
        fresh.map((f) =>
          this.notifications.notify(f.influencer.userId, 'APPLICATION_VIEWED', {
            title: 'Your application was viewed',
            body: `The brand viewed your application to "${deal.title}".`,
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
      const account = a.influencer.socialAccounts.find((s) => s.id === a.socialAccountId);
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
        account: account ? publicAccount(account) : null,
        contacts: contactsRevealed(a.status)
          ? { email: p.contactEmail, phone: p.contactPhone, telegram: p.telegram }
          : null,
      };
    });
    const sorters = {
      match: (a: (typeof rows)[number], b: (typeof rows)[number]) => b.matchScore - a.matchScore,
      followers: (a: (typeof rows)[number], b: (typeof rows)[number]) => (b.account?.followers ?? 0) - (a.account?.followers ?? 0),
      newest: (a: (typeof rows)[number], b: (typeof rows)[number]) => b.createdAt.getTime() - a.createdAt.getTime(),
    };
    rows.sort(sorters[q.sort]);
    const filled = await this.prisma.application.count({ where: { dealId, status: { in: FILLED_STATUSES } } });
    const start = (q.page - 1) * q.pageSize;
    return {
      deal: { id: deal.id, title: deal.title, status: deal.status, slots: deal.slots, filled, currency: deal.currency },
      items: rows.slice(start, start + q.pageSize),
      total: rows.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async updateStatus(userId: string, id: string, input: ApplicationStatusUpdateInput) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { deal: { include: { brand: { select: { userId: true } } } }, influencer: { select: { userId: true } } },
    });
    if (!app) throw notFound('Application');
    if (app.deal.brand.userId !== userId) throw forbidden();
    const to = input.status;
    if (!canBrandTransition(app.status, to)) {
      throw new AppError('INVALID_TRANSITION', `Cannot change ${app.status.toLowerCase()} to ${to.toLowerCase()}`);
    }
    if (to === 'COMPLETED' && !canComplete(app.status, app.postUrl)) {
      throw new AppError('INVALID_TRANSITION', 'The influencer has not submitted the post URL yet');
    }

    let dealFilled = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (to === 'ACCEPTED') {
        // Lock the deal row so two parallel accepts cannot both pass the slot check.
        await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${app.dealId} FOR UPDATE`;
        const filled = await tx.application.count({ where: { dealId: app.dealId, status: { in: FILLED_STATUSES } } });
        if (exceedsSlots(app.deal.slots, filled) && !input.confirmOverSlots) {
          throw new AppError('SLOTS_EXCEEDED', `All ${app.deal.slots} slots are already filled. Confirm to accept anyway.`, {
            slots: app.deal.slots,
            filled,
          });
        }
        dealFilled = isFilled(app.deal.slots, filled + 1) && app.deal.status === 'ACTIVE';
        if (dealFilled) await tx.deal.update({ where: { id: app.dealId }, data: { status: 'CLOSED' } });
      }
      return tx.application.update({
        where: { id },
        data: { status: to, rejectionReason: to === 'REJECTED' ? input.rejectionReason : app.rejectionReason },
      });
    });

    await this.notifyStatus(app.influencer.userId, app.deal, to, input.rejectionReason);
    if (dealFilled) {
      await this.notifications.notify(userId, 'DEAL_FILLED', {
        title: 'Deal filled',
        body: `"${app.deal.title}" reached its ${app.deal.slots} slot(s) and was closed automatically.`,
        link: `/brand/deals/${app.dealId}/applicants`,
      });
    }
    return updated;
  }

  private async notifyStatus(influencerUserId: string, deal: Deal, status: string, reason?: RejectionReason) {
    const messages: Partial<Record<string, { type: NotificationType; title: string; body: string }>> = {
      SHORTLISTED: {
        type: 'APPLICATION_SHORTLISTED',
        title: 'You were shortlisted',
        body: `You were shortlisted for "${deal.title}".`,
      },
      ACCEPTED: {
        type: 'APPLICATION_ACCEPTED',
        title: 'Application accepted',
        body: `Your application to "${deal.title}" was accepted. The brand's contacts are now visible in your applications.`,
      },
      REJECTED: {
        type: 'APPLICATION_REJECTED',
        title: 'Application not selected',
        body: `Your application to "${deal.title}" was not selected: ${REJECTION_TEXT[reason ?? 'OTHER']}.`,
      },
      COMPLETED: {
        type: 'APPLICATION_COMPLETED',
        title: 'Collaboration completed',
        body: `The brand confirmed your work on "${deal.title}". Great job!`,
      },
    };
    const m = messages[status];
    if (m) await this.notifications.notify(influencerUserId, m.type, { title: m.title, body: m.body, link: '/influencer/applications' });
  }
}
