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
      return new Response(JSON.stringify({ data: reply(method, url) }), { status: 200 });
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
    await b.agent.post(`${API}/billing/plan`).send({ plan: 'PRO_MONTHLY' }).expect(200);
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

  it('demo mode: 1 hour of free Pro; checkout returns the Paddle.js settings with the demo price', async () => {
    const b = await blogger();
    const sub = await ctx.prisma.subscription.findUniqueOrThrow({ where: { id: b.subId } });
    expect(sub.trialEndsAt.getTime() - sub.createdAt.getTime()).toBeLessThanOrEqual(
      60 * 60 * 1000 + 5000,
    );
    const state = (await b.agent.get(`${API}/billing/subscription`).expect(200)).body;
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
      priceId: PRICE.demo,
      customerEmail: b.email,
      customData: { bf_subscription_id: b.subId },
    });
    const yearly = await b.agent
      .post(`${API}/billing/checkout`)
      .send({ plan: 'PRO_YEARLY' })
      .expect(200);
    expect(yearly.body.paddle.priceId).toBe(PRICE.yearly);
  });

  it('webhooks: bad signature refused; a paid checkout makes the blogger Pro once', async () => {
    const b = await blogger();
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
      planCode: 'PRO_MONTHLY',
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
    expect(view).toMatchObject({ tier: 'PRO', renewal: 'renews' });
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
});
