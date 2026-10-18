import { Injectable } from '@nestjs/common';
import {
  dealReviewKey,
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

export const USER_STATES = ['unverified', 'blocked'] as const;
export type UserState = (typeof USER_STATES)[number];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
    private readonly clock: Clock,
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
    return rows.map(
      ({ socialAccounts, user, contactMethod, contactValue, savedFilters: _s, ...p }) => ({
        ...p,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
        contacts: { method: contactMethod, value: contactValue },
        socialAccounts: socialAccounts.map(publicAccount),
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
        influencer: { select: { id: true, displayName: true, status: true } },
        brand: { select: { id: true, companyName: true } },
        subscription: { select: { status: true } },
      },
    });
    return users;
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
        subscription: { select: { status: true, user: { select: { id: true, email: true } } } },
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
