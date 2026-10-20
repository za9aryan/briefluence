import { Injectable } from '@nestjs/common';
import {
  PORTFOLIO_MAX_ITEMS,
  portfolioStatusAfterEdit,
  type AccountReviewStatus,
  type InfluencerFaqData,
  type PortfolioItemData,
} from '@briefluence/shared';
import type { PortfolioItem } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';

/** Portfolio item as the API returns it. `reviewStatus`/`reviewNote` are for the owner and admins. */
export function publicPortfolioItem(i: PortfolioItem) {
  return {
    id: i.id,
    imageUrl: i.imageUrl,
    title: i.title,
    description: i.description,
    linkUrl: i.linkUrl,
    reviewStatus: i.reviewStatus,
    reviewNote: i.reviewNote,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly clock: Clock,
  ) {}

  private async profile(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true, displayName: true },
    });
    if (!p) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    return p;
  }

  /** Items belong to the blogger: anyone else gets a 404, not a hint that the id exists. */
  private async ownItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { influencer: { select: { userId: true } } },
    });
    if (!item || item.influencer.userId !== userId) throw notFound('Portfolio item');
    return item;
  }

  private checkImage(url: string) {
    if (!this.storage.isOwnUpload(url, 'portfolio'))
      throw new AppError('VALIDATION_FAILED', 'Upload the image first', { field: 'imageUrl' });
  }

  async listMine(userId: string) {
    const p = await this.profile(userId);
    const items = await this.prisma.portfolioItem.findMany({
      where: { influencerId: p.id },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(publicPortfolioItem);
  }

  async create(userId: string, data: PortfolioItemData) {
    const p = await this.profile(userId);
    this.checkImage(data.imageUrl);
    const count = await this.prisma.portfolioItem.count({ where: { influencerId: p.id } });
    if (count >= PORTFOLIO_MAX_ITEMS)
      throw new AppError('VALIDATION_FAILED', `Up to ${PORTFOLIO_MAX_ITEMS} portfolio items`, {
        limit: PORTFOLIO_MAX_ITEMS,
      });
    const item = await this.prisma.portfolioItem.create({
      data: { ...data, influencerId: p.id, createdAt: this.clock.now() },
    });
    await this.askReview(p.displayName, item.title);
    return publicPortfolioItem(item);
  }

  async update(userId: string, itemId: string, data: PortfolioItemData) {
    const item = await this.ownItem(userId, itemId);
    if (data.imageUrl !== item.imageUrl) this.checkImage(data.imageUrl);
    const status = portfolioStatusAfterEdit(item, data);
    const updated = await this.prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        ...data,
        reviewStatus: status,
        ...(status === 'PENDING' ? { reviewNote: null, reviewedAt: null } : {}),
      },
    });
    if (status === 'PENDING' && item.reviewStatus !== 'PENDING') {
      const p = await this.profile(userId);
      await this.askReview(p.displayName, updated.title);
    }
    return publicPortfolioItem(updated);
  }

  async remove(userId: string, itemId: string) {
    await this.ownItem(userId, itemId);
    await this.prisma.portfolioItem.delete({ where: { id: itemId } });
  }

  async saveFaq(userId: string, data: InfluencerFaqData) {
    await this.profile(userId);
    await this.prisma.influencerProfile.update({ where: { userId }, data });
    return data;
  }

  private askReview(name: string, title: string) {
    return this.notifications.notifyAdmins('PORTFOLIO_REVIEW_PENDING', {
      params: { name, title },
      link: '/admin/portfolio',
    });
  }

  // ─── Admin ───────────────────────────────────────────────

  async reviewQueue(status: AccountReviewStatus) {
    const rows = await this.prisma.portfolioItem.findMany({
      where: { reviewStatus: status },
      orderBy: status === 'PENDING' ? { updatedAt: 'asc' } : { reviewedAt: 'desc' },
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
    return rows.map(({ influencer, ...i }) => ({
      ...publicPortfolioItem(i),
      influencer: {
        id: influencer.id,
        displayName: influencer.displayName,
        avatarUrl: influencer.avatarUrl,
        email: influencer.user.email,
      },
    }));
  }

  private async pending(id: string, allowed: AccountReviewStatus[] = ['PENDING']) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id },
      include: { influencer: { select: { userId: true } } },
    });
    if (!item) throw notFound('Portfolio item');
    if (!allowed.includes(item.reviewStatus))
      throw new AppError('INVALID_TRANSITION', 'This item is not waiting for review');
    return item;
  }

  async approve(id: string) {
    await this.pending(id);
    await this.prisma.portfolioItem.update({
      where: { id },
      data: { reviewStatus: 'APPROVED', reviewedAt: this.clock.now(), reviewNote: null },
    });
  }

  /** Pending items, or an approved one the admin later found unsuitable. */
  async reject(id: string, reason: string) {
    const item = await this.pending(id, ['PENDING', 'APPROVED']);
    await this.prisma.portfolioItem.update({
      where: { id },
      data: { reviewStatus: 'REJECTED', reviewedAt: this.clock.now(), reviewNote: reason },
    });
    await this.notifications.notify(item.influencer.userId, 'PORTFOLIO_REJECTED', {
      params: { title: item.title, reason },
      link: '/influencer/account#portfolio',
    });
  }
}
