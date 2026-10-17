import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  applyCancel,
  applyPaymentSucceeded,
  applyRenewalFailed,
  applyResume,
  applyTimeTransitions,
  canCheckout,
  formatMoney,
  hasAccess,
  isChargeDue,
  nextChargeAt,
  startTrial,
  TRIAL_REMINDER_DAYS_BEFORE,
  trialDaysLeft,
  type SubscriptionState,
} from '@briefluence/shared';
import { Prisma, type Subscription } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../../common/app-error';
import { Clock } from '../../common/clock';
import { PrismaService } from '../../common/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { QueueService } from '../../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_PROVIDER, type PaymentOutcome, type PaymentProvider } from './providers/types';

export const RENEW_JOB = 'billing.renew';

const toState = (s: Subscription): SubscriptionState => ({
  status: s.status,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
});

const fromState = (s: SubscriptionState) => ({
  status: s.status,
  trialEndsAt: s.trialEndsAt,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  bindingId: s.bindingId,
  failedAttempts: s.failedAttempts,
  pastDueSince: s.pastDueSince,
});

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
    private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register<{ subscriptionId: string }>(RENEW_JOB, ({ subscriptionId }) => this.renew(subscriptionId));
  }

  get price() {
    return { amount: this.env.SUBSCRIPTION_PRICE_MINOR, currency: this.env.SUBSCRIPTION_CURRENCY };
  }

  private priceLabel() {
    return formatMoney(this.price.amount, this.price.currency);
  }

  async getForUser(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const now = this.clock.now();
    if (!sub) return { subscription: null, price: this.price, provider: this.provider.name };
    const state = toState(sub);
    return {
      subscription: {
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        cardMask: sub.cardMask,
        hasCard: !!sub.bindingId,
        trialDaysLeft: trialDaysLeft(state, now),
        hasAccess: hasAccess(state, now),
        nextChargeAt: nextChargeAt(state),
        canCheckout: canCheckout(state),
      },
      price: this.price,
      provider: this.provider.name,
    };
  }

  private async requireSub(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new AppError('TRIAL_NOT_STARTED', 'Start your free month first');
    return sub;
  }

  /**
   * The blogger explicitly accepts the free month; the 30 days count from this moment.
   * Idempotent: a second call returns the existing subscription unchanged.
   */
  async startTrial(userId: string) {
    const profile = await this.prisma.influencerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new AppError('PROFILE_INCOMPLETE', 'Complete your profile first');
    const trial = startTrial(this.clock.now());
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: trial.status, trialEndsAt: trial.trialEndsAt },
      update: {},
    });
    return this.getForUser(userId);
  }

  /** Allocates a unique integer order id (Ameria requires numeric OrderIDs). */
  private async createPayment(subscriptionId: string, kind: 'checkout' | 'renewal', raw?: Prisma.InputJsonValue) {
    const p = await this.prisma.payment.create({
      data: {
        subscriptionId,
        kind,
        amount: this.price.amount,
        currency: this.price.currency,
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

  async checkout(userId: string): Promise<{ redirectUrl: string }> {
    const sub = await this.requireSub(userId);
    if (!canCheckout(toState(sub))) throw new AppError('CONFLICT', 'Your subscription is already active');
    const cardHolderId = `bf-${sub.id}-${Date.now().toString(36)}`;
    const payment = await this.createPayment(sub.id, 'checkout', { cardHolderId });
    try {
      const result = await this.provider.createCheckout({
        orderId: payment.providerOrderId,
        amount: payment.amount,
        currency: payment.currency,
        description: 'Briefluence monthly subscription',
        backUrl: `${this.env.WEB_URL}/api/v1/billing/return`,
        cardHolderId,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: result.providerPaymentId, raw: { cardHolderId, init: (result.raw ?? null) as Prisma.InputJsonValue } },
      });
      return { redirectUrl: result.redirectUrl };
    } catch (err) {
      this.logger.error(`Checkout init failed: ${(err as Error).message}`);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Init failed' } });
      throw new AppError('PROVIDER_ERROR', 'The payment page could not be opened. Try again in a minute.');
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
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { subscription: true } });
      if (count === 0) return { applied: false, payment };
      if (outcome.raw) {
        const prev = (payment.raw ?? {}) as Prisma.JsonObject;
        await tx.payment.update({ where: { id: paymentId }, data: { raw: { ...prev, result: outcome.raw as Prisma.InputJsonValue } } });
      }
      const sub = payment.subscription;
      let next = toState(sub);
      if (outcome.status === 'SUCCEEDED') {
        next = applyPaymentSucceeded(next, now, outcome.bindingId ? { bindingId: outcome.bindingId } : undefined);
      } else if (payment.kind === 'renewal') {
        next = applyRenewalFailed(next, now);
      }
      await tx.subscription.update({
        where: { id: sub.id },
        data: { ...fromState(next), ...(outcome.cardMask && payment.kind === 'checkout' ? { cardMask: outcome.cardMask } : {}) },
      });
      return { applied: true, payment, next };
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
    if (result.payment.kind === 'renewal' && result.next?.status === 'EXPIRED') {
      await this.notifications.notify(userId, 'SUBSCRIPTION_EXPIRED', {
        params: { reason: 'retries', amount: this.price.amount, currency: this.price.currency },
        link: '/influencer/billing',
      });
    } else {
      const retry = result.next ? nextChargeAt(result.next) : null;
      await this.notifications.notify(userId, 'PAYMENT_FAILED', {
        params: { ...money, retry: result.payment.kind === 'renewal' && retry ? retry.toISOString() : null },
        link: '/influencer/billing',
      });
    }
    return false;
  }

  async cancel(userId: string) {
    const sub = await this.requireSub(userId);
    const next = applyCancel(toState(sub));
    await this.prisma.subscription.update({ where: { id: sub.id }, data: fromState(next) });
    return this.getForUser(userId);
  }

  async resume(userId: string) {
    const sub = await this.requireSub(userId);
    if (!sub.bindingId) throw new AppError('CONFLICT', 'Add a card by subscribing again');
    await this.prisma.subscription.update({ where: { id: sub.id }, data: fromState(applyResume(toState(sub))) });
    return this.getForUser(userId);
  }

  /** Deletes the card binding; without a card the plan simply ends with the current period. */
  async removeCard(userId: string) {
    const sub = await this.requireSub(userId);
    if (!sub.bindingId) return this.getForUser(userId);
    await this.provider.removeBinding(sub.bindingId);
    const state = { ...toState(sub), bindingId: null };
    const next = sub.status === 'ACTIVE' ? { ...state, cancelAtPeriodEnd: true } : sub.status === 'PAST_DUE' ? applyCancel(state) : state;
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { ...fromState(next), cardMask: null } });
    return this.getForUser(userId);
  }

  async payments(userId: string) {
    return this.prisma.payment.findMany({
      where: { subscription: { userId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, amount: true, currency: true, status: true, kind: true, failureReason: true, createdAt: true, providerOrderId: true },
    });
  }

  // ─── Jobs ────────────────────────────────────────────────

  /** Charges one due subscription with its saved card. Idempotent: re-checks due-ness first. */
  async renew(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    const now = this.clock.now();
    if (!sub || !sub.bindingId || !isChargeDue(toState(sub), now)) return;
    const recent = await this.prisma.payment.findFirst({
      where: { subscriptionId, kind: 'renewal', status: 'PENDING', createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
    });
    if (recent) return; // another worker is charging right now

    const payment = await this.createPayment(sub.id, 'renewal');
    const outcome = await this.provider.chargeBinding({
      orderId: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      description: 'Briefluence monthly subscription renewal',
      backUrl: `${this.env.WEB_URL}/api/v1/billing/return`,
      bindingId: sub.bindingId,
    });
    await this.settle(payment.id, outcome.status === 'PENDING' ? { ...outcome, status: 'FAILED', failureReason: 'No response' } : outcome);
  }

  /** Daily: trial reminders, time-based expiry, and queueing due renewal charges. */
  async runDaily() {
    const now = this.clock.now();
    const reminderBefore = new Date(now.getTime() + TRIAL_REMINDER_DAYS_BEFORE * 86_400_000);

    const ending = await this.prisma.subscription.findMany({
      where: { status: 'TRIALING', trialReminderSentAt: null, trialEndsAt: { lte: reminderBefore, gt: now } },
    });
    for (const s of ending) {
      await this.prisma.subscription.update({ where: { id: s.id }, data: { trialReminderSentAt: now } });
      const days = trialDaysLeft(toState(s), now);
      await this.notifications.notify(s.userId, 'TRIAL_ENDING', {
        params: { days, amount: this.price.amount, currency: this.price.currency, date: s.trialEndsAt.toISOString() },
        link: '/influencer/billing',
      });
    }

    const subs = await this.prisma.subscription.findMany({ where: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'] } } });
    let expired = 0;
    let queued = 0;
    for (const s of subs) {
      const state = toState(s);
      const next = applyTimeTransitions(state, now);
      if (next.status !== state.status) {
        await this.prisma.subscription.update({ where: { id: s.id }, data: fromState(next) });
        if (next.status === 'EXPIRED') {
          expired++;
          await this.notifications.notify(s.userId, 'SUBSCRIPTION_EXPIRED', {
            params: { reason: state.status === 'TRIALING' ? 'trial' : 'period', amount: this.price.amount, currency: this.price.currency },
            link: '/influencer/billing',
          });
        }
        continue;
      }
      if (isChargeDue(state, now)) {
        queued++;
        await this.queue.add(RENEW_JOB, { subscriptionId: s.id }, { jobId: `renew-${s.id}-${now.toISOString().slice(0, 10)}` });
      }
    }
    this.logger.log(`Daily billing: ${ending.length} reminders, ${expired} expired, ${queued} renewals queued`);
    return { reminders: ending.length, expired, queued };
  }
}
