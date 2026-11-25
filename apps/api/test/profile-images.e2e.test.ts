import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  brandProfile,
  createTestApp,
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

describe('profile photo & logo saved on upload (e2e)', () => {
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

  type Agent = Awaited<ReturnType<typeof signup>>['agent'];
  async function upload(agent: Agent, kind: 'avatar' | 'logo' | 'portfolio') {
    const r = await agent
      .post(`${API}/uploads/${kind}`)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    return r.body.url as string;
  }

  it('saves only the blogger photo, keeps the rest, and removes it with null', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    const url = await upload(inf.agent, 'avatar');

    const r = await inf.agent
      .put(`${API}/influencers/me/avatar`)
      .send({ avatarUrl: url })
      .expect(200);
    expect(r.body.avatarUrl).toBe(url);
    expect(r.body.displayName).toBe(influencerProfile.displayName);
    const me = await inf.agent.get(`${API}/influencers/me`).expect(200);
    expect(me.body.avatarUrl).toBe(url);

    await inf.agent.put(`${API}/influencers/me/avatar`).send({ avatarUrl: null }).expect(200);
    expect((await inf.agent.get(`${API}/influencers/me`)).body.avatarUrl).toBeNull();
  });

  it('accepts only our own avatar uploads and needs a profile and the right role', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    const url = await upload(inf.agent, 'avatar');
    // No profile yet.
    const early = await inf.agent
      .put(`${API}/influencers/me/avatar`)
      .send({ avatarUrl: url })
      .expect(403);
    expect(early.body.error.code).toBe('PROFILE_INCOMPLETE');

    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await inf.agent
      .put(`${API}/influencers/me/avatar`)
      .send({ avatarUrl: 'https://example.com/a.png' })
      .expect(400);
    const portfolioImage = await upload(inf.agent, 'portfolio');
    await inf.agent
      .put(`${API}/influencers/me/avatar`)
      .send({ avatarUrl: portfolioImage })
      .expect(400);
    await inf.agent.put(`${API}/influencers/me/avatar`).send({ avatarUrl: 'nope' }).expect(400);

    const brand = await signup(ctx, 'BRAND');
    await brand.agent.put(`${API}/influencers/me/avatar`).send({ avatarUrl: url }).expect(403);
  });

  it('saves only the brand logo', async () => {
    const brand = await signup(ctx, 'BRAND');
    const url = await upload(brand.agent, 'logo');
    const early = await brand.agent.put(`${API}/brands/me/logo`).send({ logoUrl: url }).expect(403);
    expect(early.body.error.code).toBe('PROFILE_INCOMPLETE');

    await brand.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const r = await brand.agent.put(`${API}/brands/me/logo`).send({ logoUrl: url }).expect(200);
    expect(r.body.logoUrl).toBe(url);
    expect(r.body.companyName).toBe(brandProfile.companyName);
    await brand.agent
      .put(`${API}/brands/me/logo`)
      .send({ logoUrl: 'https://example.com/a.png' })
      .expect(400);

    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/brands/me/logo`).send({ logoUrl: url }).expect(403);
  });
});
