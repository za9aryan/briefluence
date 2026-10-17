import { Injectable } from '@nestjs/common';
import type { BrandProfileData } from '@briefluence/shared';
import { AppError, notFound } from '../../common/app-error';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  getMine(userId: string) {
    return this.prisma.brandProfile.findUnique({ where: { userId } });
  }

  async requireMine(userId: string) {
    const brand = await this.getMine(userId);
    if (!brand) throw new AppError('PROFILE_INCOMPLETE', 'Create your brand profile first');
    return brand;
  }

  upsertMine(userId: string, data: BrandProfileData) {
    return this.prisma.brandProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  }

  /** Public brand card for influencers; contact person is revealed per application, not here. */
  async getPublic(id: string) {
    const b = await this.prisma.brandProfile.findUnique({
      where: { id },
      include: { user: { select: { blockedAt: true } }, _count: { select: { deals: { where: { status: { not: 'DRAFT' } } } } } },
    });
    if (!b || b.user.blockedAt) throw notFound('Brand');
    return {
      id: b.id,
      companyName: b.companyName,
      logoUrl: b.logoUrl,
      website: b.website,
      instagramUrl: b.instagramUrl,
      description: b.description,
      country: b.country,
      city: b.city,
      dealsPosted: b._count.deals,
    };
  }

  async dashboard(userId: string) {
    const brand = await this.requireMine(userId);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [byStatus, newApplicants, pendingReview, recent] = await Promise.all([
      this.prisma.deal.groupBy({ by: ['status'], where: { brandId: brand.id }, _count: true }),
      this.prisma.application.count({ where: { deal: { brandId: brand.id }, createdAt: { gte: since } } }),
      this.prisma.application.count({ where: { deal: { brandId: brand.id }, status: { in: ['APPLIED', 'VIEWED'] } } }),
      this.prisma.application.findMany({
        where: { deal: { brandId: brand.id } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          deal: { select: { id: true, title: true } },
          influencer: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      }),
    ]);
    const deals = Object.fromEntries(byStatus.map((g) => [g.status, g._count]));
    return {
      deals: {
        DRAFT: deals.DRAFT ?? 0,
        ACTIVE: deals.ACTIVE ?? 0,
        PAUSED: deals.PAUSED ?? 0,
        CLOSED: deals.CLOSED ?? 0,
        EXPIRED: deals.EXPIRED ?? 0,
      },
      newApplicants7d: newApplicants,
      awaitingReview: pendingReview,
      recentApplicants: recent.map((a) => ({
        id: a.id,
        status: a.status,
        matchScore: a.matchScore,
        createdAt: a.createdAt,
        deal: a.deal,
        influencer: a.influencer,
      })),
    };
  }
}
