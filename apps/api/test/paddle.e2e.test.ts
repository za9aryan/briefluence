import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API,
  createAdmin,
  createTestApp,
  influencerProfile,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

const SECRET = 'pdl_ntfset_test_secret';
const PRICE = {
  demo: 'pri_demo00000000000000000000000',
  monthly: 'pri_month0000000000000000000000',
  yearly: 'pri_year00000000000000000000000',
};
const PADDLE_ENV = {
  PAYMENT_PROVIDER: 'paddle',
  PADDLE_ENV: 'sandbox',
  PADDLE_SANDBOX_API_KEY: 'pdl_sdbx_apikey_test',
  PADDLE_SANDBOX_CLIENT_TOKEN: 'test_client_token',
  PADDLE_SANDBOX_WEBHOOK_SECRET: SECRET,
  PADDLE_SANDBOX_PRICE_DEMO: PRICE.demo,
  PADDLE_SANDBOX_PRICE_MONTHLY: PRICE.monthly,
  PADDLE_SANDBOX_PRICE_YEARLY: PRICE.yearly,
};

/** A Paddle event signed like Paddle does: HMAC-SHA256 of `${ts}:${body}`. */
function signed(event: Record<string, unknown>, secret = SECRET) {
  const body = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return { body, header: `ts=${ts};h1=${h1}` };
}

/** What Paddle returns for each price (GET /prices/{id}). */
const PRICES: Record<string, unknown> = {
  [PRICE.demo]: {
    id: PRICE.demo,
    name: 'Pro demo',
    description: 'Demo 1 day',
    status: 'active',
    billing_cycle: { interval: 'day', frequency: 1 },
    unit_price: { amount: '100', currency_code: 'USD' },
  },
  [PRICE.monthly]: {
    id: PRICE.monthly,
    name: 'Pro monthly',
    description: 'Monthly Plan',
    status: 'active',
    billing_cycle: { interval: 'month', frequency: 1 },
    unit_price: { amount: '1499', currency_code: 'USD' },
  },
  [PRICE.yearly]: {
    id: PRICE.yearly,
    name: 'Pro yearly',
    description: 'Yearly Plan',
    status: 'active',
    billing_cycle: { interval: 'year', frequency: 1 },
    unit_price: { amount: '9999', currency_code: 'USD' },
  },
};

const subscription = (over: Record<string, unknown> = {}) => ({
  id: 'sub_01test000000000000000000000',
  status: 'active',
  customer_id: 'ctm_01test',
  custom_data: null,
  current_billing_period: { starts_at: '2026-11-03T12:00:00Z', ends_at: '2026-11-04T12:00:00Z' },
  scheduled_change: null,
  items: [{ price: { id: PRICE.demo } }],
  ...over,
});

