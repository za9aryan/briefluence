import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  brandProfile,
  connectMock,
  createAdmin,
  createTestApp,
  influencerProfile,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

const DAY = 86_400_000;
const offerInput = (over: Record<string, unknown> = {}) => ({
  title: '1 Story about your place',
  description: 'One Instagram story with a link sticker and a short review of your product.',
  priceMinor: 1_000_000,
  currency: 'AMD',
  collaborationType: 'ONE_TIME',
  platforms: ['INSTAGRAM'],
  contentFormats: ['STORY'],
  niches: ['food'],
  ...over,
});

describe('blogger offers (e2e)', () => {
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

  async function verifiedBlogger() {
    const admin = await createAdmin(ctx);
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const q = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    await admin.agent.post(`${API}/admin/verifications/${q.body[0].id}/approve`).expect(204);
    return { ...inf, admin };
  }

  async function brand() {
    const b = await signup(ctx, 'BRAND');
    await b.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    return b;
  }

  it('offer → review → live → brand views and requests → blogger accepts → contacts both ways', async () => {
    const inf = await verifiedBlogger();
    const created = await inf.agent.post(`${API}/offers`).send(offerInput()).expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(
      (await inf.agent.post(`${API}/offers/${created.body.id}/publish`).expect(200)).body.status,
    ).toBe('IN_REVIEW');

    const b = await brand();
    expect((await b.agent.get(`${API}/offers/feed`).expect(200)).body.total).toBe(0);
    await b.agent.get(`${API}/offers/${created.body.id}`).expect(404);

    // Admin approves; brands see it.
    expect((await inf.admin.agent.get(`${API}/admin/offers`).expect(200)).body).toHaveLength(1);
    await inf.admin.agent.post(`${API}/admin/offers/${created.body.id}/approve`).expect(204);
    const feed = (await b.agent.get(`${API}/offers/feed?format=STORY`).expect(200)).body;
    expect(feed.total).toBe(1);
    expect(feed.items[0]).toMatchObject({
      title: '1 Story about your place',
      blogger: { displayName: influencerProfile.displayName, verified: true },
      myRequest: null,
    });
    expect(feed.items[0]).not.toHaveProperty('approvedKey');
    expect(feed.items[0].blogger).not.toHaveProperty('contactValue');
    expect((await b.agent.get(`${API}/offers/feed?format=REEL`).expect(200)).body.total).toBe(0);

    // Views: once per brand per day.
    await b.agent.get(`${API}/offers/${created.body.id}`).expect(200);
    await b.agent.get(`${API}/offers/${created.body.id}`).expect(200);
    ctx.clock.advance(DAY);
    const seen = await b.agent.get(`${API}/offers/${created.body.id}`).expect(200);
    expect(seen.body.viewCount).toBe(2);

    // Request → blogger sees it without contacts; accepting reveals contacts both ways.
    const req = await b.agent
      .post(`${API}/offers/${created.body.id}/requests`)
      .send({ message: 'We would love a story about our new cafe.', proposedBudget: 1_200_000 })
      .expect(201);
    await b.agent
      .post(`${API}/offers/${created.body.id}/requests`)
      .send({ message: 'Second request should fail.' })
      .expect(409);
    const incoming = (await inf.agent.get(`${API}/offers/${created.body.id}/requests`).expect(200))
      .body;
    expect(incoming[0]).toMatchObject({
      status: 'PENDING',
      brand: { companyName: brandProfile.companyName },
      contacts: null,
    });
    const mineList = (await inf.agent.get(`${API}/offers/mine`).expect(200)).body;
    expect(mineList[0]).toMatchObject({ requestCount: 1, newRequestCount: 1, viewCount: 2 });
    const infNotes = await inf.agent.get(`${API}/notifications`).expect(200);
    expect(infNotes.body.items[0].type).toBe('OFFER_REQUEST_NEW');

    await b.agent.post(`${API}/offer-requests/${req.body.id}/accept`).expect(403);
    await inf.agent.post(`${API}/offer-requests/${req.body.id}/accept`).expect(200);
    await inf.agent.post(`${API}/offer-requests/${req.body.id}/decline`).expect(409);
    const accepted = (await inf.agent.get(`${API}/offers/${created.body.id}/requests`).expect(200))
      .body[0];
    expect(accepted.contacts).toMatchObject({ method: brandProfile.contactMethod });
    const brandSide = (await b.agent.get(`${API}/offer-requests/mine`).expect(200)).body[0];
    expect(brandSide).toMatchObject({
      status: 'ACCEPTED',
      contacts: { method: influencerProfile.contactMethod },
    });
    const brandNotes = await b.agent.get(`${API}/notifications`).expect(200);
    expect(brandNotes.body.items[0].type).toBe('OFFER_REQUEST_ACCEPTED');
  });

  it('Basic allows one live offer, Pro more; only verified bloggers publish; brands only request live offers', async () => {
    const inf = await verifiedBlogger();
    // Free Pro days: unlimited offers.
    const a = await inf.agent.post(`${API}/offers`).send(offerInput()).expect(201);
    const c = await inf.agent
      .post(`${API}/offers`)
      .send(
        offerInput({
          title: '1 Reel for 20,000 AMD',
          contentFormats: ['REEL'],
          priceMinor: 2_000_000,
        }),
      )
      .expect(201);
    await inf.agent.post(`${API}/offers/${a.body.id}/publish`).expect(200);
    await inf.agent.post(`${API}/offers/${c.body.id}/publish`).expect(200);

    // On Basic a third live offer is refused.
    ctx.clock.advance(31 * DAY);
    await inf.admin.agent.post(`${API}/admin/jobs/billing-daily/run`).expect(200);
    const d = await inf.agent
      .post(`${API}/offers`)
      .send(
        offerInput({
          title: 'Long-term with real estate brokers',
          collaborationType: 'LONG_TERM',
          priceMinor: null,
          idealBrands: 'Real estate brokers',
        }),
      )
      .expect(201);
    const limited = await inf.agent.post(`${API}/offers/${d.body.id}/publish`).expect(402);
    expect(limited.body.error.code).toBe('OFFER_LIMIT_REACHED');
    // Closing two frees the slot.
    await inf.agent.post(`${API}/offers/${a.body.id}/close`).expect(200);
    await inf.agent.post(`${API}/offers/${c.body.id}/close`).expect(200);
    await inf.agent.post(`${API}/offers/${d.body.id}/publish`).expect(200);

    // Admin can raise Basic's offer limit.
    await inf.admin.agent
      .patch(`${API}/admin/plans/BASIC`)
      .send({ priceMinor: 0, currency: 'USD', applicationLimit: 10, offerLimit: 3, isActive: true })
      .expect(200);
    const e = await inf.agent
      .post(`${API}/offers`)
      .send(offerInput({ title: 'Second story offer' }))
      .expect(201);
    await inf.agent.post(`${API}/offers/${e.body.id}/publish`).expect(200);

    // Unverified blogger cannot publish; live offers cannot be edited; brands cannot request one in review.
    const other = await signup(ctx, 'INFLUENCER');
    await other.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    // Not verified: no offers at all (like the brief feed).
    const unverified = await other.agent.post(`${API}/offers`).send(offerInput()).expect(403);
    expect(unverified.body.error.code).toBe('NOT_VERIFIED_INFLUENCER');
    // Verified but no plan chosen: asked to choose a plan.
    await ctx.prisma.subscription.deleteMany({ where: { user: { email: inf.email } } });
    const noPlan = await inf.agent.post(`${API}/offers`).send(offerInput()).expect(403);
    expect(noPlan.body.error.code).toBe('TRIAL_NOT_STARTED');
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    const b = await brand();
    await b.agent
      .post(`${API}/offers/${d.body.id}/requests`)
      .send({ message: 'Interested in this collaboration.' })
      .expect(404);
    await b.agent.post(`${API}/offers`).send(offerInput()).expect(403);
    await other.agent.get(`${API}/offers/${d.body.id}`).expect(404);

    // Rejection with a reason; a fixed offer goes back to review.
    await inf.admin.agent
      .post(`${API}/admin/offers/${d.body.id}/reject`)
      .send({ reason: 'Say which content you make.' })
      .expect(204);
    const rejected = (await inf.agent.get(`${API}/offers/${d.body.id}`).expect(200)).body;
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Say which content you make.',
    });
    await inf.agent
      .patch(`${API}/offers/${d.body.id}`)
      .send(
        offerInput({
          title: 'Long-term with real estate brokers',
          description: 'Monthly reels and stories for real estate agencies in Yerevan.',
          collaborationType: 'LONG_TERM',
          priceMinor: null,
        }),
      )
      .expect(200);
    expect(
      (await inf.agent.post(`${API}/offers/${d.body.id}/publish`).expect(200)).body.status,
    ).toBe('IN_REVIEW');
  });

  it('cover image: only our own uploads, and a new cover goes back to review', async () => {
    const inf = await verifiedBlogger();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = async () =>
      (
        await inf.agent
          .post(`${API}/uploads/offer`)
          .attach('file', png, { filename: 'c.png', contentType: 'image/png' })
          .expect(201)
      ).body.url as string;
    await inf.agent
      .post(`${API}/offers`)
      .send(offerInput({ imageUrl: 'https://elsewhere.example/x.png' }))
      .expect(400);
    const first = await upload();
    const created = await inf.agent
      .post(`${API}/offers`)
      .send(offerInput({ imageUrl: first }))
      .expect(201);
    await inf.agent.post(`${API}/offers/${created.body.id}/publish`).expect(200);
    await inf.admin.agent.post(`${API}/admin/offers/${created.body.id}/approve`).expect(204);

    await inf.agent.post(`${API}/offers/${created.body.id}/pause`).expect(200);
    const second = await upload();
    await inf.agent
      .patch(`${API}/offers/${created.body.id}`)
      .send(offerInput({ imageUrl: second }))
      .expect(200);
    const again = await inf.agent.post(`${API}/offers/${created.body.id}/publish`).expect(200);
    expect(again.body.status).toBe('IN_REVIEW');
  });
});
