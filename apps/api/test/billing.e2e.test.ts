import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, createAdmin, createTestApp, influencerProfile, lastEmailTo, resetDb, signup, type TestCtx } from './helpers';

const DAY = 86_400_000;

describe('subscription & payments (e2e)', () => {
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

  async function onboarded() {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/trial`).expect(200);
    const admin = await createAdmin(ctx);
    return { ...inf, admin };
  }

  async function pay(agent: Awaited<ReturnType<typeof onboarded>>['agent'], card: string) {
    const checkout = await agent.post(`${API}/billing/checkout`).expect(200);
    const paymentID = new URL(checkout.body.redirectUrl).searchParams.get('paymentID')!;
    const done = await agent.post(`${API}/billing/mock/complete`).send({ paymentID, card }).expect(200);
    const back = await agent.get(new URL(done.body.redirectUrl).pathname + new URL(done.body.redirectUrl).search).expect(302);
    return new URL(back.headers.location as string).searchParams.get('payment');
  }

  it('trial reminder → trial ends → paywall → pay → renew with saved card', async () => {
    const inf = await onboarded();
    ctx.clock.advance(27.5 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    expect((await lastEmailTo(ctx, inf.email))?.subject).toMatch(/Your free month ends in 3 days/);

    ctx.clock.advance(3 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    const sub = await inf.agent.get(`${API}/billing/subscription`).expect(200);
    expect(sub.body.subscription).toMatchObject({ status: 'EXPIRED', hasAccess: false, canCheckout: true });

    // Paywall: applying needs an active subscription (checked before eligibility).
    await ctx.prisma.influencerProfile.updateMany({ data: { status: 'APPROVED' } });
    const blocked = await inf.agent.post(`${API}/deals/any/applications`).send({ socialAccountId: 'x', pitch: 'Let me apply please' }).expect(402);
    expect(blocked.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
    await inf.agent.get(`${API}/deals/feed`).expect(200); // feed stays visible

    expect(await pay(inf.agent, 'success')).toBe('success');
    const active = await inf.agent.get(`${API}/billing/subscription`).expect(200);
    expect(active.body.subscription).toMatchObject({ status: 'ACTIVE', hasCard: true, cardMask: '4111********1111' });
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Payment received');
    const periodEnd = new Date(active.body.subscription.currentPeriodEnd);

    // Reloading the bank return URL must not double-apply the payment.
    const payments1 = await inf.agent.get(`${API}/billing/payments`).expect(200);
    expect(payments1.body).toHaveLength(1);

    ctx.clock.advance(periodEnd.getTime() - ctx.clock.now().getTime() + 1000);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    await ctx.queue.drain();
    const renewed = await inf.agent.get(`${API}/billing/subscription`).expect(200);
    expect(new Date(renewed.body.subscription.currentPeriodEnd).getTime()).toBeGreaterThan(periodEnd.getTime());
    const payments2 = await inf.agent.get(`${API}/billing/payments`).expect(200);
    expect(payments2.body.map((p: { kind: string; status: string }) => `${p.kind}:${p.status}`)).toEqual([
      'renewal:SUCCEEDED',
      'checkout:SUCCEEDED',
    ]);
  });

  it('declined renewal retries on days 1, 3, 5 then expires', async () => {
    const inf = await onboarded();
    expect(await pay(inf.agent, 'renewal_decline')).toBe('success');
    const sub = await ctx.prisma.subscription.findFirstOrThrow();
    const due = sub.currentPeriodEnd!.getTime();
    const runAt = async (dayOffset: number) => {
      ctx.clock.reset();
      ctx.clock.advance(due - Date.now() + dayOffset * DAY + 60_000);
      await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
      await ctx.queue.drain();
      return ctx.prisma.subscription.findFirstOrThrow();
    };
    const first = await runAt(0);
    expect(first.status).toBe('PAST_DUE');
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Payment failed');
    const second = await runAt(1);
    expect(second.failedAttempts).toBe(2);
    expect((await runAt(2)).failedAttempts).toBe(2); // not a retry day
    expect((await runAt(3)).failedAttempts).toBe(3);
    const last = await runAt(5);
    expect(last.status).toBe('EXPIRED');
    expect((await lastEmailTo(ctx, inf.email))?.subject).toBe('Your subscription has ended');
  });

  it('declined checkout keeps the trial; cancel and card removal work', async () => {
    const inf = await onboarded();
    expect(await pay(inf.agent, 'decline')).toBe('failed');
    expect((await inf.agent.get(`${API}/billing/subscription`)).body.subscription.status).toBe('TRIALING');
    expect(await pay(inf.agent, 'success')).toBe('success');
    const canceled = await inf.agent.post(`${API}/billing/cancel`).expect(200);
    expect(canceled.body.subscription).toMatchObject({ status: 'ACTIVE', cancelAtPeriodEnd: true, nextChargeAt: null });
    await inf.agent.post(`${API}/billing/resume`).expect(200);
    const removed = await inf.agent.delete(`${API}/billing/card`).expect(200);
    expect(removed.body.subscription).toMatchObject({ hasCard: false, cancelAtPeriodEnd: true });
    const again = await inf.agent.post(`${API}/billing/checkout`).expect(409); // still active until period end
    expect(again.body.error.code).toBe('CONFLICT');
  });
});
