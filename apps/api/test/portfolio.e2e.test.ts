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

// Smallest valid PNG (1×1): the upload endpoint checks the magic bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('blogger portfolio & FAQ (e2e)', () => {
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

  async function approvedInfluencer() {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const admin = await createAdmin(ctx);
    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    await admin.agent.post(`${API}/admin/verifications/${queue.body[0].id}/approve`).expect(204);
    return { ...inf, admin, profileId: queue.body[0].id as string };
  }

  async function brandWithDeal(admin: Awaited<ReturnType<typeof approvedInfluencer>>['admin']) {
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const deal = await brand.agent.post(`${API}/deals`).send(dealInput()).expect(201);
    await brand.agent.post(`${API}/deals/${deal.body.id}/publish`).expect(200);
    await admin.agent.post(`${API}/admin/deals/${deal.body.id}/approve`).expect(204);
    return { ...brand, dealId: deal.body.id as string };
  }

  async function upload(agent: Awaited<ReturnType<typeof approvedInfluencer>>['agent']) {
    const r = await agent
      .post(`${API}/uploads/portfolio`)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    return r.body.url as string;
  }

  it('item → admin review → brand sees approved work and answered FAQ only; edits go back to review', async () => {
    const inf = await approvedInfluencer();
    const imageUrl = await upload(inf.agent);
    const brand = await brandWithDeal(inf.admin);

    // Brands cannot upload portfolio images, and hotlinked images are refused.
    await brand.agent
      .post(`${API}/uploads/portfolio`)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(403);
    await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl: 'https://evil.example/x.png', title: 'Story' })
      .expect(400);

    const created = await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({
        imageUrl,
        title: 'Story for a cafe',
        description: '',
        linkUrl: 'https://instagram.com/p/abc',
      })
      .expect(201);
    expect(created.body).toMatchObject({ reviewStatus: 'PENDING', description: null });

    // Nothing answered, nothing approved: the brand sees empty sections.
    let view = (await brand.agent.get(`${API}/influencers/${inf.profileId}`).expect(200)).body;
    expect(view.portfolio).toEqual([]);
    expect(view.faq).toEqual([]);

    await inf.agent
      .put(`${API}/influencers/me/faq`)
      .send({ faqBrandsWorked: 'Local cafes and a gym', faqAudience: ' ', faqBrandsWanted: null })
      .expect(200);
    const queue = (await inf.admin.agent.get(`${API}/admin/portfolio`).expect(200)).body;
    expect(queue).toHaveLength(1);
    expect(queue[0].influencer.displayName).toBe(influencerProfile.displayName);
    await inf.admin.agent.post(`${API}/admin/portfolio/${created.body.id}/approve`).expect(204);

    expect(await ctx.prisma.notification.count({ where: { type: 'PORTFOLIO_APPROVED' } })).toBe(1);
    view = (await brand.agent.get(`${API}/influencers/${inf.profileId}`).expect(200)).body;
    expect(view.faq).toEqual([{ key: 'brandsWorked', answer: 'Local cafes and a gym' }]);
    expect(view.portfolio).toHaveLength(1);
    expect(view.portfolio[0]).toMatchObject({
      title: 'Story for a cafe',
      linkUrl: 'https://instagram.com/p/abc',
    });

    // Saving unchanged keeps it live; a change hides it until the admin approves again.
    const same = await inf.agent
      .put(`${API}/influencers/me/portfolio/${created.body.id}`)
      .send({ imageUrl, title: 'Story for a cafe', linkUrl: 'https://instagram.com/p/abc' })
      .expect(200);
    expect(same.body.reviewStatus).toBe('APPROVED');
    const edited = await inf.agent
      .put(`${API}/influencers/me/portfolio/${created.body.id}`)
      .send({ imageUrl, title: 'Story for a new cafe' })
      .expect(200);
    expect(edited.body.reviewStatus).toBe('PENDING');
    view = (await brand.agent.get(`${API}/influencers/${inf.profileId}`).expect(200)).body;
    expect(view.portfolio).toEqual([]);

    // Reject notifies the blogger with the reason.
    await inf.admin.agent
      .post(`${API}/admin/portfolio/${created.body.id}/reject`)
      .send({ reason: 'Contains a competitor logo' })
      .expect(204);
    const mine = (await inf.agent.get(`${API}/influencers/me/portfolio`).expect(200)).body;
    expect(mine[0]).toMatchObject({
      reviewStatus: 'REJECTED',
      reviewNote: 'Contains a competitor logo',
    });
    const notes = await ctx.prisma.notification.findMany({ where: { type: 'PORTFOLIO_REJECTED' } });
    expect(notes).toHaveLength(1);
  });

  it('only the owner can change an item', async () => {
    const inf = await approvedInfluencer();
    const imageUrl = await upload(inf.agent);
    const item = await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl, title: 'Reel for a gym' })
      .expect(201);

    const other = await signup(ctx, 'INFLUENCER');
    await other.agent
      .put(`${API}/influencers/me`)
      .send({ ...influencerProfile, displayName: 'Other' })
      .expect(200);
    await other.agent
      .put(`${API}/influencers/me/portfolio/${item.body.id}`)
      .send({ imageUrl, title: 'Mine now' })
      .expect(404);
    await other.agent.delete(`${API}/influencers/me/portfolio/${item.body.id}`).expect(404);
    await inf.agent.delete(`${API}/influencers/me/portfolio/${item.body.id}`).expect(204);
    expect((await inf.agent.get(`${API}/influencers/me/portfolio`).expect(200)).body).toEqual([]);
  });

  it('applications carry only the blogger’s own approved items', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal(inf.admin);
    const imageUrl = await upload(inf.agent);
    const approved = await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl, title: 'Approved work' })
      .expect(201);
    const pending = await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl, title: 'Pending work' })
      .expect(201);
    await inf.admin.agent.post(`${API}/admin/portfolio/${approved.body.id}/approve`).expect(204);

    const pitch = 'Hi! I would love to film a Reel about your place.';
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch, portfolioItemIds: [pending.body.id] })
      .expect(400);
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch, portfolioItemIds: ['a', 'b', 'c', 'd'] })
      .expect(400);
    await inf.agent
      .post(`${API}/deals/${brand.dealId}/applications`)
      .send({ pitch, portfolioItemIds: [approved.body.id] })
      .expect(201);

    const list = (await brand.agent.get(`${API}/deals/${brand.dealId}/applications`).expect(200))
      .body;
    expect(list.items[0].portfolio).toHaveLength(1);
    expect(list.items[0].portfolio[0].title).toBe('Approved work');
  });

  it('offer page shows the blogger’s answered FAQ and approved work to brands', async () => {
    const inf = await approvedInfluencer();
    const brand = await brandWithDeal(inf.admin);
    const imageUrl = await upload(inf.agent);
    const approved = await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl, title: 'Approved work' })
      .expect(201);
    await inf.agent
      .post(`${API}/influencers/me/portfolio`)
      .send({ imageUrl, title: 'Pending work' })
      .expect(201);
    await inf.admin.agent.post(`${API}/admin/portfolio/${approved.body.id}/approve`).expect(204);
    await inf.agent
      .put(`${API}/influencers/me/faq`)
      .send({ faqBrandsWanted: 'Restaurants and hotels' })
      .expect(200);
    const offer = await inf.agent
      .post(`${API}/offers`)
      .send({
        title: '1 Story about your place',
        description: 'One Instagram story with a link sticker and a short review of your product.',
        priceMinor: 1_000_000,
        currency: 'AMD',
        collaborationType: 'ONE_TIME',
        platforms: ['INSTAGRAM'],
        contentFormats: ['STORY'],
        niches: ['food'],
      })
      .expect(201);
    await inf.agent.post(`${API}/offers/${offer.body.id}/publish`).expect(200);
    await inf.admin.agent.post(`${API}/admin/offers/${offer.body.id}/approve`).expect(204);

    const view = (await brand.agent.get(`${API}/offers/${offer.body.id}`).expect(200)).body;
    expect(view.blogger.faq).toEqual([{ key: 'brandsWanted', answer: 'Restaurants and hotels' }]);
    expect(view.blogger.portfolio.map((i: { title: string }) => i.title)).toEqual([
      'Approved work',
    ]);
    // The feed stays light: no FAQ or portfolio per card.
    const feed = (await brand.agent.get(`${API}/offers/feed`).expect(200)).body;
    expect(feed.items[0].blogger).not.toHaveProperty('portfolio');
  });
});
