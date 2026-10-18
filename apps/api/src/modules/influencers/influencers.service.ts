import { Injectable } from '@nestjs/common';
import {
  APPLICATION_STATUSES,
  hasAccess,
  trialDaysLeft,
  type ApplicationStatus,
  type InfluencerProfileData,
  isAccountUsable,
} from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publicAccount } from './serializers';

@Injectable()
export class InfluencersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
  ) {}

  async getMine(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!p) return null;
    const { socialAccounts, ...rest } = p;
    return { ...rest, socialAccounts: socialAccounts.map(publicAccount) };
  }

  /** Creates or updates the profile. The free month is started separately, by the blogger (POST /billing/trial). */
  async upsertMine(userId: string, data: InfluencerProfileData) {
    await this.prisma.influencerProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.getMine(userId);
  }

  async submitForReview(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: { socialAccounts: { where: { tokenRevokedAt: null }, select: { id: true } } },
    });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    if (p.status === 'PENDING_REVIEW' || p.status === 'APPROVED') {
      throw new AppError('INVALID_TRANSITION', 'Profile is already submitted');
    }
    if (p.socialAccounts.length === 0) {
      throw new AppError('PROFILE_INCOMPLETE', 'Connect at least one social account');
    }
    await this.prisma.influencerProfile.update({
      where: { id: p.id },
      data: { status: 'PENDING_REVIEW', submittedAt: this.clock.now(), rejectionReason: null },
    });
    await this.notifications.notifyAdmins('VERIFICATION_PENDING', {
      params: { name: p.displayName },
      link: '/admin/verifications',
    });
    return this.getMine(userId);
  }

  async saveFilters(userId: string, filters: unknown) {
    await this.prisma.influencerProfile.update({
      where: { userId },
      data: { savedFilters: (filters ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
  }

  async dashboard(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { userId } });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const [groups, sub] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: { influencerId: p.id },
        _count: true,
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const g of groups) byStatus[g.status] = g._count;
    const now = this.clock.now();
    return {
      applications: Object.values(byStatus).reduce((a, b) => a + b, 0),
      accepted: byStatus.ACCEPTED + byStatus.COMPLETED,
      completed: byStatus.COMPLETED,
      byStatus,
      profileViews: p.profileViews,
      verificationStatus: p.status,
      trialDaysLeft: sub ? trialDaysLeft(sub, now) : 0,
      subscriptionStatus: sub?.status ?? null,
      hasAccess: hasAccess(sub, now),
    };
  }

  /**
   * Public profile for brands (approved influencers only). Contacts are included only when the
   * viewing brand has accepted this influencer on one of its deals.
   */
  async getForViewer(viewer: AuthUser, influencerId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      include: { socialAccounts: { orderBy: { followers: 'desc' } } },
    });
    if (!p || (p.status !== 'APPROVED' && viewer.role !== 'ADMIN')) throw notFound('Influencer');

    let showContacts = viewer.role === 'ADMIN';
    if (viewer.role === 'BRAND') {
      const accepted = await this.prisma.application.findFirst({
        where: {
          influencerId,
          status: { in: ['ACCEPTED', 'COMPLETED'] },
          deal: { brand: { userId: viewer.id } },
        },
        select: { id: true },
      });
      showContacts = !!accepted;
      await this.prisma.influencerProfile.update({
        where: { id: p.id },
        data: { profileViews: { increment: 1 } },
      });
    }
    return {
      id: p.id,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      country: p.country,
      city: p.city,
      gender: p.gender,
      birthYear: p.birthYear,
      languages: p.languages,
      niches: p.niches,
      verified: p.status === 'APPROVED',
      approvedAt: p.approvedAt,
      // Brands see only accounts an admin approved.
      socialAccounts: p.socialAccounts
        .filter((a) => viewer.role === 'ADMIN' || isAccountUsable(a))
        .map(publicAccount),
      contacts: showContacts ? { method: p.contactMethod, value: p.contactValue } : null,
    };
  }
}
