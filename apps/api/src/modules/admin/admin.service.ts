import { Injectable } from '@nestjs/common';
import {
  dealReviewKey,
  type AccountReviewStatus,
  type DealStatus,
  type Role,
  type VerificationStatus,
} from '@briefluence/shared';
import type { Prisma } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from '../auth/auth.service';
import { publicAccount } from '../influencers/serializers';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountLinksService } from '../social/account-links.service';

export const USER_STATES = ['unverified', 'blocked'] as const;
export type UserState = (typeof USER_STATES)[number];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
    private readonly clock: Clock,
    private readonly links: AccountLinksService,
  ) {}

  async verifications(status: VerificationStatus = 'PENDING_REVIEW') {
    const rows = await this.prisma.influencerProfile.findMany({
      where: { status },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        socialAccounts: true,
        user: { select: { email: true, emailVerifiedAt: true, createdAt: true } },
      },
      take: 200,
    });
    const flagged = await this.links.flaggedIds(
      rows.flatMap((r) => r.socialAccounts.map((a) => a.id)),
    );
    return rows.map(
      ({ socialAccounts, user, contactMethod, contactValue, savedFilters: _s, ...p }) => ({
        ...p,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
        contacts: { method: contactMethod, value: contactValue },
        socialAccounts: socialAccounts.map((a) => ({
          ...publicAccount(a),
          reuseWarning: flagged.has(a.id),
        })),
      }),
    );
  }

  async approve(profileId: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { id: profileId } });
    if (!p) throw notFound('Influencer');
    if (p.status !== 'PENDING_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'Profile is not waiting for review');
    await this.prisma.influencerProfile.update({
      where: { id: p.id },
      data: { status: 'APPROVED', approvedAt: this.clock.now(), rejectionReason: null },
    });
    // The admin saw these accounts on the profile card; approving the blogger approves them.
    await this.prisma.socialAccount.updateMany({
      where: { influencerId: p.id, reviewStatus: 'PENDING' },
      data: { reviewStatus: 'APPROVED', reviewedAt: this.clock.now(), reviewNote: null },
    });
    await this.notifications.notify(p.userId, 'VERIFICATION_APPROVED', {
      link: '/influencer/deals',
    });
  }

  async reject(profileId: string, reason: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { id: profileId } });
    if (!p) throw notFound('Influencer');
    if (p.status !== 'PENDING_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'Profile is not waiting for review');
    await this.prisma.influencerProfile.update({
      where: { id: p.id },
      data: { status: 'REJECTED', rejectionReason: reason },
    });
    await this.notifications.notify(p.userId, 'VERIFICATION_REJECTED', {
      params: { reason },
      link: '/influencer/verification',
    });
  }

  /** Accounts added or changed by already approved bloggers (first-time ones are reviewed with the profile). */
  /**
   * Account queues. REUSED lists every account linked to another user before (any review status)
   * whose re-registration warning has not been cleared.
   */
  async accounts(status: AccountReviewStatus | 'REUSED' = 'PENDING') {
    const reused = status === 'REUSED' ? await this.links.flaggedIds() : null;
    const rows = await this.prisma.socialAccount.findMany({
      where: reused
        ? { id: { in: [...reused] } }
        : { reviewStatus: status as AccountReviewStatus, influencer: { status: 'APPROVED' } },
      orderBy: status === 'PENDING' || reused ? { createdAt: 'asc' } : { reviewedAt: 'desc' },
      take: 200,
      include: {
        influencer: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    const flagged = reused ?? (await this.links.flaggedIds(rows.map((r) => r.id)));
    return rows.map(({ influencer, ...a }) => ({
      ...publicAccount(a),
      reuseWarning: flagged.has(a.id),
      createdAt: a.createdAt,
      influencer: {
        id: influencer.id,
        displayName: influencer.displayName,
        avatarUrl: influencer.avatarUrl,
        email: influencer.user.email,
      },
    }));
  }

  /** Every link of this account across users, for the re-registration modal. */
  async accountHistory(id: string) {
    const acc = await this.prisma.socialAccount.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true, displayName: true } } },
    });
    if (!acc) throw notFound('Social account');
    const links = await this.links.history(acc);
    return {
      account: {
        ...publicAccount(acc),
        userId: acc.influencer.userId,
        displayName: acc.influencer.displayName,
      },
      links: links.map((l) => ({
        id: l.id,
        platform: l.platform,
        handle: l.handle,
        linkedAt: l.linkedAt,
        unlinkedAt: l.unlinkedAt,
        email: l.user?.email ?? l.email,
        displayName: l.displayName,
        userId: l.userId,
        userDeleted: !l.userId,
        blocked: !!l.user?.blockedAt,
        current: l.userId === acc.influencer.userId,
      })),
    };
  }

  /** Admin looked at the history and lets the blogger keep the account. */
  async allowReuse(id: string) {
    const acc = await this.prisma.socialAccount.findUnique({ where: { id }, select: { id: true } });
    if (!acc) throw notFound('Social account');
    await this.prisma.socialAccount.update({
      where: { id },
      data: { reuseReviewedAt: this.clock.now() },
    });
  }

  async approveAccount(id: string) {
    const acc = await this.pendingAccount(id);
    await this.prisma.socialAccount.update({
      where: { id },
      data: { reviewStatus: 'APPROVED', reviewedAt: this.clock.now(), reviewNote: null },
    });
    await this.notifications.notify(acc.influencer.userId, 'SOCIAL_ACCOUNT_APPROVED', {
      params: { platform: acc.platform, username: acc.username },
      link: '/influencer/deals',
    });
  }

  async rejectAccount(id: string, reason: string) {
    // Pending ones from the queue, or an approved one found to be a re-registration.
    const acc = await this.pendingAccount(id, ['PENDING', 'APPROVED']);
    await this.prisma.socialAccount.update({
      where: { id },
      data: { reviewStatus: 'REJECTED', reviewedAt: this.clock.now(), reviewNote: reason },
    });
    await this.notifications.notify(acc.influencer.userId, 'SOCIAL_ACCOUNT_REJECTED', {
      params: { platform: acc.platform, username: acc.username, reason },
      link: '/influencer/verification',
    });
  }

  private async pendingAccount(id: string, allowed: AccountReviewStatus[] = ['PENDING']) {
    const acc = await this.prisma.socialAccount.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true } } },
    });
    if (!acc) throw notFound('Social account');
    if (!allowed.includes(acc.reviewStatus))
      throw new AppError('INVALID_TRANSITION', 'This account is not waiting for review');
    return acc;
  }

  /** Admin approves a brief: it goes live and the approved content is fingerprinted. */
  async approveDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { brand: { select: { userId: true } } },
    });
    if (!deal) throw notFound('Deal');
    if (deal.status !== 'IN_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'This brief is not waiting for review');
    const now = this.clock.now();
    if (deal.applicationDeadline <= now)
      throw new AppError('VALIDATION_FAILED', 'The application deadline has passed');
    const { count } = await this.prisma.deal.updateMany({
      where: { id, status: 'IN_REVIEW' },
      data: {
        status: 'ACTIVE',
        publishedAt: deal.publishedAt ?? now,
        reviewedAt: now,
        reviewNote: null,
        approvedKey: dealReviewKey(deal),
      },
    });
    if (count)
      await this.notifications.notify(deal.brand.userId, 'DEAL_APPROVED', {
        params: { deal: deal.title },
        link: `/brand/deals/${id}/applicants`,
      });
  }

  /** Admin sends a brief back with a reason; the brand edits it and sends it again. */
  async rejectDeal(id: string, reason: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { brand: { select: { userId: true } } },
    });
    if (!deal) throw notFound('Deal');
    if (deal.status !== 'IN_REVIEW')
      throw new AppError('INVALID_TRANSITION', 'This brief is not waiting for review');
    const { count } = await this.prisma.deal.updateMany({
      where: { id, status: 'IN_REVIEW' },
      data: { status: 'REJECTED', reviewedAt: this.clock.now(), reviewNote: reason },
    });
    if (count)
      await this.notifications.notify(deal.brand.userId, 'DEAL_REJECTED', {
        params: { deal: deal.title, reason },
        link: `/brand/deals/${id}/edit`,
      });
  }

  async deals(status?: DealStatus, q?: string) {
    const where: Prisma.DealWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { brand: { companyName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const deals = await this.prisma.deal.findMany({
      where,
      // The review queue is first come, first served.
      orderBy: status === 'IN_REVIEW' ? { submittedAt: 'asc' } : { createdAt: 'desc' },
      take: 200,
      include: {
        brand: {
          select: {
            id: true,
            companyName: true,
            website: true,
            instagramUrl: true,
            user: { select: { email: true } },
          },
        },
        _count: { select: { applications: true } },
      },
    });
    return deals.map(({ _count, ...d }) => ({ ...d, applicantCount: _count.applications }));
  }

  async closeDeal(id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw notFound('Deal');
    return this.prisma.deal.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async users(role?: Role, q?: string, state?: UserState) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(q ? { email: { contains: q, mode: 'insensitive' } } : {}),
        ...(state === 'unverified' ? { emailVerifiedAt: null } : {}),
        ...(state === 'blocked' ? { blockedAt: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        blockedAt: true,
        createdAt: true,
        influencer: {
          select: {
            id: true,
            displayName: true,
            status: true,
            socialAccounts: { select: { id: true } },
          },
        },
        brand: { select: { id: true, companyName: true } },
        subscription: { select: { status: true, planCode: true, trialEndsAt: true } },
      },
    });
    const flagged = await this.links.flaggedIds(
      users.flatMap((u) => u.influencer?.socialAccounts.map((a) => a.id) ?? []),
    );
    return users.map(({ influencer, ...u }) => ({
      ...u,
      influencer: influencer && {
        id: influencer.id,
        displayName: influencer.displayName,
        status: influencer.status,
      },
      /** Accounts of this user with an open re-registration warning. */
      reuseWarnings:
        influencer?.socialAccounts.filter((a) => flagged.has(a.id)).map((a) => a.id) ?? [],
    }));
  }

  private async userOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User');
    return user;
  }

  async verifyEmail(id: string) {
    const user = await this.userOrThrow(id);
    if (user.emailVerifiedAt) return;
    await this.prisma.user.update({ where: { id }, data: { emailVerifiedAt: this.clock.now() } });
  }

  async resendVerification(id: string) {
    const user = await this.userOrThrow(id);
    if (user.emailVerifiedAt) throw new AppError('CONFLICT', 'This email is already confirmed');
    await this.auth.sendVerification(user);
  }

  async sendPasswordReset(id: string) {
    const user = await this.userOrThrow(id);
    if (user.blockedAt) throw new AppError('ACCOUNT_BLOCKED', 'This account is blocked');
    await this.auth.forgotPassword(user.email);
  }

  async signOutEverywhere(id: string) {
    await this.userOrThrow(id);
    await this.auth.revokeAllSessions(id);
  }

  async setBlocked(id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User');
    if (user.role === 'ADMIN') throw new AppError('FORBIDDEN', 'Admins cannot be blocked here');
    await this.prisma.user.update({
      where: { id },
      data: { blockedAt: blocked ? this.clock.now() : null },
    });
    if (blocked) {
      await this.auth.revokeAllSessions(id);
      // A blocked brand's open deals disappear from feeds.
      await this.prisma.deal.updateMany({
        where: { brand: { userId: id }, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });
    }
  }

  async payments() {
    const rows = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        kind: true,
        provider: true,
        providerOrderId: true,
        failureReason: true,
        createdAt: true,
        planCode: true,
        subscription: {
          select: {
            status: true,
            planCode: true,
            trialEndsAt: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });
    const totals = await this.prisma.payment.groupBy({
      by: ['currency'],
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true },
    });
    return {
      items: rows,
      totals: totals.map((t) => ({ currency: t.currency, amount: t._sum.amount ?? 0 })),
    };
  }

  async stats() {
    const [users, pending, activeDeals, subs] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.influencerProfile.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.deal.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      users: Object.fromEntries(users.map((u) => [u.role, u._count])),
      pendingVerifications: pending,
      activeDeals,
      subscriptions: Object.fromEntries(subs.map((s) => [s.status, s._count])),
    };
  }
}
