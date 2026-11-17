import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  activateFreePro,
  applicationsLeft,
  applyCancel,
  applyPaymentSucceeded,
  applyRenewalFailed,
  applyResume,
  applyTimeTransitions,
  basicWindowStart,
  canActivateFreePro,
  canCheckout,
  effectiveTier,
  freeDaysLostByPaying,
  inFreeDays,
  isChargeDue,
  nextChargePlan,
  scheduleSwitch,
  needsCardToRenew,
  renewalState,
  isPaidPlan,
  nextChargeAt,
  PLAN_WINDOW_DAYS,
  startBasic,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS_BEFORE,
  trialDaysLeft,
  type PlanCode,
  type SubscriptionState,
} from '@briefluence/shared';
import { Prisma, type Plan } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from './coupons.service';
import { PaddleBillingService } from './paddle/paddle-billing.service';
import { PlansService } from './plans.service';
import { fromState, toState } from './state';
import { PAYMENT_PROVIDER, type PaymentOutcome, type PaymentProvider } from './providers/types';

export const RENEW_JOB = 'billing.renew';
/** Free Pro in the Paddle sandbox demo. */
const DEMO_FREE_PRO_MS = 60 * 60 * 1000;

export { toState } from './state';

const publicPlan = (p: Plan) => ({
  code: p.code,
  priceMinor: p.priceMinor,
  currency: p.currency,
  applicationLimit: p.applicationLimit,
  offerLimit: p.offerLimit,
  windowDays: PLAN_WINDOW_DAYS,
});

