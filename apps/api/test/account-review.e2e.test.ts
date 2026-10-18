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

describe('social account review (e2e)', () => {
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

  it('first accounts are approved with the profile; later ones wait for their own review', async () => {
    const admin = await createAdmin(ctx);
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');

    const before = await inf.agent.get(`${API}/influencers/me`).expect(200);
    expect(before.body.socialAccounts[0].reviewStatus).toBe('PENDING');
    // Before the profile is approved, accounts are reviewed on the profile card, not in the account queue.
    expect((await admin.agent.get(`${API}/admin/accounts`).expect(200)).body).toEqual([]);

    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    await admin.agent.post(`${API}/admin/verifications/${queue.body[0].id}/approve`).expect(204);
    const approved = await inf.agent.get(`${API}/influencers/me`).expect(200);
    expect(approved.body.socialAccounts[0].reviewStatus).toBe('APPROVED');

    // A manual account added later goes to the account queue and does not count yet.
    const manual = await inf.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'TIKTOK', username: 'ani.tt', followers: 50_000 })
      .expect(201);
    expect(manual.body.reviewStatus).toBe('PENDING');
    const notes = await admin.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items[0].type).toBe('SOCIAL_ACCOUNT_PENDING');

    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deal = await brand.agent
      .post(`${API}/deals`)
      .send(dealInput({ platforms: ['TIKTOK'] }))
      .expect(201);
    await brand.agent.post(`${API}/deals/${deal.body.id}/publish`).expect(200);
    await admin.agent.post(`${API}/admin/deals/${deal.body.id}/approve`).expect(204);
    expect((await inf.agent.get(`${API}/deals/feed`).expect(200)).body.total).toBe(0);
    const profileForBrand = await brand.agent
      .get(`${API}/influencers/${queue.body[0].id}`)
      .expect(200);
    expect(
      profileForBrand.body.socialAccounts.map((a: { platform: string }) => a.platform),
    ).toEqual(['INSTAGRAM']);

    // Rejected with a reason → the blogger sees it; fixing it sends it back for review.
    const pending = await admin.agent.get(`${API}/admin/accounts`).expect(200);
    expect(pending.body[0]).toMatchObject({
      id: manual.body.id,
      influencer: { displayName: influencerProfile.displayName },
    });
    await inf.agent.post(`${API}/admin/accounts/${manual.body.id}/approve`).expect(403);
    await admin.agent
      .post(`${API}/admin/accounts/${manual.body.id}/reject`)
      .send({ reason: 'The account is private.' })
      .expect(204);
    const rejected = (
      await inf.agent.get(`${API}/influencers/me`).expect(200)
    ).body.socialAccounts.find((a: { id: string }) => a.id === manual.body.id);
    expect(rejected).toMatchObject({
      reviewStatus: 'REJECTED',
      reviewNote: 'The account is private.',
    });
    await inf.agent
      .patch(`${API}/social/accounts/${manual.body.id}`)
      .send({ platform: 'TIKTOK', username: 'ani.tt', followers: 50_000 })
      .expect(200);

    await admin.agent.post(`${API}/admin/accounts/${manual.body.id}/approve`).expect(204);
    await admin.agent.post(`${API}/admin/accounts/${manual.body.id}/approve`).expect(409);
    expect((await inf.agent.get(`${API}/deals/feed`).expect(200)).body.total).toBe(1);
    const infNotes = await inf.agent.get(`${API}/notifications`).expect(200);
    expect(infNotes.body.items.map((n: { type: string }) => n.type)).toContain(
      'SOCIAL_ACCOUNT_REJECTED',
    );
    expect(infNotes.body.items[0].type).toBe('SOCIAL_ACCOUNT_APPROVED');

    // Small number edits of an approved account keep it approved.
    const edited = await inf.agent
      .patch(`${API}/social/accounts/${manual.body.id}`)
      .send({ platform: 'TIKTOK', username: 'ani.tt', followers: 52_000 })
      .expect(200);
    expect(edited.body.reviewStatus).toBe('APPROVED');
  });
});
