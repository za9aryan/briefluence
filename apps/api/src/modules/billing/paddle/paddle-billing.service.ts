import { Injectable, Logger } from '@nestjs/common';
import {
  applyPaddleSubscription,
  isNewerEvent,
  isPaidPlan,
  paddleAmountMinor,
  startPlan,
  type Currency,
  type PlanCode,
} from '@briefluence/shared';
import { Prisma, type Subscription } from '@prisma/client';
import { AppError, notFound } from '../../../common/app-error';
import { Clock } from '../../../common/clock';
import { PrismaService } from '../../../common/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlansService } from '../plans.service';
import { fromState, toState } from '../state';
import { PaddleClient, type PaddleSubscription } from './paddle.client';

/** A Paddle webhook event (https://developer.paddle.com/webhooks/about/how-webhooks-work). */
export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: Record<string, unknown>;
}

interface PaddleTransaction {
  id: string;
  status: string;
  origin: string;
  subscription_id: string | null;
  customer_id: string | null;
  custom_data: Record<string, unknown> | null;
  currency_code: string;
  billing_period: { starts_at: string; ends_at: string } | null;
  items: { price: { id: string } }[];
  details?: { totals?: { grand_total?: string; total?: string } };
  payments?: { method_details?: { card?: { last4?: string } } }[];
}

export type SimulationScenario = 'renewal_success' | 'renewal_failed' | 'cancellation';

/** Our ids travel in Paddle's custom_data so webhooks find (or create) the right subscription. */
const OUR_ID = 'bf_subscription_id';
const OUR_USER = 'bf_user_id';
const WEBHOOK_PATH = '/api/v1/billing/paddle/webhook';

@Injectable()
export class PaddleBillingService {
  private readonly logger = new Logger(PaddleBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleClient,
    private readonly notifications: NotificationsService,
    private readonly plans: PlansService,
    private readonly clock: Clock,
  ) {}

  get enabled() {
    return !!this.paddle.config;
  }

  get demo() {
    return !!this.paddle.config?.demo;
  }

  /** What the browser needs for Paddle.js (the client token is meant to be public). */
  clientConfig() {
    const c = this.paddle.config;
    return c ? { environment: c.environment, clientToken: c.clientToken, demo: c.demo } : null;
  }

  private planFor(priceId: string | undefined): PlanCode | null {
    return priceId ? (this.paddle.config?.planByPrice.get(priceId) ?? null) : null;
  }

  // ─── Actions from the blogger ───────────────────────────

