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

describe('brief review (e2e)', () => {
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

  async function setup() {
    const admin = await createAdmin(ctx);
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/trial`).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    await admin.agent.post(`${API}/admin/verifications/${queue.body[0].id}/approve`).expect(204);
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deal = await brand.agent.post(`${API}/deals`).send(dealInput()).expect(201);
    return { admin, inf, brand, dealId: deal.body.id as string };
  }

  const feedTotal = async (agent: ReturnType<TestCtx['agent']>) =>
    (await agent.get(`${API}/deals/feed`).expect(200)).body.total;

  it('publish → review → sent back with a reason → fixed → approved → live', async () => {
    const { admin, inf, brand, dealId } = await setup();

    expect((await brand.agent.post(`${API}/deals/${dealId}/publish`).expect(200)).body.status).toBe(
      'IN_REVIEW',
    );
    expect(await feedTotal(inf.agent)).toBe(0);
    await inf.agent.get(`${API}/deals/${dealId}`).expect(404);

    // Admins get told; the queue lists it.
    const notes = await admin.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items[0].type).toBe('DEAL_REVIEW_PENDING');
    const queue = await admin.agent.get(`${API}/admin/deals?status=IN_REVIEW`).expect(200);
    expect(queue.body.map((d: { id: string }) => d.id)).toEqual([dealId]);

    // Only admins decide; a reason is required.
    await brand.agent.post(`${API}/admin/deals/${dealId}/approve`).expect(403);
    await admin.agent.post(`${API}/admin/deals/${dealId}/reject`).send({ reason: '' }).expect(400);
    await admin.agent
      .post(`${API}/admin/deals/${dealId}/reject`)
      .send({ reason: 'Say what the blogger must post.' })
      .expect(204);

    const rejected = await brand.agent.get(`${API}/deals/${dealId}`).expect(200);
    expect(rejected.body).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Say what the blogger must post.',
    });
    const brandNotes = await brand.agent.get(`${API}/notifications`).expect(200);
    expect(brandNotes.body.items[0].type).toBe('DEAL_REJECTED');

    await brand.agent
      .patch(`${API}/deals/${dealId}`)
      .send(dealInput({ description: 'One Reel and two Stories about our new menu, tag us.' }))
      .expect(200);
    await brand.agent.post(`${API}/deals/${dealId}/publish`).expect(200);
    await admin.agent.post(`${API}/admin/deals/${dealId}/approve`).expect(204);
    await admin.agent.post(`${API}/admin/deals/${dealId}/approve`).expect(409);

    const live = await brand.agent.get(`${API}/deals/${dealId}`).expect(200);
    expect(live.body.status).toBe('ACTIVE');
    expect(live.body.reviewNote).toBeNull();
    expect(live.body.publishedAt).not.toBeNull();
    expect(await feedTotal(inf.agent)).toBe(1);

    // Review data is never sent to bloggers.
    const seen = await inf.agent.get(`${API}/deals/${dealId}`).expect(200);
    expect(seen.body).not.toHaveProperty('approvedKey');
    expect(seen.body).not.toHaveProperty('reviewNote');
    const feed = await inf.agent.get(`${API}/deals/feed`).expect(200);
    expect(feed.body.items[0]).not.toHaveProperty('approvedKey');
  });

  it('key changes to a paused brief need a new review; other edits do not', async () => {
    const { admin, inf, brand, dealId } = await setup();
    await brand.agent.post(`${API}/deals/${dealId}/publish`).expect(200);
    await admin.agent.post(`${API}/admin/deals/${dealId}/approve`).expect(204);

    await brand.agent.post(`${API}/deals/${dealId}/pause`).expect(200);
    await brand.agent
      .patch(`${API}/deals/${dealId}`)
      .send(dealInput({ slots: 3 }))
      .expect(200);
    expect((await brand.agent.post(`${API}/deals/${dealId}/publish`).expect(200)).body.status).toBe(
      'ACTIVE',
    );

    await brand.agent.post(`${API}/deals/${dealId}/pause`).expect(200);
    await brand.agent
      .patch(`${API}/deals/${dealId}`)
      .send(dealInput({ slots: 3, title: 'A totally different offer' }))
      .expect(200);
    expect((await brand.agent.post(`${API}/deals/${dealId}/publish`).expect(200)).body.status).toBe(
      'IN_REVIEW',
    );
    expect(await feedTotal(inf.agent)).toBe(0);
  });
});
