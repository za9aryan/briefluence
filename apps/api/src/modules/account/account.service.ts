import { Injectable, Logger } from '@nestjs/common';
import type { DeleteAccountInput } from '@briefluence/shared';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppError } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { PaddleBillingService } from '../billing/paddle/paddle-billing.service';

/** Where a deleted account's email goes: unique, never deliverable, frees the real address. */
export const deletedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleBillingService,
    private readonly clock: Clock,
  ) {}

  /**
   * Delete my account by anonymizing it: personal data, sign-in methods, sessions, social accounts
   * (with their tokens), portfolio, notifications and push are removed; briefs and offers close;
   * open applications and offer requests are withdrawn. The row stays (blocked, "Deleted") so the
   * other side's history and payment records still make sense. A running Paddle subscription is
   * cancelled first; if Paddle refuses, nothing is deleted.
   */
  async delete(userId: string, input: DeleteAccountInput) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        subscription: true,
        influencer: { select: { id: true } },
        brand: { select: { id: true } },
      },
    });
    if (user.deletedAt) return;
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Admin accounts cannot be deleted here');
    if (user.passwordHash) {
      const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
      if (!ok) throw new AppError('INVALID_CREDENTIALS', 'Password is wrong');
    }

    const sub = user.subscription;
    if (
      sub?.paddleSubscriptionId &&
      this.paddle.enabled &&
      (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE' || sub.status === 'TRIALING')
    ) {
      await this.paddle.cancelNow(sub);
    }

    const now = this.clock.now();
    const inf = user.influencer?.id;
    const brand = user.brand?.id;
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.authIdentity.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'EXPIRED',
            planCode: 'BASIC',
            nextPlanCode: null,
            cancelAtPeriodEnd: false,
            bindingId: null,
            cardMask: null,
          },
        });
      }
      if (inf) {
        // Links stay (ids become null) so admins can still spot re-registrations.
        await tx.socialAccount.deleteMany({ where: { influencerId: inf } });
        await tx.portfolioItem.deleteMany({ where: { influencerId: inf } });
        await tx.offer.updateMany({
          where: { influencerId: inf, status: { not: 'CLOSED' } },
          data: { status: 'CLOSED' },
        });
        await tx.application.updateMany({
          where: { influencerId: inf, status: { in: ['APPLIED', 'VIEWED', 'SHORTLISTED'] } },
          data: { status: 'WITHDRAWN' },
        });
        await tx.offerRequest.updateMany({
          where: { offer: { influencerId: inf }, status: 'PENDING' },
          data: { status: 'DECLINED', decidedAt: now },
        });
        await tx.influencerProfile.update({
          where: { id: inf },
          data: {
            displayName: 'Deleted account',
            avatarUrl: null,
            bio: null,
            city: null,
            gender: null,
            birthYear: null,
            contactMethod: null,
            contactValue: null,
            savedFilters: Prisma.DbNull,
            faqBrandsWorked: null,
            faqAudience: null,
            faqBrandsWanted: null,
          },
        });
      }
      if (brand) {
        await tx.deal.updateMany({
          where: { brandId: brand, status: { notIn: ['CLOSED', 'EXPIRED'] } },
          data: { status: 'CLOSED' },
        });
        await tx.offerRequest.updateMany({
          where: { brandId: brand, status: 'PENDING' },
          data: { status: 'WITHDRAWN' },
        });
        await tx.brandProfile.update({
          where: { id: brand },
          data: {
            companyName: 'Deleted company',
            logoUrl: null,
            website: null,
            instagramUrl: null,
            description: null,
            city: null,
            contactName: null,
            contactPosition: null,
            contactMethod: null,
            contactValue: null,
          },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          email: deletedEmail(userId),
          passwordHash: null,
          emailVerifiedAt: null,
          digestEmails: false,
          blockedAt: now,
          deletedAt: now,
        },
      });
    });
    this.logger.log(`Account ${userId} deleted`);
  }
}
