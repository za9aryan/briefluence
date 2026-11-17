import { Injectable, Logger } from '@nestjs/common';
import {
  couponProblem,
  couponStats,
  couponUsesLeft,
  isPaidPlan,
  normalizeCouponCode,
  type CouponCreateInput,
  type Currency,
  type PlanCode,
} from '@briefluence/shared';
import { Prisma, type Coupon } from '@prisma/client';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { PaddleClient, type ProPlanCode } from './paddle/paddle.client';

const publicCoupon = (c: Coupon) => ({
  code: c.code,
  percentOff: c.percentOff,
  billingPeriods: c.billingPeriods,
  plans: c.plans,
});

/**
 * Coupons are Paddle discounts created from our admin dashboard
 * (https://developer.paddle.com/api-reference/discounts/create-discount) and mirrored here. Paddle
 * applies them at checkout and enforces the total limit and expiry; we add one coupon per account,
 * friendly checks before checkout, and statistics from our own payment records.
 */
@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleClient,
    private readonly clock: Clock,
  ) {}

  private requirePaddle() {
    const cfg = this.paddle.config;
    if (!cfg) throw new AppError('CONFLICT', 'Coupons work with Paddle payments only');
    return cfg;
  }

  // ─── Blogger ────────────────────────────────────────────

  /**
   * The coupon if this blogger can use it (for `plan`, or any plan when null); otherwise a typed
   * COUPON_INVALID error with the reason.
   */
  async usable(userId: string, rawCode: string, plan: PlanCode | null) {
    const code = normalizeCouponCode(rawCode);
    const [coupon, usedBefore] = await Promise.all([
      this.prisma.coupon.findUnique({
        where: { code },
        include: { _count: { select: { redemptions: true } } },
      }),
      this.prisma.couponRedemption.count({ where: { userId } }),
    ]);
    const problem = couponProblem(
      coupon && {
        active: coupon.active,
        expiresAt: coupon.expiresAt,
        maxUses: coupon.maxUses,
        uses: coupon._count.redemptions,
        plans: coupon.plans,
      },
      { now: this.clock.now(), plan, usedCouponBefore: usedBefore > 0 },
    );
    if (problem || !coupon)
      throw new AppError('COUPON_INVALID', 'This coupon cannot be used', {
        reason: problem ?? 'NOT_FOUND',
      });
    return coupon;
  }

  async check(userId: string, code: string) {
    this.requirePaddle();
    return publicCoupon(await this.usable(userId, code, null));
  }

  /**
   * A completed Paddle transaction with a discount: if it is one of our coupons, record the
   * redemption once (one per account; a repeated webhook is ignored).
   */
  async recordRedemption(input: {
    userId: string;
    paddleDiscountId: string;
    paddleTransactionId: string;
    planCode: PlanCode;
    amount: number;
    currency: Currency;
  }) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { paddleDiscountId: input.paddleDiscountId },
    });
    if (!coupon) return;
    try {
      await this.prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          planCode: input.planCode,
          amount: input.amount,
          currency: input.currency,
          paddleTransactionId: input.paddleTransactionId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }

  // ─── Admin ──────────────────────────────────────────────

  /** Creates the Paddle discount first, then our copy (so a coupon always exists in Paddle). */
  async create(input: CouponCreateInput, adminId: string) {
    const cfg = this.requirePaddle();
    const code = input.code ? normalizeCouponCode(input.code) : undefined;
    if (code && (await this.prisma.coupon.findUnique({ where: { code } })))
      throw new AppError('CONFLICT', 'A coupon with this code already exists');
    const plans = input.plans.filter(
      (p): p is ProPlanCode => isPaidPlan(p) && !!cfg.prices[p as ProPlanCode],
    );
    if (!plans.length) throw new AppError('VALIDATION_FAILED', 'These plans are not available');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= this.clock.now().getTime())
      throw new AppError('VALIDATION_FAILED', 'The end date must be in the future');

    const discount = await this.paddle.createDiscount({
      description: `briefluence coupon${input.note ? `: ${input.note}` : ''}`.slice(0, 500),
      enabled_for_checkout: true,
      ...(code ? { code } : {}),
      type: 'percentage',
      amount: String(input.percentOff),
      // N periods = the first payment plus N−1 renewals ("a recurring discount set for 4 billing
      // periods applies to the initial transaction and the next 3 renewals"). 1 = first only.
      recur: input.billingPeriods !== 1,
      maximum_recurring_intervals:
        input.billingPeriods != null && input.billingPeriods > 1 ? input.billingPeriods : null,
      usage_limit: input.maxUses,
      restrict_to: plans.map((p) => cfg.prices[p]!),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      custom_data: { source: 'briefluence-admin' },
    });
    if (!discount.code) throw new AppError('PROVIDER_ERROR', 'Paddle returned no code');
    return this.prisma.coupon.create({
      data: {
        code: normalizeCouponCode(discount.code),
        note: input.note || null,
        percentOff: input.percentOff,
        billingPeriods: input.billingPeriods,
        plans,
        maxUses: input.maxUses,
        expiresAt,
        paddleDiscountId: discount.id,
        createdById: adminId,
      },
    });
  }

  /** On/off in Paddle (archived discounts can't be used) and here. */
  async setActive(id: string, active: boolean) {
    this.requirePaddle();
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw notFound('Coupon');
    await this.paddle.setDiscountStatus(coupon.paddleDiscountId, active ? 'active' : 'archived');
    return this.prisma.coupon.update({ where: { id }, data: { active } });
  }

  /** Every coupon with its use count and conversion, newest first. */
  async list() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { email: true } } },
    });
    const views = await this.redemptionViews(coupons.map((c) => c.id));
    const now = this.clock.now();
    const rows = coupons.map((c) => {
      const mine = views.filter((v) => v.couponId === c.id);
      return {
        ...this.adminCoupon(c, mine.length, now),
        createdBy: c.createdBy?.email ?? null,
        stats: couponStats(mine),
      };
    });
    /** `enabled`: coupons need Paddle; without it the page explains instead of failing. */
    return { enabled: !!this.paddle.config, coupons: rows };
  }

  /** One coupon: statistics, Paddle's own use count and who used it. */
  async get(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { createdBy: { select: { email: true } } },
    });
    if (!coupon) throw notFound('Coupon');
    const views = await this.redemptionViews([id]);
    let paddleTimesUsed: number | null = null;
    if (this.paddle.config) {
      try {
        paddleTimesUsed = (await this.paddle.getDiscount(coupon.paddleDiscountId)).times_used;
      } catch (err) {
        this.logger.warn(`Could not read Paddle discount usage: ${(err as Error).message}`);
      }
    }
    return {
      ...this.adminCoupon(coupon, views.length, this.clock.now()),
      createdBy: coupon.createdBy?.email ?? null,
      paddleTimesUsed,
      stats: couponStats(views),
      redemptions: views.map(({ couponId: _c, ...r }) => r),
    };
  }

  private adminCoupon(c: Coupon, uses: number, now: Date) {
    const expired = !!c.expiresAt && c.expiresAt.getTime() <= now.getTime();
    const usesLeft = couponUsesLeft({ maxUses: c.maxUses, uses });
    return {
      id: c.id,
      code: c.code,
      note: c.note,
      percentOff: c.percentOff,
      billingPeriods: c.billingPeriods,
      plans: c.plans,
      maxUses: c.maxUses,
      usesLeft,
      expiresAt: c.expiresAt,
      active: c.active,
      /** What the admin sees: on, off, past its end date, or no uses left. */
      state: !c.active ? 'OFF' : expired ? 'EXPIRED' : usesLeft === 0 ? 'USED_UP' : 'ON',
      createdAt: c.createdAt,
    };
  }

  /** Per redemption: who, when, what they paid since, and whether Pro still renews. */
  private async redemptionViews(couponIds: string[]) {
    if (!couponIds.length) return [];
    const rows = await this.prisma.couponRedemption.findMany({
      where: { couponId: { in: couponIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            influencer: { select: { displayName: true, username: true } },
            subscription: {
              select: {
                status: true,
                planCode: true,
                cancelAtPeriodEnd: true,
                currentPeriodEnd: true,
                payments: {
                  where: { status: 'SUCCEEDED' },
                  orderBy: { createdAt: 'asc' },
                  select: {
                    amount: true,
                    currency: true,
                    createdAt: true,
                    providerPaymentId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const now = this.clock.now();
    return rows.map((r) => {
      const sub = r.user.subscription;
      // The coupon's own first payment, then everything paid later (renewals).
      const after = (sub?.payments ?? []).filter(
        (p) =>
          p.providerPaymentId === r.paddleTransactionId ||
          p.createdAt.getTime() > r.createdAt.getTime(),
      );
      const renewing =
        !!sub &&
        sub.status === 'ACTIVE' &&
        isPaidPlan(sub.planCode) &&
        !sub.cancelAtPeriodEnd &&
        !!sub.currentPeriodEnd &&
        sub.currentPeriodEnd.getTime() > now.getTime();
      // Revenue per currency (plans can be priced in different currencies over time).
      const revenue: Partial<Record<Currency, number>> = {};
      for (const p of after) revenue[p.currency] = (revenue[p.currency] ?? 0) + p.amount;
      return {
        couponId: r.couponId,
        id: r.id,
        email: r.user.email,
        name: r.user.influencer?.displayName ?? null,
        username: r.user.influencer?.username ?? null,
        planCode: r.planCode,
        firstAmount: r.amount,
        currency: r.currency,
        redeemedAt: r.createdAt,
        paidAfter: after.map((p) => p.amount),
        revenue,
        renewing,
      };
    });
  }
}
