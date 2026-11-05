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

const offerInput = {
  title: '1 Story about your place',
  description: 'One Instagram story with a link sticker and a short review of your product.',
  priceMinor: 2_000_000,
  currency: 'AMD',
  collaborationType: 'ONE_TIME',
  platforms: ['INSTAGRAM'],
  contentFormats: ['STORY'],
  niches: ['food'],
};

describe('public blogger page /@username (e2e)', () => {
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

  async function blogger() {
    const admin = await createAdmin(ctx);
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent.post(`${API}/billing/plan`).send({ plan: 'BASIC' }).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');
    return { ...inf, admin };
  }
  async function approve(inf: Awaited<ReturnType<typeof blogger>>) {
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const q = await inf.admin.agent.get(`${API}/admin/verifications`).expect(200);
    await inf.admin.agent.post(`${API}/admin/verifications/${q.body[0].id}/approve`).expect(204);
  }

  it('username rules: normalized, validated, unique, removable', async () => {
    const a = await blogger();
    const b = await signup(ctx, 'INFLUENCER');
    await b.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);

    const set = await a.agent.put(`${API}/influencers/me/username`).send({ username: '@Anna.Art' });
    expect(set.status).toBe(200);
    expect(set.body.username).toBe('anna.art');
    const taken = await b.agent
      .put(`${API}/influencers/me/username`)
      .send({ username: 'ANNA.ART' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('USERNAME_TAKEN');
    for (const username of ['ad', 'admin', 'an na', 'anna.'])
      await b.agent.put(`${API}/influencers/me/username`).send({ username }).expect(400);
    // Brands have no username.
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/influencers/me/username`).send({ username: 'shop' }).expect(403);

    await a.agent.put(`${API}/influencers/me/username`).send({ username: null }).expect(200);
    await b.agent.put(`${API}/influencers/me/username`).send({ username: 'anna.art' }).expect(200);
  });

  it('live only after verification; guests see no stats, prices or contacts', async () => {
    const inf = await blogger();
    await inf.agent.put(`${API}/influencers/me/username`).send({ username: 'anna' }).expect(200);

    // Not verified yet: hidden from guests, the owner sees it with live=false.
    await ctx.http().get(`${API}/public/influencers/anna`).expect(404);
    const mine = await inf.agent.get(`${API}/public/influencers/anna`).expect(200);
    expect(mine.body).toMatchObject({ access: 'owner', live: false });

    await approve(inf);
    const offer = await inf.agent.post(`${API}/offers`).send(offerInput).expect(201);
    await inf.agent.post(`${API}/offers/${offer.body.id}/publish`).expect(200);
    await inf.admin.agent.post(`${API}/admin/offers/${offer.body.id}/approve`).expect(204);

    const guest = await ctx.http().get(`${API}/public/influencers/ANNA`).expect(200);
    expect(guest.body).toMatchObject({
      access: 'guest',
      live: true,
      username: 'anna',
      displayName: influencerProfile.displayName,
      contacts: null,
    });
    expect(guest.body.socialAccounts[0]).toEqual({
      id: expect.any(String),
      platform: 'INSTAGRAM',
      username: expect.any(String),
      profileUrl: expect.any(String),
    });
    expect(guest.body.offers).toEqual([
      expect.objectContaining({
        id: offer.body.id,
        title: offerInput.title,
        priceMinor: null,
        currency: null,
        hasPrice: true,
      }),
    ]);
    expect(guest.body).not.toHaveProperty('birthYear');
    expect(guest.body).not.toHaveProperty('gender');
    const raw = JSON.stringify(guest.body);
    expect(raw).not.toContain('followers');
    expect(raw).not.toContain('2000000');

    // Other bloggers get the guest view too; brands the full one, with prices.
    const other = await signup(ctx, 'INFLUENCER');
    expect((await other.agent.get(`${API}/public/influencers/anna`).expect(200)).body.access).toBe(
      'guest',
    );
    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const full = await brand.agent.get(`${API}/public/influencers/anna`).expect(200);
    expect(full.body).toMatchObject({ access: 'brand', live: true, username: 'anna' });
    expect(full.body.socialAccounts[0].followers).toEqual(expect.any(Number));
    expect(full.body.offers[0]).toMatchObject({ priceMinor: 2_000_000, currency: 'AMD' });
    // The brand page by id lists the offers as well.
    const byId = await brand.agent.get(`${API}/influencers/${full.body.id}`).expect(200);
    expect(byId.body.offers.map((o: { id: string }) => o.id)).toEqual([offer.body.id]);

    // Sitemap list; a blocked blogger disappears.
    expect((await ctx.http().get(`${API}/public/influencers`).expect(200)).body).toEqual([
      { username: 'anna', approvedAt: expect.any(String) },
    ]);
    await ctx.prisma.user.update({ where: { id: inf.id }, data: { blockedAt: new Date() } });
    await ctx.http().get(`${API}/public/influencers/anna`).expect(404);
    expect((await ctx.http().get(`${API}/public/influencers`).expect(200)).body).toEqual([]);
  });

  it('paused offers are not shown on the profile', async () => {
    const inf = await blogger();
    await approve(inf);
    await inf.agent.put(`${API}/influencers/me/username`).send({ username: 'ani' }).expect(200);
    const offer = await inf.agent.post(`${API}/offers`).send(offerInput).expect(201);
    await inf.agent.post(`${API}/offers/${offer.body.id}/publish`).expect(200);
    await inf.admin.agent.post(`${API}/admin/offers/${offer.body.id}/approve`).expect(204);
    await inf.agent.post(`${API}/offers/${offer.body.id}/pause`).expect(200);
    expect((await ctx.http().get(`${API}/public/influencers/ani`).expect(200)).body.offers).toEqual(
      [],
    );
  });
});
