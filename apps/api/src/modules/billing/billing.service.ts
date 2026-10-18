import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  applicationsLeft,
  applyCancel,
  applyPaymentSucceeded,
  applyRenewalFailed,
  applyResume,
  applyTimeTransitions,
  basicWindowStart,
  canCheckout,
  effectiveTier,
  inFreeDays,
  isChargeDue,
  isPaidPlan,
  nextChargeAt,
  PLAN_WINDOW_DAYS,
  startPlan,
  TRIAL_REMINDER_DAYS_BEFORE,
  trialDaysLeft,
  type PlanCode,
  type SubscriptionState,
} from '@briefluence/shared';
import { Prisma, type Plan, type Subscription } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlansService } from './plans.service';
import { PAYMENT_PROVIDER, type PaymentOutcome, type PaymentProvider } from './providers/types';

export const RENEW_JOB = 'billing.renew';

export const toState = (s: Subscription): SubscriptionState => ({
  status: s.status,
  planCode: s.planCode,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
  basicSince: s.basicSince,
});

const fromState = (s: SubscriptionState) => ({
  status: s.status,
  planCode: s.planCode,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
  basicSince: s.basicSince,
});

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
  ) {}

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
    const base = { plans: plans.map(publicPlan), provider: this.provider.name };
    if (!sub) return { subscription: null, ...base };
    const state = toState(sub);
    const tier = effectiveTier(state, now);
    const basic = plans.find((p) => p.code === 'BASIC');
    const used = tier === 'BASIC' ? await this.applicationsUsed(userId, state, now) : 0;
    const current = (await this.prisma.plan.findUnique({ where: { code: sub.planCode } })) ?? basic;
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
        hasAccess: true,
        nextChargeAt: nextChargeAt(state),
        canCheckout: canCheckout(state, now),
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

  /**
   * The blogger chooses a plan; the free Pro days start now whatever they chose. Idempotent:
   * a second call keeps the existing subscription (only the chosen plan can still change while
   * nothing was paid). Paying for Pro is a separate checkout.
   */
  async choosePlan(userId: string, planCode: PlanCode) {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const plan = await this.plans.get(planCode);
    if (!plan.isActive) throw new AppError('VALIDATION_FAILED', 'This plan is not available');
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!existing) {
      const s = startPlan(this.clock.now(), planCode);
      await this.prisma.subscription.create({ data: { userId, ...fromState(s) } });
    } else if (existing.status === 'TRIALING' && !existing.bindingId) {
      await this.prisma.subscription.update({ where: { id: existing.id }, data: { planCode } });
    }
    return this.getForUser(userId);
  }

  /** Allocates a unique integer order id (Ameria requires numeric OrderIDs). */
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
      data: { providerOrderId: String(this.env.AMERIA_ORDER_ID_OFFSET + p.orderNumber) },
    });
  }

  /** Pays for a Pro plan. During the free days the paid period starts when they end. */
  async checkout(userId: string, planCode: PlanCode): Promise<{ redirectUrl: string }> {
    const sub = await this.requireSub(userId);
    if (!isPaidPlan(planCode)) throw new AppError('VALIDATION_FAILED', 'Basic is free');
    const plan = await this.plans.get(planCode);
    if (!plan.isActive) throw new AppError('VALIDATION_FAILED', 'This plan is not available');
    if (!canCheckout(toState(sub), this.clock.now()))
      throw new AppError('CONFLICT', 'Your Pro plan is already active');
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

  async cancel(userId: string) {
    const sub = await this.requireSub(userId);
    const next = applyCancel(toState(sub), this.clock.now());
    await this.prisma.subscription.update({ where: { id: sub.id }, data: fromState(next) });
    return this.getForUser(userId);
  }

  async resume(userId: string) {
    const sub = await this.requireSub(userId);
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
    if (!sub.bindingId) return this.getForUser(userId);
    await this.provider.removeBinding(sub.bindingId);
    const now = this.clock.now();
    const state = { ...toState(sub), bindingId: null };
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

    const plan = await this.plans.get(sub.planCode);
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
      if (isChargeDue(state, now)) {
        queued++;
        await this.queue.add(
          RENEW_JOB,
          { subscriptionId: s.id },
          { jobId: `renew-${s.id}-${now.toISOString().slice(0, 10)}` },
        );
      }
    }
    this.logger.log(
      `Daily billing: ${ending.length} reminders, ${moved} moved to Basic, ${queued} renewals queued`,
    );
    return { reminders: ending.length, movedToBasic: moved, queued };
  }
}