describe('Paddle billing (e2e)', () => {
  let ctx: TestCtx;
  const saved: Record<string, string | undefined> = {};
  const calls: { method: string; url: string; body: unknown }[] = [];
  let reply: (method: string, url: string) => unknown = () => ({});

  beforeAll(async () => {
    for (const [k, v] of Object.entries(PADDLE_ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    ctx = await createTestApp();
    // Paddle's API, faked: record each request and answer with `{ data }`.
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.startsWith('https://sandbox-api.paddle.com')) return realFetch(input, init);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const price = method === 'GET' && url.match(/\/prices\/(pri_\w+)$/)?.[1];
      const data = price ? PRICES[price] : reply(method, url);
      return new Response(JSON.stringify({ data }), { status: 200 });
    });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await ctx.app.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    calls.length = 0;
  });

  async function blogger() {
    const b = await signup(ctx, 'INFLUENCER');
    await b.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await b.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    const sub = await ctx.prisma.subscription.findUniqueOrThrow({ where: { userId: b.id } });
    return { ...b, subId: sub.id };
  }
  const post = (event: Record<string, unknown>, secret?: string) => {
    const { body, header } = signed(event, secret);
    return ctx
      .http()
      .post(`${API}/billing/paddle/webhook`)
      .set('Content-Type', 'application/json')
      .set('Paddle-Signature', header)
      .send(body);
  };

  it('plans come from Paddle: prices, the daily test plan, Pro picked only through checkout', async () => {
    const b = await signup(ctx, 'INFLUENCER');
    await b.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    const state = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body;
    expect(state.freeProHours).toBe(1);
    expect(
      state.plans.map((p: { code: string; priceMinor: number }) => [p.code, p.priceMinor]),
    ).toEqual([
      ['BASIC', 0],
      ['PRO_DAILY', 100],
      ['PRO_MONTHLY', 1499],
      ['PRO_YEARLY', 9999],
    ]);
    // Picking Pro starts nothing; checkout works without a plan and still creates nothing.
    await b.agent.post(`${API}/billing/plan`).send({ plan: 'PRO_MONTHLY' }).expect(409);
    const res = await b.agent
      .post(`${API}/billing/checkout`)
      .send({ plan: 'PRO_DAILY' })
      .expect(200);
    expect(res.body.paddle).toEqual({
      priceId: PRICE.demo,
      customerEmail: b.email,
      customData: { bf_user_id: b.id },
    });
    expect(await ctx.prisma.subscription.count({ where: { userId: b.id } })).toBe(0);

    // Paddle confirms the payment: the subscription is created and Pro is on.
    await post({
      event_id: 'evt_first',
      event_type: 'transaction.completed',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'txn_01first',
        status: 'completed',
        origin: 'web',
        subscription_id: 'sub_01first',
        customer_id: 'ctm_01first',
        custom_data: { bf_user_id: b.id },
        currency_code: 'USD',
        billing_period: { starts_at: new Date().toISOString(), ends_at: '2099-01-01T00:00:00Z' },
        items: [{ price: { id: PRICE.demo } }],
        details: { totals: { grand_total: '100' } },
        payments: [],
      },
    }).expect(200);
    const view = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body.subscription;
    expect(view).toMatchObject({ tier: 'PRO', planCode: 'PRO_DAILY', status: 'ACTIVE' });
    expect(view.plan).toMatchObject({ code: 'PRO_DAILY', priceMinor: 100 });
  });

  it('admins edit Basic only; Pro plans show Paddle data', async () => {
    const admin = await createAdmin(ctx);
    const plans = (await admin.agent.get(`${API}/admin/plans`).expect(200)).body;
    expect(plans.find((p: { code: string }) => p.code === 'PRO_YEARLY')).toMatchObject({
      source: 'paddle',
      priceMinor: 9999,
      paddle: { priceId: PRICE.yearly, interval: 'year' },
    });
    const pro = { priceMinor: 500, currency: 'USD', applicationLimit: null, isActive: true };
    await admin.agent.patch(`${API}/admin/plans/PRO_MONTHLY`).send(pro).expect(409);
    const basic = {
      priceMinor: 0,
      currency: 'USD',
      applicationLimit: 7,
      offerLimit: 2,
      isActive: true,
    };
    await admin.agent.patch(`${API}/admin/plans/BASIC`).send(basic).expect(200);
    expect(
      (await ctx.prisma.plan.findUniqueOrThrow({ where: { code: 'BASIC' } })).applicationLimit,
    ).toBe(7);
  });

  it('demo mode: the free month is 1 hour; checkout returns the Paddle.js settings', async () => {
    const b = await blogger();
    const basic = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body;
    expect(basic.subscription).toMatchObject({ tier: 'BASIC', planCode: 'BASIC' });
    expect(basic).toMatchObject({ freeProAvailable: true, coupons: true });
    await b.agent.post(`${API}/billing/free-pro`).expect(200);
    const sub = await ctx.prisma.subscription.findUniqueOrThrow({ where: { id: b.subId } });
    expect(sub.trialEndsAt.getTime() - sub.freeProActivatedAt!.getTime()).toBe(60 * 60 * 1000);
    const state = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body;
    expect(state.subscription).toMatchObject({
      tier: 'PRO',
      inFreeDays: true,
      planCode: 'BASIC',
      freeDaysLost: 1,
    });
    expect(state.paddle).toEqual({
      environment: 'sandbox',
      clientToken: 'test_client_token',
      demo: true,
    });
    const res = await b.agent
      .post(`${API}/billing/checkout`)
      .send({ plan: 'PRO_MONTHLY' })
      .expect(200);
    expect(res.body.paddle).toMatchObject({
      priceId: PRICE.monthly,
      customerEmail: b.email,
      customData: { bf_user_id: b.id, bf_subscription_id: b.subId },
    });
    const yearly = await b.agent
      .post(`${API}/billing/checkout`)
      .send({ plan: 'PRO_YEARLY' })
      .expect(200);
    expect(yearly.body.paddle.priceId).toBe(PRICE.yearly);
  });

  it('webhooks: bad signature refused; a paid checkout makes the blogger Pro once and ends the free month', async () => {
    const b = await blogger();
    await b.agent.post(`${API}/billing/free-pro`).expect(200);
    const event = {
      event_id: 'evt_01checkout',
      event_type: 'transaction.completed',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'txn_01checkout',
        status: 'completed',
        origin: 'web',
        subscription_id: 'sub_01test000000000000000000000',
        customer_id: 'ctm_01test',
        custom_data: { bf_subscription_id: b.subId },
        currency_code: 'USD',
        billing_period: { starts_at: '2026-11-03T12:00:00Z', ends_at: '2099-11-04T12:00:00Z' },
        items: [{ price: { id: PRICE.demo } }],
        details: { totals: { grand_total: '100' } },
        payments: [{ method_details: { card: { last4: '4242' } } }],
      },
    };
    await post(event, 'wrong_secret').expect(401);
    await post(event).expect(200);
    await post(event).expect(200); // Paddle retried: nothing applied twice

    const sub = await ctx.prisma.subscription.findUniqueOrThrow({ where: { id: b.subId } });
    expect(sub).toMatchObject({
      status: 'ACTIVE',
      planCode: 'PRO_DAILY',
      paddleSubscriptionId: 'sub_01test000000000000000000000',
      cardMask: '•••• 4242',
    });
    const payments = await ctx.prisma.payment.findMany({ where: { subscriptionId: b.subId } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      provider: 'paddle',
      amount: 100,
      currency: 'USD',
      status: 'SUCCEEDED',
      kind: 'checkout',
    });
    expect(
      await ctx.prisma.notification.count({ where: { userId: b.id, type: 'PAYMENT_SUCCEEDED' } }),
    ).toBe(1);
    const view = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body.subscription;
    expect(view).toMatchObject({ tier: 'PRO', renewal: 'renews', inFreeDays: false });
  });

  it('subscription events: scheduled cancel, old events ignored, canceled → Basic', async () => {
    const b = await blogger();
    const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
    const ev = (id: string, type: string, min: number, data: Record<string, unknown>) => ({
      event_id: id,
      event_type: type,
      occurred_at: at(min),
      data,
    });
    await post(
      ev(
        'evt_1',
        'subscription.created',
        0,
        subscription({
          custom_data: { bf_subscription_id: b.subId },
          current_billing_period: { starts_at: at(0), ends_at: at(60 * 24) },
        }),
      ),
    ).expect(200);
    await post(
      ev(
        'evt_3',
        'subscription.updated',
        2,
        subscription({
          current_billing_period: { starts_at: at(0), ends_at: at(60 * 24) },
          scheduled_change: { action: 'cancel', effective_at: at(60 * 24) },
        }),
      ),
    ).expect(200);
    // An older event arriving late must not undo the cancel.
    await post(
      ev(
        'evt_2',
        'subscription.updated',
        1,
        subscription({ current_billing_period: { starts_at: at(0), ends_at: at(60 * 24) } }),
      ),
    ).expect(200);
    let view = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body.subscription;
    expect(view).toMatchObject({ tier: 'PRO', renewal: 'ends' });

    await post(
      ev(
        'evt_4',
        'subscription.canceled',
        3,
        subscription({ status: 'canceled', current_billing_period: null }),
      ),
    ).expect(200);
    view = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body.subscription;
    expect(view).toMatchObject({ tier: 'BASIC', planCode: 'BASIC' });
    expect(
      await ctx.prisma.notification.count({
        where: { userId: b.id, type: 'SUBSCRIPTION_EXPIRED' },
      }),
    ).toBe(1);
  });

  it('cancel, renew and switch go through the Paddle API', async () => {
    const b = await blogger();
    await post({
      event_id: 'evt_a',
      event_type: 'subscription.activated',
      occurred_at: new Date().toISOString(),
      data: subscription({
        custom_data: { bf_subscription_id: b.subId },
        current_billing_period: {
          starts_at: new Date().toISOString(),
          ends_at: '2099-01-01T00:00:00Z',
        },
      }),
    }).expect(200);

    reply = () =>
      subscription({
        current_billing_period: {
          starts_at: '2026-11-03T12:00:00Z',
          ends_at: '2099-01-01T00:00:00Z',
        },
        scheduled_change: { action: 'cancel', effective_at: '2099-01-01T00:00:00Z' },
      });
    await b.agent.post(`${API}/billing/cancel`).expect(200);
    expect(calls.at(-1)).toMatchObject({
      method: 'POST',
      url: 'https://sandbox-api.paddle.com/subscriptions/sub_01test000000000000000000000/cancel',
      body: { effective_from: 'next_billing_period' },
    });
    expect((await b.agent.get(`${API}/billing/subscription`)).body.subscription.renewal).toBe(
      'ends',
    );

    reply = () =>
      subscription({
        current_billing_period: {
          starts_at: '2026-11-03T12:00:00Z',
          ends_at: '2099-01-01T00:00:00Z',
        },
      });
    await b.agent.post(`${API}/billing/resume`).expect(200);
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { scheduled_change: null } });

    reply = () =>
      subscription({
        items: [{ price: { id: PRICE.yearly } }],
        current_billing_period: {
          starts_at: '2026-11-03T12:00:00Z',
          ends_at: '2099-01-01T00:00:00Z',
        },
      });
    const switched = await b.agent
      .post(`${API}/billing/switch`)
      .send({ plan: 'PRO_YEARLY' })
      .expect(200);
    expect(calls.at(-1)).toMatchObject({
      method: 'PATCH',
      body: {
        items: [{ price_id: PRICE.yearly, quantity: 1 }],
        proration_billing_mode: 'full_next_billing_period',
      },
    });
    expect(switched.body.subscription.planCode).toBe('PRO_YEARLY');

    reply = () => ({ id: 'txn_01updatecard' });
    const pm = await b.agent.post(`${API}/billing/payment-method`).expect(200);
    expect(pm.body).toEqual({ transactionId: 'txn_01updatecard' });
    await b.agent.delete(`${API}/billing/card`).expect(409);
  });

  it('admins can simulate a renewal for a linked subscription (sandbox only)', async () => {
    const b = await blogger();
    await post({
      event_id: 'evt_s',
      event_type: 'subscription.created',
      occurred_at: new Date().toISOString(),
      data: subscription({ custom_data: { bf_subscription_id: b.subId } }),
    }).expect(200);
    const admin = await createAdmin(ctx);
    await b.agent.get(`${API}/billing/paddle/demo/subscriptions`).expect(403);
    const list = (await admin.agent.get(`${API}/billing/paddle/demo/subscriptions`).expect(200))
      .body;
    expect(list).toHaveLength(1);

    const webhook = `${process.env.WEB_URL ?? 'http://localhost:3000'}/api/v1/billing/paddle/webhook`;
    reply = (method, url) =>
      url.endsWith('/notification-settings') && method === 'GET'
        ? [{ id: 'ntfset_01test', destination: webhook, active: true, traffic_source: 'platform' }]
        : url.endsWith('/runs')
          ? { id: 'ntfsimrun_01', status: 'pending' }
          : { id: 'ntfsim_01' };
    const res = await admin.agent
      .post(`${API}/billing/paddle/demo/simulate`)
      .send({ subscriptionId: b.subId, scenario: 'renewal_failed' })
      .expect(200);
    expect(res.body).toMatchObject({ simulationId: 'ntfsim_01', runId: 'ntfsimrun_01' });
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
      body: { traffic_source: 'all' },
    });
    expect(calls.find((c) => c.url.endsWith('/simulations'))?.body).toMatchObject({
      notification_setting_id: 'ntfset_01test',
      type: 'subscription_renewal',
      config: {
        subscription_renewal: {
          entities: { subscription_id: 'sub_01test000000000000000000000' },
          options: { payment_outcome: 'failed', dunning_exhausted_action: 'subscription_canceled' },
        },
      },
    });
  });

  describe('coupons', () => {
    const DISCOUNT = 'dsc_01coupon00000000000000000';
    const txn = (
      id: string,
      userId: string,
      over: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      event_id: `evt_${id}`,
      event_type: 'transaction.completed',
      occurred_at: new Date().toISOString(),
      data: {
        id,
        status: 'completed',
        origin: 'web',
        subscription_id: `sub_${id}`,
        customer_id: `ctm_${id}`,
        custom_data: { bf_user_id: userId },
        currency_code: 'USD',
        billing_period: { starts_at: new Date().toISOString(), ends_at: '2099-01-01T00:00:00Z' },
        discount_id: DISCOUNT,
        items: [{ price: { id: PRICE.monthly } }],
        details: { totals: { grand_total: '0' } },
        payments: [],
        ...over,
      },
    });
    const reason = (res: { body: { error: { code: string; details?: { reason?: string } } } }) =>
      `${res.body.error.code}:${res.body.error.details?.reason ?? ''}`;

    it('admin creates a Paddle discount; bloggers use it once; statistics and on/off', async () => {
      const admin = await createAdmin(ctx);
      let status = 'active';
      reply = (method, url) =>
        url.includes('/discounts')
          ? {
              id: DISCOUNT,
              status: method === 'PATCH' ? (status = 'archived') : status,
              code: 'BLOGGER2026',
              times_used: 2,
              usage_limit: 2,
            }
          : {};
      const input = {
        code: 'blogger2026',
        note: 'Launch',
        percentOff: 100,
        billingPeriods: 3,
        plans: ['PRO_MONTHLY'],
        maxUses: 2,
        expiresAt: null,
      };
      const a = await blogger();
      await a.agent.post(`${API}/admin/coupons`).send(input).expect(403);
      // 100% off forever is refused (free Pro needs a number of periods).
      await admin.agent
        .post(`${API}/admin/coupons`)
        .send({ ...input, billingPeriods: null })
        .expect(400);
      const created = (await admin.agent.post(`${API}/admin/coupons`).send(input).expect(201)).body;
      expect(created).toMatchObject({ code: 'BLOGGER2026', paddleDiscountId: DISCOUNT });
      expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/discounts'))?.body).toEqual({
        description: 'briefluence coupon: Launch',
        enabled_for_checkout: true,
        code: 'BLOGGER2026',
        type: 'percentage',
        amount: '100',
        recur: true,
        maximum_recurring_intervals: 3,
        usage_limit: 2,
        restrict_to: [PRICE.monthly],
        expires_at: null,
        custom_data: { source: 'briefluence-admin' },
      });
      await admin.agent.post(`${API}/admin/coupons`).send(input).expect(409); // same code

      // The blogger checks the code (any case), then pays with it.
      const check = await a.agent
        .post(`${API}/billing/coupon/check`)
        .send({ code: 'Blogger2026' })
        .expect(200);
      expect(check.body).toEqual({
        code: 'BLOGGER2026',
        percentOff: 100,
        billingPeriods: 3,
        plans: ['PRO_MONTHLY'],
      });
      expect(
        reason(
          await a.agent.post(`${API}/billing/coupon/check`).send({ code: 'NOPE123' }).expect(400),
        ),
      ).toBe('COUPON_INVALID:NOT_FOUND');
      expect(
        reason(
          await a.agent
            .post(`${API}/billing/checkout`)
            .send({ plan: 'PRO_YEARLY', coupon: 'BLOGGER2026' })
            .expect(400),
        ),
      ).toBe('COUPON_INVALID:WRONG_PLAN');
      const checkout = await a.agent
        .post(`${API}/billing/checkout`)
        .send({ plan: 'PRO_MONTHLY', coupon: 'blogger2026' })
        .expect(200);
      expect(checkout.body.paddle).toMatchObject({ priceId: PRICE.monthly, discountId: DISCOUNT });

      // Paddle confirms the $0 first month: counted once, even if the webhook repeats.
      await post(txn('txn_a', a.id)).expect(200);
      await post(txn('txn_a', a.id)).expect(200);
      expect(await ctx.prisma.couponRedemption.count()).toBe(1);
      const aSub = (await a.agent.get(`${API}/billing/subscription`).expect(200)).body;
      expect(aSub.subscription).toMatchObject({ tier: 'PRO', planCode: 'PRO_MONTHLY' });
      // One coupon per account (checked here; Paddle's limit is only a total).
      await ctx.prisma.subscription.updateMany({
        where: { userId: a.id },
        data: { status: 'CANCELED', currentPeriodEnd: new Date(Date.now() - 1000) },
      });
      expect(
        reason(
          await a.agent
            .post(`${API}/billing/coupon/check`)
            .send({ code: 'BLOGGER2026' })
            .expect(400),
        ),
      ).toBe('COUPON_INVALID:ALREADY_USED');

      // A second blogger uses the last use; a third finds it used up.
      const b2 = await blogger();
      await post(txn('txn_b', b2.id)).expect(200);
      const c3 = await blogger();
      expect(
        reason(
          await c3.agent
            .post(`${API}/billing/coupon/check`)
            .send({ code: 'BLOGGER2026' })
            .expect(400),
        ),
      ).toBe('COUPON_INVALID:USED_UP');

      // After the free months the second blogger pays: conversion shows in the statistics.
      await post(
        txn('txn_b_renewal', b2.id, {
          origin: 'subscription_recurring',
          subscription_id: 'sub_txn_b',
          discount_id: null,
          details: { totals: { grand_total: '1499' } },
        }),
      ).expect(200);
      const list = (await admin.agent.get(`${API}/admin/coupons`).expect(200)).body;
      expect(list.enabled).toBe(true);
      expect(list.coupons[0]).toMatchObject({
        code: 'BLOGGER2026',
        state: 'USED_UP',
        usesLeft: 0,
        stats: { uses: 2, paying: 1, conversion: 50 },
      });
      const detail = (await admin.agent.get(`${API}/admin/coupons/${created.id}`).expect(200)).body;
      expect(detail.paddleTimesUsed).toBe(2);
      expect(
        detail.redemptions.map((r: { email: string; paidAfter: number[] }) => [
          r.email,
          r.paidAfter,
        ]),
      ).toEqual([
        [b2.email, [0, 1499]],
        [a.email, [0]],
      ]);

      // Off: archived in Paddle, refused here.
      const off = await admin.agent
        .patch(`${API}/admin/coupons/${created.id}`)
        .send({ active: false })
        .expect(200);
      expect(off.body.active).toBe(false);
      expect(
        calls.find((c) => c.method === 'PATCH' && c.url.endsWith(`/discounts/${DISCOUNT}`))?.body,
      ).toEqual({
        status: 'archived',
      });
      expect(
        (await admin.agent.get(`${API}/admin/coupons`).expect(200)).body.coupons[0].state,
      ).toBe('OFF');
    });

    it('a coupon during the free month ends the free days; paid Pro cannot take a coupon', async () => {
      const admin = await createAdmin(ctx);
      reply = () => ({
        id: DISCOUNT,
        status: 'active',
        code: 'HALF',
        times_used: 0,
        usage_limit: null,
      });
      await admin.agent
        .post(`${API}/admin/coupons`)
        .send({
          code: 'HALF',
          percentOff: 50,
          billingPeriods: null,
          plans: ['PRO_MONTHLY', 'PRO_YEARLY'],
          maxUses: null,
          expiresAt: null,
        })
        .expect(201);
      expect(calls.at(-1)?.body).toMatchObject({
        recur: true,
        maximum_recurring_intervals: null,
        usage_limit: null,
        restrict_to: [PRICE.monthly, PRICE.yearly],
      });
      const b = await blogger();
      await b.agent.post(`${API}/billing/free-pro`).expect(200);
      expect(
        (await b.agent.get(`${API}/billing/subscription`)).body.subscription.freeDaysLost,
      ).toBe(1);
      await post(
        txn('txn_half', b.id, {
          custom_data: { bf_user_id: b.id, bf_subscription_id: b.subId },
          details: { totals: { grand_total: '750' } },
        }),
      ).expect(200);
      const view = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body.subscription;
      expect(view).toMatchObject({ tier: 'PRO', inFreeDays: false, renewal: 'renews' });
      const res = await b.agent
        .post(`${API}/billing/coupon/check`)
        .send({ code: 'HALF' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
