import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PushService } from '../src/modules/notifications/push.service';
import { API, createTestApp, resetDb, signup, type TestCtx } from './helpers';

const device = (n: number) => ({
  endpoint: `https://push.example.com/send/device-${n}`,
  keys: { p256dh: 'BPk3fake-p256dh-key-value-for-tests', auth: 'fake-auth-secret' },
});

describe('web push (e2e)', () => {
  let ctx: TestCtx;
  let push: PushService;
  const sent: { endpoint: string; payload: Record<string, string> }[] = [];
  let gone = new Set<string>();

  beforeAll(async () => {
    ctx = await createTestApp();
    push = ctx.app.get(PushService);
    push.forceEnabled = true;
    push.sender = async (sub, payload) => {
      if (gone.has(sub.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) as Record<string, string> });
    };
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    sent.length = 0;
    gone = new Set();
  });

  it('public key endpoint, sign-in required to subscribe', async () => {
    const key = await ctx.http().get(`${API}/push/public-key`).expect(200);
    expect(key.body.enabled).toBe(true);
    await ctx.http().post(`${API}/push/subscriptions`).send(device(1)).expect(401);
    const user = await signup(ctx, 'BRAND');
    await user.agent
      .post(`${API}/push/subscriptions`)
      .send({ ...device(1), endpoint: 'http://insecure.example.com/x' })
      .expect(400);
    await user.agent.post(`${API}/push/subscriptions`).send(device(1)).expect(204);
    expect(await ctx.prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(1);
  });

  it('every new notification goes to all of the user’s devices; gone devices are removed', async () => {
    const user = await signup(ctx, 'INFLUENCER');
    const other = await signup(ctx, 'BRAND');
    await user.agent.post(`${API}/push/subscriptions`).send(device(1)).expect(204);
    await user.agent.post(`${API}/push/subscriptions`).send(device(2)).expect(204);
    await other.agent.post(`${API}/push/subscriptions`).send(device(3)).expect(204);
    gone.add(device(2).endpoint);

    await ctx.app.get(NotificationsService).notify(user.id, 'PORTFOLIO_APPROVED', {
      params: { title: 'Story for a cafe' },
      link: '/influencer/account#portfolio',
    });
    await ctx.queue.drain();

    expect(sent.map((s) => s.endpoint)).toEqual([device(1).endpoint]);
    expect(sent[0]!.payload).toMatchObject({
      title: 'Portfolio item approved',
      url: '/influencer/account#portfolio',
    });
    // The 410 device was forgotten; the other user's device was untouched.
    const left = await ctx.prisma.pushSubscription.findMany({ select: { endpoint: true } });
    expect(left.map((l) => l.endpoint).sort()).toEqual([device(1).endpoint, device(3).endpoint]);
  });

  it('a device moves to whoever subscribes it; users can only remove their own', async () => {
    const a = await signup(ctx, 'BRAND');
    const b = await signup(ctx, 'BRAND');
    await a.agent.post(`${API}/push/subscriptions`).send(device(1)).expect(204);
    await b.agent
      .post(`${API}/push/subscriptions/remove`)
      .send({ endpoint: device(1).endpoint })
      .expect(204);
    expect(await ctx.prisma.pushSubscription.count()).toBe(1);
    // Same browser, now signed in as B: the device belongs to B.
    await b.agent.post(`${API}/push/subscriptions`).send(device(1)).expect(204);
    const s = await ctx.prisma.pushSubscription.findUniqueOrThrow({
      where: { endpoint: device(1).endpoint },
    });
    expect(s.userId).toBe(b.id);
    await b.agent
      .post(`${API}/push/subscriptions/remove`)
      .send({ endpoint: device(1).endpoint })
      .expect(204);
    expect(await ctx.prisma.pushSubscription.count()).toBe(0);
  });

  it('nothing is pushed for notifications already read', async () => {
    const user = await signup(ctx, 'BRAND');
    await user.agent.post(`${API}/push/subscriptions`).send(device(1)).expect(204);
    const n = await ctx.app
      .get(NotificationsService)
      .notify(user.id, 'SUPPORT_REPLY', { params: { preview: 'Hi' } });
    await ctx.prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    await ctx.queue.drain();
    expect(sent).toHaveLength(0);
  });
});