const DESCRIPTION: Record<PlanCode, string> = {
  BASIC: 'Briefluence Basic',
  PRO_DAILY: 'Briefluence Pro, daily (test)',
  PRO_MONTHLY: 'Briefluence Pro, monthly',
  PRO_YEARLY: 'Briefluence Pro, yearly',
};

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
    private readonly clock: Clock,
    private readonly plans: PlansService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly paddle: PaddleBillingService,
    private readonly coupons: CouponsService,
  ) {}

  /** Paddle sandbox demo: free Pro lasts 1 hour instead of 30 days. */
  private freeProMs() {
    return this.paddle.demo ? DEMO_FREE_PRO_MS : undefined;
  }

  onModuleInit() {
    this.queue.register<{ subscriptionId: string }>(RENEW_JOB, ({ subscriptionId }) =>
      this.renew(subscriptionId),
    );
  }

  /** Applications the blogger sent in Basic's current window. */
  async applicationsUsed(userId: string, state: SubscriptionState, now: Date) {
    return this.prisma.application.count({
      where: { influencer: { userId }, createdAt: { gte: basicWindowStart(state, now) } },
    });
  }

  async getForUser(userId: string) {
    const [sub, plans] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { userId } }),
      this.plans.active(),
    ]);
    const now = this.clock.now();
    const base = {
      plans: plans.map(publicPlan),
      provider: this.provider.name,
      /** Paddle.js settings (public client token) when Paddle is the provider. */
      paddle: this.paddle.clientConfig(),
      /** How long the free month lasts (30 days; 1 hour in the Paddle test mode). */
      freeProHours: (this.freeProMs() ?? TRIAL_DAYS * 24 * 60 * 60 * 1000) / (60 * 60 * 1000),
      /** Coupons need Paddle (they are Paddle discounts). */
      coupons: this.paddle.enabled,
      /** The one free month of Pro can be activated now. */
      freeProAvailable: canActivateFreePro(
        sub ? toState(sub) : null,
        sub?.freeProActivatedAt ?? null,
        this.clock.now(),
      ),
    };
    if (!sub) return { subscription: null, ...base };
    const state = toState(sub);
    const tier = effectiveTier(state, now);
    const basic = plans.find((p) => p.code === 'BASIC');
    const used = tier === 'BASIC' ? await this.applicationsUsed(userId, state, now) : 0;
    const current =
      (await this.plans.all()).find((p) => p.code === sub.planCode && p.code !== 'BASIC') ?? basic;
    return {
      subscription: {
        status: sub.status,
        planCode: sub.planCode,
        tier,
        inFreeDays: inFreeDays(state, now),
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        cardMask: sub.cardMask,
        hasCard: !!sub.bindingId,
        trialDaysLeft: trialDaysLeft(state, now),
        /** Free days given up by paying for Pro now (warned before checkout). */
        freeDaysLost: freeDaysLostByPaying(state, now),
        hasAccess: true,
        nextChargeAt: nextChargeAt(state),
        canCheckout: canCheckout(state, now),
        /** renews (card saved, auto-renew on) / ends (renewal off) / null when not on paid Pro */
        renewal: renewalState(state, now),
        /** Paid Pro without a card: "Renew Pro" pays the next period and saves a card. */
        needsCardToRenew: needsCardToRenew(state, now),
        /** Scheduled switch (monthly <-> yearly) at the next renewal. */
        nextPlan: sub.nextPlanCode
          ? (plans.map(publicPlan).find((p) => p.code === sub.nextPlanCode) ?? null)
          : null,
        plan: current ? publicPlan(current) : null,
        applications: {
          used,
          limit: tier === 'BASIC' ? (basic?.applicationLimit ?? null) : null,
          left: applicationsLeft(tier, basic?.applicationLimit ?? null, used),
        },
      },
      ...base,
    };
  }

  private async requireSub(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new AppError('TRIAL_NOT_STARTED', 'Choose a plan first');
    return sub;
  }

  private async requireProfile(userId: string) {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
  }

  /**
   * The blogger chooses Basic: free from now on. Idempotent (an existing subscription is kept).
   * Pro is bought through checkout; the free month is activated separately.
   */
  async choosePlan(userId: string, planCode: PlanCode) {
    await this.requireProfile(userId);
    if (isPaidPlan(planCode)) throw new AppError('CONFLICT', 'Pay for Pro in the checkout');
    await this.ensureSubscription(userId);
    return this.getForUser(userId);
  }

  /** The subscription row, created on Basic if the blogger has none yet. */
  private async ensureSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing) return existing;
    try {
      return await this.prisma.subscription.create({
        data: { userId, ...fromState(startBasic(this.clock.now())) },
      });
    } catch (err) {
      // Two requests raced; the other one created it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        return this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
      throw err;
    }
  }

  /** The one free month of Pro, whenever the blogger wants it. No card, nothing is charged. */
  async activateFreePro(userId: string) {
    await this.requireProfile(userId);
    const sub = await this.ensureSubscription(userId);
    const now = this.clock.now();
    if (!canActivateFreePro(toState(sub), sub.freeProActivatedAt, now))
      throw new AppError('CONFLICT', 'The free month is not available');
    const next = activateFreePro(toState(sub), now, this.freeProMs());
    // Guarded by freeProActivatedAt so two clicks can't activate it twice.
    const { count } = await this.prisma.subscription.updateMany({
      where: { id: sub.id, freeProActivatedAt: null },
      data: { ...fromState(next), freeProActivatedAt: now, trialReminderSentAt: null },
    });
    if (!count) throw new AppError('CONFLICT', 'The free month is not available');
    return this.getForUser(userId);
  }

  /** Checks a coupon code before checkout (what it gives and on which plans). */
  async checkCoupon(userId: string, code: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing && !canCheckout(toState(existing), this.clock.now()))
      throw new AppError('CONFLICT', 'Your Pro plan is already active');
    return this.coupons.check(userId, code);
  }

  /** Records a pending payment; its order id is the short running payment number. */
  private async createPayment(
    subscriptionId: string,
    kind: 'checkout' | 'renewal',
    plan: Plan,
    raw?: Prisma.InputJsonValue,
  ) {
    const p = await this.prisma.payment.create({
      data: {
        subscriptionId,
        kind,
        planCode: plan.code,
        amount: plan.priceMinor,
        currency: plan.currency,
        provider: this.provider.name,
        providerOrderId: `tmp-${randomUUID()}`,
        raw,
      },
    });
    return this.prisma.payment.update({
      where: { id: p.id },
      data: { providerOrderId: String(p.orderNumber) },
    });
  }

  /**
   * Pays for a Pro plan. Bank providers: a redirect to the payment page. Paddle: settings for the
   * Paddle.js checkout window (the subscription then arrives by webhook).
   */
  async checkout(
    userId: string,
    planCode: PlanCode,
    couponCode?: string,
  ): Promise<{ redirectUrl: string } | Awaited<ReturnType<PaddleBillingService['checkout']>>> {
    if (!isPaidPlan(planCode)) throw new AppError('VALIDATION_FAILED', 'Basic is free');
    const plan = await this.plans.get(planCode);
    if (!plan.isActive) throw new AppError('VALIDATION_FAILED', 'This plan is not available');
    const now = this.clock.now();
    if (this.paddle.enabled) {
      // No plan yet is fine: the subscription is created when Paddle confirms the payment.
      const existing = await this.prisma.subscription.findUnique({ where: { userId } });
      if (existing && !canCheckout(toState(existing), now))
        throw new AppError('CONFLICT', 'Your Pro plan is already active');
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, influencer: { select: { id: true } } },
      });
      if (!user.influencer) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
      const coupon = couponCode ? await this.coupons.usable(userId, couponCode, planCode) : null;
      return this.paddle.checkout(existing, planCode, user.email, userId, coupon?.paddleDiscountId);
    }
    if (couponCode) throw new AppError('CONFLICT', 'Coupons work with Paddle payments only');
    await this.requireProfile(userId);
    const sub = await this.ensureSubscription(userId);
    const state = toState(sub);
    if (!canCheckout(state, now)) throw new AppError('CONFLICT', 'Your Pro plan is already active');
    // Renewing without a card (any Pro plan): the new period starts when the paid one ends.
    const cardHolderId = `bf-${sub.id}-${Date.now().toString(36)}`;
    const payment = await this.createPayment(sub.id, 'checkout', plan, { cardHolderId });
    try {
      const result = await this.provider.createCheckout({
        orderId: payment.providerOrderId,
        amount: payment.amount,
        currency: payment.currency,
        description: DESCRIPTION[planCode],
        backUrl: `${this.env.WEB_URL}/api/v1/billing/return`,
        cardHolderId,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: result.providerPaymentId,
          raw: { cardHolderId, init: (result.raw ?? null) as Prisma.InputJsonValue },
        },
      });
      return { redirectUrl: result.redirectUrl };
    } catch (err) {
      this.logger.error(`Checkout init failed: ${(err as Error).message}`);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: 'Init failed' },
      });
      throw new AppError(
        'PROVIDER_ERROR',
        'The payment page could not be opened. Try again in a minute.',
      );
    }
  }

  /**
   * Bank redirected back. Confirms with the provider server-to-server (query params are never
   * trusted) and is idempotent: reloading the return page does not double-apply the payment.
   */
  async handleReturn(providerPaymentId: string): Promise<'success' | 'failed' | 'pending'> {
    const payment = await this.prisma.payment.findFirst({ where: { providerPaymentId } });
    if (!payment) throw notFound('Payment');
    if (payment.status === 'SUCCEEDED') return 'success';
    if (payment.status === 'FAILED') return 'failed';

    const outcome = await this.provider.confirm(providerPaymentId);
    if (outcome.status === 'PENDING') return 'pending';
    return (await this.settle(payment.id, outcome)) ? 'success' : 'failed';
  }

  /** Applies a confirmed outcome once (guarded by the PENDING status). Returns true on success. */
  private async settle(paymentId: string, outcome: PaymentOutcome): Promise<boolean> {
    const now = this.clock.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: {
          status: outcome.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
          providerPaymentId: outcome.providerPaymentId,
          failureReason: outcome.failureReason ?? null,
        },
      });
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { subscription: true },
      });
      if (count === 0) return { applied: false, payment };
      if (outcome.raw) {
        const prev = (payment.raw ?? {}) as Prisma.JsonObject;
        await tx.payment.update({
          where: { id: paymentId },
          data: { raw: { ...prev, result: outcome.raw as Prisma.InputJsonValue } },
        });
      }
      const sub = payment.subscription;
      let next = toState(sub);
      if (outcome.status === 'SUCCEEDED') {
        next = applyPaymentSucceeded(
          next,
          now,
          payment.planCode ?? sub.planCode,
          outcome.bindingId ? { bindingId: outcome.bindingId } : undefined,
        );
      } else if (payment.kind === 'renewal') {
        next = applyRenewalFailed(next, now);
      }
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          ...fromState(next),
          ...(outcome.cardMask && payment.kind === 'checkout'
            ? { cardMask: outcome.cardMask }
            : {}),
        },
      });
      return { applied: true, payment, next, before: sub };
    });

    if (!result.applied) return result.payment.status === 'SUCCEEDED';
    const userId = result.payment.subscription.userId;
    const money = { amount: result.payment.amount, currency: result.payment.currency };
    if (outcome.status === 'SUCCEEDED') {
      await this.notifications.notify(userId, 'PAYMENT_SUCCEEDED', {
        params: { ...money, until: result.next!.currentPeriodEnd!.toISOString() },
        link: '/influencer/billing',
      });
      return true;
    }
    if (result.payment.kind === 'renewal' && result.next?.planCode === 'BASIC') {
      await this.notifyMovedToBasic(userId, 'retries');
    } else {
      const retry = result.next ? nextChargeAt(result.next) : null;
      await this.notifications.notify(userId, 'PAYMENT_FAILED', {
        params: {
          ...money,
          retry: result.payment.kind === 'renewal' && retry ? retry.toISOString() : null,
        },
        link: '/influencer/billing',
      });
    }
    return false;
  }

  /** "You are on Basic now" with Pro monthly's price for the upgrade line. */
  private async notifyMovedToBasic(userId: string, reason: 'trial' | 'period' | 'retries') {
    const [pro, basic] = await Promise.all([
      this.plans.get('PRO_MONTHLY'),
      this.plans.get('BASIC'),
    ]);
    await this.notifications.notify(userId, 'SUBSCRIPTION_EXPIRED', {
      params: {
        reason,
        amount: pro.priceMinor,
        currency: pro.currency,
        limit: basic.applicationLimit ?? 0,
      },
      link: '/influencer/billing',
    });
  }

  /** Paddle runs the paid subscription: cancel / resume / switch go through its API. */
  private paddleLinked(sub: { paddleSubscriptionId: string | null; status: string }) {
    return (
      this.paddle.enabled &&
      !!sub.paddleSubscriptionId &&
      (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE')
    );
  }

  async cancel(userId: string) {
    const sub = await this.requireSub(userId);
    if (this.paddleLinked(sub) && isPaidPlan(sub.planCode)) {
      await this.paddle.cancel(sub);
      return this.getForUser(userId);
    }
    const next = applyCancel(toState(sub), this.clock.now());
    await this.prisma.subscription.update({ where: { id: sub.id }, data: fromState(next) });
    return this.getForUser(userId);
  }

  /** Switch Pro monthly <-> yearly; takes effect at the next renewal (choose the current plan to undo). */
  async switchPlan(userId: string, planCode: PlanCode) {
    const sub = await this.requireSub(userId);
    const plan = await this.plans.get(planCode);
    if (!plan.isActive && planCode !== sub.planCode)
      throw new AppError('VALIDATION_FAILED', 'This plan is not available');
    if (this.paddleLinked(sub)) {
      await this.paddle.switchPlan(sub, planCode);
      return this.getForUser(userId);
    }
    const next = scheduleSwitch(toState(sub), planCode, this.clock.now());
    if (!next) throw new AppError('CONFLICT', 'Switching needs a paid Pro plan with a saved card');
    await this.prisma.subscription.update({ where: { id: sub.id }, data: fromState(next) });
    return this.getForUser(userId);
  }

  async resume(userId: string) {
    const sub = await this.requireSub(userId);
    if (this.paddleLinked(sub)) {
      await this.paddle.resume(sub);
      return this.getForUser(userId);
    }
    if (!sub.bindingId) throw new AppError('CONFLICT', 'Add a card by subscribing again');
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: fromState(applyResume(toState(sub))),
    });
    return this.getForUser(userId);
  }

  /** Deletes the card binding; without a card a Pro period simply ends and the blogger moves to Basic. */
  async removeCard(userId: string) {
    const sub = await this.requireSub(userId);
    if (this.paddle.enabled)
      throw new AppError('CONFLICT', 'With Paddle, update your card instead of removing it');
    if (!sub.bindingId) return this.getForUser(userId);
    await this.provider.removeBinding(sub.bindingId);
    const now = this.clock.now();
    const state = { ...toState(sub), bindingId: null, nextPlanCode: null }; // a switch needs the card
    const next =
      sub.status === 'ACTIVE' && isPaidPlan(sub.planCode)
        ? { ...state, cancelAtPeriodEnd: true }
        : sub.status === 'PAST_DUE'
          ? applyCancel(state, now)
          : state;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { ...fromState(next), cardMask: null },
    });
    return this.getForUser(userId);
  }

  /** Paddle: a transaction Paddle.js opens so the blogger can update their card. */
  async paymentMethod(userId: string) {
    const sub = await this.requireSub(userId);
    if (!this.paddleLinked(sub)) throw new AppError('CONFLICT', 'No paid Pro subscription');
    return this.paddle.paymentMethodTransaction(sub);
  }

  async payments(userId: string) {
    return this.prisma.payment.findMany({
      where: { subscription: { userId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        kind: true,
        planCode: true,
        failureReason: true,
        createdAt: true,
        providerOrderId: true,
      },
    });
  }

  // ─── Jobs ────────────────────────────────────────────────

  /** Charges one due subscription with its saved card. Idempotent: re-checks due-ness first. */
  async renew(subscriptionId: string) {
    // Paddle charges renewals itself.
    if (this.paddle.enabled) return;
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    const now = this.clock.now();
    if (!sub || !sub.bindingId || !isChargeDue(toState(sub), now)) return;
    const recent = await this.prisma.payment.findFirst({
      where: {
        subscriptionId,
        kind: 'renewal',
        status: 'PENDING',
        createdAt: { gt: new Date(now.getTime() - 3_600_000) },
      },
    });
    if (recent) return; // another worker is charging right now

    // A scheduled monthly <-> yearly switch is charged at this renewal.
    const plan = await this.plans.get(nextChargePlan(toState(sub)));
    const payment = await this.createPayment(sub.id, 'renewal', plan);
    const outcome = await this.provider.chargeBinding({
      orderId: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      description: `${DESCRIPTION[sub.planCode]} renewal`,
      backUrl: `${this.env.WEB_URL}/api/v1/billing/return`,
      bindingId: sub.bindingId,
    });
    await this.settle(
      payment.id,
      outcome.status === 'PENDING'
        ? { ...outcome, status: 'FAILED', failureReason: 'No response' }
        : outcome,
    );
  }

  /** Daily: free-days reminders, moves to Basic, and queueing due renewal charges. */
  async runDaily() {
    const now = this.clock.now();
    const reminderBefore = new Date(now.getTime() + TRIAL_REMINDER_DAYS_BEFORE * 86_400_000);
    const pro = await this.plans.get('PRO_MONTHLY');

    // Remind only bloggers who will drop to Basic (nothing paid yet).
    const ending = await this.prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialReminderSentAt: null,
        trialEndsAt: { lte: reminderBefore, gt: now },
      },
    });
    for (const s of ending) {
      await this.prisma.subscription.update({
        where: { id: s.id },
        data: { trialReminderSentAt: now },
      });
      await this.notifications.notify(s.userId, 'TRIAL_ENDING', {
        params: {
          days: trialDaysLeft(toState(s), now),
          amount: pro.priceMinor,
          currency: pro.currency,
          date: s.trialEndsAt.toISOString(),
        },
        link: '/influencer/billing',
      });
    }

    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] } },
    });
    let moved = 0;
    let queued = 0;
    for (const s of subs) {
      const state = toState(s);
      const next = applyTimeTransitions(state, now);
      if (next !== state) {
        await this.prisma.subscription.update({ where: { id: s.id }, data: fromState(next) });
        if (
          next.planCode === 'BASIC' &&
          (state.planCode !== 'BASIC' || state.status !== 'ACTIVE')
        ) {
          moved++;
          await this.notifyMovedToBasic(s.userId, state.status === 'TRIALING' ? 'trial' : 'period');
        }
        continue;
      }
      if (!this.paddle.enabled && isChargeDue(state, now)) {
        queued++;
        await this.queue.add(
          RENEW_JOB,
          { subscriptionId: s.id },
          { jobId: `renew-${s.id}-${now.toISOString().slice(0, 10)}` },
        );
      }
    }
    // Paddle: re-read subscriptions whose period ended without a webhook.
    if (this.paddle.enabled) await this.paddle.reconcile();
    this.logger.log(
      `Daily billing: ${ending.length} reminders, ${moved} moved to Basic, ${queued} renewals queued`,
    );
    return { reminders: ending.length, movedToBasic: moved, queued };
  }
}
