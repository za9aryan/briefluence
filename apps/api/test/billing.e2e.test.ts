import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  brandProfile,
  connectMock,
  createAdmin,
  createTestApp,
  dealInput,
  influencerProfile,
  lastEmailTo,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

const DAY = 86_400_000;

describe('plans, subscription & payments (e2e)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.clock.reset();
  });

  /** A blogger on Basic; `freeMonth` also activates the free month of Pro. */
  async function onboarded({ freeMonth = false } = {}) {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    if (freeMonth) await inf.agent.post(`${API}/billing/free-pro`).expect(200);
    const admin = await createAdmin(ctx);
    return { ...inf, admin };
  }

  async function pay(
    agent: Awaited<ReturnType<typeof onboarded>>['agent'],
    card: string,
    plan = 'PRO_MONTHLY',
  ) {
    const checkout = await agent.post(`${API}/billing/checkout`).send({ plan }).expect(200);
    const paymentID = new URL(checkout.body.redirectUrl).searchParams.get('paymentID')!;
    const done = await agent
      .post(`${API}/billing/mock/complete`)
      .send({ paymentID, card })
      .expect(200);
    const back = await agent
      .get(new URL(done.body.redirectUrl).pathname + new URL(done.body.redirectUrl).search)
      .expect(302);
    return new URL(back.headers.location as string).searchParams.get('payment');
  }

  const sub = async (agent: Awaited<ReturnType<typeof onboarded>>['agent']) =>
    (await agent.get(`${API}/billing/subscription`).expect(200)).body;

  it('Basic is free right away; the free month is opt-in, once; then Basic with a limit; Pro removes it', async () => {
    const inf = await onboarded();
    const start = await sub(inf.agent);
    expect(start.plans.map((p: { code: string }) => p.code)).toEqual([
      'BASIC',
      'PRO_MONTHLY',
      'PRO_YEARLY',
    ]);
    expect(start.freeProAvailable).toBe(true);
    expect(start.subscription).toMatchObject({
      status: 'ACTIVE',
      planCode: 'BASIC',
      tier: 'BASIC',
      inFreeDays: false,
      freeDaysLost: 0,
    });

    // The blogger activates the free month whenever they want: 30 days of Pro, no card.
    const free = (await inf.agent.post(`${API}/billing/free-pro`).expect(200)).body;
    expect(free.freeProAvailable).toBe(false);
    expect(free.subscription).toMatchObject({
      status: 'TRIALING',
      tier: 'PRO',
      inFreeDays: true,
      trialDaysLeft: 30,
      hasCard: false,
      nextChargeAt: null,
      applications: { limit: null, left: null },
    });
    await inf.agent.post(`${API}/billing/free-pro`).expect(409);

    // Admin sets Basic to 2 applications per 30 days.
    await inf.admin.agent
      .patch(`${API}/admin/plans/BASIC`)
      .send({ priceMinor: 0, currency: 'USD', applicationLimit: 2, isActive: true })
      .expect(200);

    ctx.clock.advance(27.5 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect((await lastEmailTo(ctx, inf.email))?.subject).toMatch(
      /Your free Pro days end in 3 days/,
    );
    ctx.clock.advance(3 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Your free Pro days have ended');
    const basic = await sub(inf.agent);
    expect(basic.subscription).toMatchObject({
      status: 'ACTIVE',
      planCode: 'BASIC',
      tier: 'BASIC',
      applications: { used: 0, limit: 2, left: 2 },
    });
    // Used once: it can't be activated again.
    expect(basic.freeProAvailable).toBe(false);
    await inf.agent.post(`${API}/billing/free-pro`).expect(409);

    // Apply to briefs: two go through, the third hits the Basic limit.
    await connectMock(ctx, inf.agent, 'instagram');
    await ctx.prisma.influencerProfile.updateMany({ data: { status: 'APPROVED' } });
    await ctx.prisma.socialAccount.updateMany({ data: { reviewStatus: 'APPROVED' } });
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deadline = new Date(ctx.clock.now().getTime() + 10 * DAY).toISOString();
    const deals: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = await brand.agent
        .post(`${API}/deals`)
        .send(dealInput({ title: `Brief number ${i + 1}`, applicationDeadline: deadline }))
        .expect(201);
      await brand.agent.post(`${API}/deals/${d.body.id}/publish`).expect(200);
      await inf.admin.agent.post(`${API}/admin/deals/${d.body.id}/approve`).expect(204);
      deals.push(d.body.id);
    }
    const apply = (id: string) =>
      inf.agent
        .post(`${API}/deals/${id}/applications`)
        .send({ pitch: 'I would love to do this collab.' });
    await apply(deals[0]!).expect(201);
    await apply(deals[1]!).expect(201);
    const blocked = await apply(deals[2]!).expect(402);
    expect(blocked.body.error).toMatchObject({
      code: 'APPLICATION_LIMIT_REACHED',
      details: { limit: 2, used: 2 },
    });
    expect((await sub(inf.agent)).subscription.applications).toEqual({
      used: 2,
      limit: 2,
      left: 0,
    });

    // Upgrading to Pro removes the limit right away.
    expect(await pay(inf.agent, 'success')).toBe('success');
    expect((await sub(inf.agent)).subscription).toMatchObject({
      planCode: 'PRO_MONTHLY',
      tier: 'PRO',
      applications: { left: null },
    });
    await apply(deals[2]!).expect(201);
  });

  it('paying during the free month ends it: the paid month starts today; renewals use the current price', async () => {
    const inf = await onboarded({ freeMonth: true });
    ctx.clock.advance(DAY);
    // Shown before checkout: these free days are given up by paying now.
    expect((await sub(inf.agent)).subscription.freeDaysLost).toBe(29);
    expect(await pay(inf.agent, 'success')).toBe('success');
    const paid = (await sub(inf.agent)).subscription;
    expect(paid).toMatchObject({
      status: 'ACTIVE',
      planCode: 'PRO_MONTHLY',
      tier: 'PRO',
      hasCard: true,
      cardMask: '4111********1111',
      canCheckout: false,
      inFreeDays: false,
      trialDaysLeft: 0,
    });
    const days = (new Date(paid.currentPeriodEnd).getTime() - ctx.clock.now().getTime()) / DAY;
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    // In-app only: Paddle emails its own receipt.
    const notes = await inf.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items.map((n: { type: string }) => n.type)).toContain('PAYMENT_SUCCEEDED');
    expect((await lastEmailTo(ctx, inf.email))?.subject).not.toBe('Payment received');

    // Admin raises the price; the next renewal charges the new price.
    await inf.admin.agent
      .patch(`${API}/admin/plans/PRO_MONTHLY`)
      .send({ priceMinor: 1299, currency: 'USD', applicationLimit: null, isActive: true })
      .expect(200);
    ctx.clock.advance(new Date(paid.currentPeriodEnd).getTime() - ctx.clock.now().getTime() + 1000);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    await ctx.queue.drain();
    const payments = (await inf.agent.get(`${API}/billing/payments`).expect(200)).body;
    expect(
      payments.map(
        (p: { kind: string; status: string; amount: number; planCode: string }) =>
          `${p.kind}:${p.status}:${p.amount}:${p.planCode}`,
      ),
    ).toEqual(['renewal:SUCCEEDED:1299:PRO_MONTHLY', 'checkout:SUCCEEDED:999:PRO_MONTHLY']);
  });

  it('Pro yearly costs the yearly price and runs 12 months', async () => {
    const inf = await onboarded();
    ctx.clock.advance(31 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect(await pay(inf.agent, 'success', 'PRO_YEARLY')).toBe('success');
    const s = (await sub(inf.agent)).subscription;
    expect(s.planCode).toBe('PRO_YEARLY');
    const months = (new Date(s.currentPeriodEnd).getTime() - ctx.clock.now().getTime()) / DAY;
    expect(months).toBeGreaterThan(360);
    const payments = (await inf.agent.get(`${API}/billing/payments`).expect(200)).body;
    expect(payments[0]).toMatchObject({ amount: 9999, planCode: 'PRO_YEARLY' });
  });

  it('declined renewal retries on days 1, 3, 5, then the blogger is on Basic', async () => {
    const inf = await onboarded();
    ctx.clock.advance(31 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect(await pay(inf.agent, 'renewal_decline')).toBe('success');
    const due = (await ctx.prisma.subscription.findFirstOrThrow()).currentPeriodEnd!.getTime();
    const runAt = async (dayOffset: number) => {
      ctx.clock.reset();
      ctx.clock.advance(due - Date.now() + dayOffset * DAY + 60_000);
      await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
      await ctx.queue.drain();
      return ctx.prisma.subscription.findFirstOrThrow();
    };
    expect((await runAt(0)).status).toBe('PAST_DUE');
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Payment failed');
    expect((await runAt(1)).failedAttempts).toBe(2);
    expect((await runAt(2)).failedAttempts).toBe(2); // not a retry day
    expect((await runAt(3)).failedAttempts).toBe(3);
    expect(await runAt(5)).toMatchObject({ status: 'ACTIVE', planCode: 'BASIC' });
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Your Pro plan has ended');
  });

  it('declined checkout keeps the free days; cancel and card removal work', async () => {
    const inf = await onboarded({ freeMonth: true });
    expect(await pay(inf.agent, 'decline')).toBe('failed');
    expect((await sub(inf.agent)).subscription).toMatchObject({
      status: 'TRIALING',
      planCode: 'BASIC',
      tier: 'PRO',
      trialDaysLeft: 30,
    });

    expect(await pay(inf.agent, 'success')).toBe('success');
    const canceled = await inf.agent.post(`${API}/billing/cancel`).expect(200);
    expect(canceled.body.subscription).toMatchObject({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      nextChargeAt: null,
      tier: 'PRO',
    });
    await inf.agent.post(`${API}/billing/resume`).expect(200);
    const removed = await inf.agent.delete(`${API}/billing/card`).expect(200);
    expect(removed.body.subscription).toMatchObject({ hasCard: false, cancelAtPeriodEnd: true });
    // Card gone: renewing (also into yearly) is allowed and starts when the paid month ends.
    expect(await pay(inf.agent, 'success', 'PRO_YEARLY')).toBe('success');
    expect((await sub(inf.agent)).subscription).toMatchObject({
      planCode: 'PRO_YEARLY',
      renewal: 'renews',
    });
  });

  it('card removed: renewal is off; Renew Pro pays the next period and turns renewal back on', async () => {
    const inf = await onboarded();
    ctx.clock.advance(31 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect(await pay(inf.agent, 'success')).toBe('success');
    const paid = (await sub(inf.agent)).subscription;
    expect(paid).toMatchObject({ renewal: 'renews', needsCardToRenew: false, canCheckout: false });

    const removed = (await inf.agent.delete(`${API}/billing/card`).expect(200)).body.subscription;
    expect(removed).toMatchObject({
      renewal: 'ends',
      needsCardToRenew: true,
      canCheckout: true,
      hasCard: false,
    });
    expect(await pay(inf.agent, 'success')).toBe('success');
    const renewed = (await sub(inf.agent)).subscription;
    expect(renewed).toMatchObject({ renewal: 'renews', hasCard: true, cancelAtPeriodEnd: false });
    expect(new Date(renewed.currentPeriodEnd).getTime()).toBeGreaterThan(
      new Date(paid.currentPeriodEnd).getTime() + 27 * DAY,
    );
  });

  it('switches Pro monthly to yearly at the next renewal and charges the yearly price then', async () => {
    const inf = await onboarded();
    ctx.clock.advance(31 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect(await pay(inf.agent, 'success')).toBe('success');
    const monthly = (await sub(inf.agent)).subscription;
    const switched = (
      await inf.agent.post(`${API}/billing/switch`).send({ plan: 'PRO_YEARLY' }).expect(200)
    ).body.subscription;
    expect(switched).toMatchObject({
      planCode: 'PRO_MONTHLY',
      nextPlan: { code: 'PRO_YEARLY', priceMinor: 9999 },
      renewal: 'renews',
    });
    await inf.agent.post(`${API}/billing/switch`).send({ plan: 'BASIC' }).expect(400);

    ctx.clock.advance(
      new Date(monthly.currentPeriodEnd).getTime() - ctx.clock.now().getTime() + 1000,
    );
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    await ctx.queue.drain();
    const yearly = (await sub(inf.agent)).subscription;
    expect(yearly).toMatchObject({ planCode: 'PRO_YEARLY', nextPlan: null, renewal: 'renews' });
    expect(
      (new Date(yearly.currentPeriodEnd).getTime() - new Date(monthly.currentPeriodEnd).getTime()) /
        DAY,
    ).toBeGreaterThan(360);
    const payments = (await inf.agent.get(`${API}/billing/payments`).expect(200)).body;
    expect(payments[0]).toMatchObject({
      kind: 'renewal',
      amount: 9999,
      planCode: 'PRO_YEARLY',
      status: 'SUCCEEDED',
    });

    // Removing the card drops a pending switch; without a card switching is not possible (renew instead).
    await inf.agent.post(`${API}/billing/switch`).send({ plan: 'PRO_MONTHLY' }).expect(200);
    expect((await sub(inf.agent)).subscription.nextPlan).toMatchObject({ code: 'PRO_MONTHLY' });
    const noCard = (await inf.agent.delete(`${API}/billing/card`).expect(200)).body.subscription;
    expect(noCard.nextPlan).toBeNull();
    await inf.agent.post(`${API}/billing/switch`).send({ plan: 'PRO_MONTHLY' }).expect(409);
  });

  it('Pro can be bought without choosing Basic first; Pro is never picked without paying', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'PRO_MONTHLY' }).expect(409);
    expect(await pay(inf.agent, 'success', 'PRO_YEARLY')).toBe('success');
    const s = await sub(inf.agent);
    expect(s.subscription).toMatchObject({
      planCode: 'PRO_YEARLY',
      tier: 'PRO',
      renewal: 'renews',
    });
    // Paid Pro is running: the free month waits until it's over.
    expect(s.freeProAvailable).toBe(false);
    await inf.agent.post(`${API}/billing/free-pro`).expect(409);
    // Coupons are Paddle discounts: not available with the test payment page.
    expect(s.coupons).toBe(false);
  });

  it('admins manage plans; Basic stays free and on; turned-off plans cannot be chosen', async () => {
    const inf = await onboarded();
    const plans = (await inf.admin.agent.get(`${API}/admin/plans`).expect(200)).body;
    expect(
      plans.map((p: { code: string; priceMinor: number }) => `${p.code}:${p.priceMinor}`),
    ).toEqual(['BASIC:0', 'PRO_MONTHLY:999', 'PRO_YEARLY:9999']);
    await inf.agent.get(`${API}/admin/plans`).expect(403);
    await inf.admin.agent
      .patch(`${API}/admin/plans/BASIC`)
      .send({ priceMinor: 0, currency: 'USD', applicationLimit: 10, isActive: false })
      .expect(400);
    await inf.admin.agent
      .patch(`${API}/admin/plans/BASIC`)
      .send({ priceMinor: 500, currency: 'USD', applicationLimit: 10, isActive: true })
      .expect(400);
    await inf.admin.agent
      .patch(`${API}/admin/plans/NOPE`)
      .send({ priceMinor: 1, currency: 'USD', applicationLimit: null, isActive: true })
      .expect(404);

    await inf.admin.agent
      .patch(`${API}/admin/plans/PRO_YEARLY`)
      .send({ priceMinor: 9999, currency: 'USD', applicationLimit: null, isActive: false })
      .expect(200);
    expect((await sub(inf.agent)).plans.map((p: { code: string }) => p.code)).toEqual([
      'BASIC',
      'PRO_MONTHLY',
    ]);
    await inf.agent.post(`${API}/billing/checkout`).send({ plan: 'PRO_YEARLY' }).expect(400);
    await inf.agent.post(`${API}/billing/checkout`).send({ plan: 'BASIC' }).expect(400);
  });
});