  /** Paddle.js checkout for a Pro plan; the subscription itself arrives by webhook. */
  async checkout(sub: Subscription | null, planCode: PlanCode, email: string, userId: string) {
    if (sub?.paddleSubscriptionId && (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'))
      throw new AppError('CONFLICT', 'You already have Pro; switch plans instead');
    const priceId = this.priceFor(planCode);
    return {
      paddle: {
        priceId,
        customerEmail: email,
        customData: sub ? { [OUR_USER]: userId, [OUR_ID]: sub.id } : { [OUR_USER]: userId },
      },
    };
  }

  private priceFor(planCode: PlanCode) {
    const id = isPaidPlan(planCode)
      ? this.paddle.config!.prices[planCode as Exclude<PlanCode, 'BASIC'>]
      : undefined;
    if (!id) throw new AppError('VALIDATION_FAILED', 'This plan is not available');
    return id;
  }

  private requireLinked(sub: Subscription) {
    if (!sub.paddleSubscriptionId) throw new AppError('CONFLICT', 'No paid Pro subscription yet');
    return sub.paddleSubscriptionId;
  }

  /** Renewal off: Pro stays until the paid period ends (past due: stop right away). */
  async cancel(sub: Subscription) {
    const id = this.requireLinked(sub);
    const p = await this.paddle.cancel(
      id,
      sub.status === 'PAST_DUE' ? 'immediately' : 'next_billing_period',
    );
    await this.apply(sub, p, this.clock.now());
  }

  /** Account deletion: stop the Paddle subscription right away so nothing renews. */
  async cancelNow(sub: Subscription) {
    const p = await this.paddle.cancel(this.requireLinked(sub), 'immediately');
    await this.apply(sub, p, this.clock.now());
  }

  async resume(sub: Subscription) {
    await this.apply(
      sub,
      await this.paddle.removeScheduledChange(this.requireLinked(sub)),
      this.clock.now(),
    );
  }

  async switchPlan(sub: Subscription, planCode: PlanCode) {
    if (!isPaidPlan(planCode)) throw new AppError('VALIDATION_FAILED', 'Choose a Pro plan');
    const id = this.requireLinked(sub);
    await this.apply(
      sub,
      await this.paddle.changePrice(id, this.priceFor(planCode)),
      this.clock.now(),
    );
  }

  /** Transaction for Paddle.js to open, so the customer can update their card. */
  async paymentMethodTransaction(sub: Subscription) {
    const t = await this.paddle.updatePaymentMethodTransaction(this.requireLinked(sub));
    return { transactionId: t.id };
  }

  // ─── Webhooks ───────────────────────────────────────────

  /** Processes one verified event once (duplicates are ignored). */
  async handle(event: PaddleEvent) {
    try {
      await this.prisma.billingEvent.create({
        data: { provider: 'paddle', eventId: event.event_id, type: event.event_type },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    const at = new Date(event.occurred_at);
    if (event.event_type.startsWith('subscription.')) {
      const p = event.data as unknown as PaddleSubscription;
      // Only a live subscription may create ours (a first payment); other events need one already.
      const sub = await this.find(
        p.id,
        p.custom_data,
        p.status === 'active' || p.status === 'trialing',
      );
      if (!sub)
        return this.logger.warn(`Paddle ${event.event_type} for unknown subscription ${p.id}`);
      if (!isNewerEvent(sub.paddleEventAt, at)) return;
      await this.apply(sub, p, at);
      return;
    }
    if (event.event_type === 'transaction.completed')
      return this.transactionCompleted(event.data as unknown as PaddleTransaction, at);
    if (event.event_type === 'transaction.payment_failed')
      return this.transactionFailed(event.data as unknown as PaddleTransaction);
  }

  /**
   * Our subscription for a Paddle one: linked id, then our ids from custom_data. A blogger who paid
   * before choosing any plan has none yet; with `create` it is made here (no free Pro left), and
   * `apply` then mirrors Paddle onto it.
   */
  private async find(
    paddleId: string | null,
    customData: Record<string, unknown> | null,
    create = false,
  ): Promise<Subscription | null> {
    if (paddleId) {
      const linked = await this.prisma.subscription.findUnique({
        where: { paddleSubscriptionId: paddleId },
      });
      if (linked) return linked;
    }
    const str = (k: string) =>
      typeof customData?.[k] === 'string' ? (customData[k] as string) : null;
    const ours = str(OUR_ID);
    if (ours) {
      const sub = await this.prisma.subscription.findUnique({ where: { id: ours } });
      if (sub) return sub;
    }
    const userId = str(OUR_USER);
    if (!userId) return null;
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing || !create) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return null;
    try {
      return await this.prisma.subscription.create({
        data: { userId, ...fromState(startPlan(this.clock.now(), 'BASIC', 0)) },
      });
    } catch (err) {
      // Two webhooks for the same first payment raced; the other one created it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        return this.prisma.subscription.findUnique({ where: { userId } });
      throw err;
    }
  }

  /** Mirrors Paddle's subscription onto ours; tells the blogger when Pro ended. */
  private async apply(sub: Subscription, p: PaddleSubscription, at: Date) {
    const before = toState(sub);
    const planCode = this.planFor(p.items[0]?.price.id) ?? sub.planCode;
    const next = applyPaddleSubscription(
      before,
      {
        id: p.id,
        status: p.status,
        periodEndsAt: p.current_billing_period ? new Date(p.current_billing_period.ends_at) : null,
        cancelScheduled: p.scheduled_change?.action === 'cancel',
      },
      planCode,
      this.clock.now(),
    );
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        ...fromState(next),
        paddleSubscriptionId: p.status === 'canceled' ? sub.paddleSubscriptionId : p.id,
        paddleCustomerId: p.customer_id,
        paddleEventAt: at,
      },
    });
    if (isPaidPlan(before.planCode) && before.status !== 'TRIALING' && next.planCode === 'BASIC')
      await this.notifyMovedToBasic(sub.userId);
  }

  /** A payment went through (first checkout or a renewal): record it and tell the blogger. */
  private async transactionCompleted(t: PaddleTransaction, at: Date) {
    if (!t.subscription_id) return;
    const sub = await this.find(t.subscription_id, t.custom_data, true);
    if (!sub) return this.logger.warn(`Paddle transaction ${t.id} for unknown subscription`);
    const planCode = this.planFor(t.items[0]?.price.id) ?? sub.planCode;
    const currency: Currency =
      t.currency_code === 'RUB' || t.currency_code === 'AMD' ? t.currency_code : 'USD';
    const amount = paddleAmountMinor(t.details?.totals?.grand_total ?? t.details?.totals?.total);
    const last4 = t.payments?.find((x) => x.method_details?.card?.last4)?.method_details?.card
      ?.last4;
    // The blogger changed their card: nothing was paid, only the saved card changes.
    if (t.origin === 'subscription_payment_method_change') {
      if (last4)
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { cardMask: `•••• ${last4}` },
        });
      return;
    }
    const created = await this.prisma.payment
      .create({
        data: {
          subscriptionId: sub.id,
          kind: t.origin === 'web' ? 'checkout' : 'renewal',
          planCode,
          amount,
          currency,
          provider: 'paddle',
          providerOrderId: t.id,
          providerPaymentId: t.id,
          status: 'SUCCEEDED',
          raw: { origin: t.origin, status: t.status } as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          return null;
        throw err;
      });
    if (!created) return; // already recorded
    // Link right away so Pro shows even if the subscription event comes later.
    if (!sub.paddleSubscriptionId || sub.status !== 'ACTIVE') {
      const s = await this.prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      if (isNewerEvent(s.paddleEventAt, at))
        await this.apply(
          s,
          {
            id: t.subscription_id,
            status: 'active',
            customer_id: t.customer_id ?? s.paddleCustomerId ?? '',
            custom_data: t.custom_data,
            current_billing_period: t.billing_period,
            scheduled_change: null,
            items: t.items,
          },
          at,
        );
    }
    if (last4)
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { cardMask: `•••• ${last4}` },
      });
    await this.notifications.notify(sub.userId, 'PAYMENT_SUCCEEDED', {
      params: { amount, currency, until: t.billing_period?.ends_at ?? null },
      link: '/influencer/billing',
    });
  }

  /** Paddle retries on its own schedule; we only tell the blogger to check their card. */
  private async transactionFailed(t: PaddleTransaction) {
    if (!t.subscription_id) return;
    const sub = await this.find(t.subscription_id, t.custom_data);
    if (!sub) return;
    await this.notifications.notify(sub.userId, 'PAYMENT_FAILED', {
      params: {
        amount: paddleAmountMinor(t.details?.totals?.grand_total),
        currency: t.currency_code === 'RUB' || t.currency_code === 'AMD' ? t.currency_code : 'USD',
        retry: null,
      },
      link: '/influencer/billing',
    });
  }

  private async notifyMovedToBasic(userId: string) {
    const [pro, basic] = await Promise.all([
      this.plans.get('PRO_MONTHLY'),
      this.plans.get('BASIC'),
    ]);
    await this.notifications.notify(userId, 'SUBSCRIPTION_EXPIRED', {
      params: {
        reason: 'period',
        amount: pro.priceMinor,
        currency: pro.currency,
        limit: basic.applicationLimit ?? 0,
      },
      link: '/influencer/billing',
    });
  }

  /** Daily safety net: a period that ended without any webhook is re-read from Paddle. */
  async reconcile() {
    const now = this.clock.now();
    const stale = await this.prisma.subscription.findMany({
      where: {
        paddleSubscriptionId: { not: null },
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        currentPeriodEnd: { lt: new Date(now.getTime() - 3_600_000) },
      },
    });
    for (const s of stale) {
      try {
        await this.apply(s, await this.paddle.getSubscription(s.paddleSubscriptionId!), now);
      } catch (err) {
        this.logger.warn(`Reconcile ${s.id} failed: ${(err as Error).message}`);
      }
    }
    return { checked: stale.length };
  }

  // ─── Sandbox demo tools (admins) ───────────────────────

  async demoSubscriptions() {
    if (!this.demo) throw notFound('Page');
    const rows = await this.prisma.subscription.findMany({
      where: { paddleSubscriptionId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      email: s.user.email,
      status: s.status,
      planCode: s.planCode,
      currentPeriodEnd: s.currentPeriodEnd,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      trialEndsAt: s.trialEndsAt,
      paddleSubscriptionId: s.paddleSubscriptionId,
    }));
  }

  /**
   * Runs Paddle's webhook simulator for one subscription: renewal (paid or failed after all
   * retries) or cancellation. Events reach our webhook like real ones, signed.
   * https://developer.paddle.com/webhooks/simulator
   */
  async simulate(subscriptionId: string, scenario: SimulationScenario, webUrl: string) {
    if (!this.demo) throw notFound('Page');
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub?.paddleSubscriptionId) throw notFound('Paddle subscription');
    const settings = await this.paddle.listNotificationSettings();
    const target = settings.find((n) => n.active && n.destination === `${webUrl}${WEBHOOK_PATH}`);
    if (!target)
      throw new AppError(
        'PROVIDER_ERROR',
        `No active Paddle notification destination for ${webUrl}${WEBHOOK_PATH}`,
      );
    // Simulation events are only delivered to destinations that accept them.
    if (
      target.traffic_source &&
      target.traffic_source !== 'all' &&
      target.traffic_source !== 'simulation'
    )
      await this.paddle.setTrafficSource(target.id, 'all');
    const entities = { subscription_id: sub.paddleSubscriptionId };
    const config =
      scenario === 'cancellation'
        ? { subscription_cancellation: { entities, options: { effective_from: 'immediately' } } }
        : {
            subscription_renewal: {
              entities,
              options:
                scenario === 'renewal_failed'
                  ? { payment_outcome: 'failed', dunning_exhausted_action: 'subscription_canceled' }
                  : { payment_outcome: 'success' },
            },
          };
    const simulation = await this.paddle.createSimulation({
      notification_setting_id: target.id,
      name: `briefluence demo: ${scenario} for ${sub.id}`,
      type: scenario === 'cancellation' ? 'subscription_cancellation' : 'subscription_renewal',
      config,
    });
    const run = await this.paddle.runSimulation(simulation.id);
    return { simulationId: simulation.id, runId: run.id, status: run.status };
  }
}
