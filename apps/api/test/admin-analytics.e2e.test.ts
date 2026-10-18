import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  brandProfile,
  connectMock,
  createAdmin,
  createTestApp,
  dealInput,
  influencerProfile,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

describe('admin analytics (e2e)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  it('counts sign-ups, briefs, the application funnel and blogger plans', async () => {
    const admin = await createAdmin(ctx);
    // Two verified bloggers on the free trial, one blogger who never started it.
    const bloggers = [];
    for (let i = 0; i < 2; i++) {
      const inf = await signup(ctx, 'INFLUENCER');
      await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
      await inf.agent.post(`${API}/billing/trial`).expect(200);
      await connectMock(ctx, inf.agent, 'instagram');
      await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
      bloggers.push(inf);
    }
    await signup(ctx, 'INFLUENCER');
    for (const p of (await admin.agent.get(`${API}/admin/verifications`).expect(200)).body) {
      await admin.agent.post(`${API}/admin/verifications/${p.id}/approve`).expect(204);
    }

    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deal = await brand.agent
      .post(`${API}/deals`)
      .send(dealInput({ slots: 2 }))
      .expect(201);
    await brand.agent.post(`${API}/deals/${deal.body.id}/publish`).expect(200);
    await admin.agent.post(`${API}/admin/deals/${deal.body.id}/approve`).expect(204);

    for (const b of bloggers)
      await b.agent
        .post(`${API}/deals/${deal.body.id}/applications`)
        .send({ pitch: 'I would love to do this.' })
        .expect(201);
    const apps = (await brand.agent.get(`${API}/deals/${deal.body.id}/applications`).expect(200))
      .body.items;
    // First: shortlisted then accepted (still counts as shortlisted). Second: rejected.
    await brand.agent
      .patch(`${API}/applications/${apps[0].id}/status`)
      .send({ status: 'SHORTLISTED' })
      .expect(200);
    await brand.agent
      .patch(`${API}/applications/${apps[0].id}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    await brand.agent
      .patch(`${API}/applications/${apps[1].id}/status`)
      .send({ status: 'REJECTED', rejectionReason: 'BUDGET' })
      .expect(200);

    await brand.agent.get(`${API}/admin/analytics`).expect(403);
    const a = (await admin.agent.get(`${API}/admin/analytics?days=90`).expect(200)).body;
    expect(a).toMatchObject({
      days: 90,
      unit: 'week',
      kpis: {
        bloggers: { period: 3, total: 3 },
        brands: { period: 1, total: 1 },
        briefs: { period: 1, total: 1 },
        applications: { period: 2, total: 2 },
        shortlisted: { period: 1, total: 1 },
        accepted: { period: 1, total: 1 },
      },
      plans: { FREE: 2, PAID: 0, NONE: 1 },
      verification: { APPROVED: 2, PENDING_REVIEW: 0, NOT_VERIFIED: 1 },
      funnel: { sent: 2, shortlisted: 1, accepted: 1, completed: 0 },
      outcomes: { WAITING: 0, ACCEPTED: 1, NOT_SELECTED: 1 },
    });
    expect(a.series.applications.reduce((s: number, x: { count: number }) => s + x.count, 0)).toBe(
      2,
    );
    expect(a.series.applications.length).toBeGreaterThanOrEqual(13);
    expect(a.platforms).toContainEqual({ key: 'INSTAGRAM', count: 1 });
    // Unknown periods fall back to 30 days, daily buckets.
    const d = (await admin.agent.get(`${API}/admin/analytics?days=7`).expect(200)).body;
    expect(d).toMatchObject({ days: 30, unit: 'day' });
    expect(d.series.bloggers).toHaveLength(30);
  });
});
