import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  createAdmin,
  createTestApp,
  influencerProfile,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

describe('manually added social accounts (e2e)', () => {
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

  it('adds with only the required fields, edits, and counts for verification', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);

    // Missing followers → validation error.
    await inf.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'TIKTOK', username: 'ani' })
      .expect(400);

    const added = await inf.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'TIKTOK', username: '@ani.food', followers: 25_000 })
      .expect(201);
    expect(added.body).toMatchObject({
      source: 'MANUAL',
      username: 'ani.food',
      followers: 25_000,
      profileUrl: 'https://www.tiktok.com/@ani.food',
      engagementRate: null,
    });
    expect(added.body).not.toHaveProperty('accessTokenEnc');

    await inf.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'TIKTOK', username: 'ANI.food', followers: 1 })
      .expect(409);

    const edited = await inf.agent
      .patch(`${API}/social/accounts/${added.body.id}`)
      .send({
        platform: 'TIKTOK',
        username: 'ani.food',
        followers: 30_000,
        engagementRate: 4.2,
        audienceFemale: 70,
        topCountry: 'AM',
        topCountryShare: 80,
        topAge: '18-24',
        topAgeShare: 45,
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      followers: 30_000,
      engagementRate: 4.2,
      audienceGender: { female: 70, male: 30 },
      audienceCountries: { AM: 80 },
      audienceAge: { '18-24': 45 },
    });

    // No platform sync for manual accounts.
    await inf.agent.post(`${API}/social/accounts/${added.body.id}/sync`).expect(409);

    // A manual account is enough to send the profile for review; the admin sees it as manual.
    await inf.agent.post(`${API}/influencers/me/submit`).expect(200);
    const admin = await createAdmin(ctx);
    const queue = await admin.agent.get(`${API}/admin/verifications`).expect(200);
    expect(queue.body[0].socialAccounts[0].source).toBe('MANUAL');

    // Another blogger cannot claim the same handle.
    const other = await signup(ctx, 'INFLUENCER');
    await other.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await other.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'TIKTOK', username: 'ani.food', followers: 5 })
      .expect(409);
    await other.agent
      .patch(`${API}/social/accounts/${added.body.id}`)
      .send({ platform: 'TIKTOK', username: 'x', followers: 1 })
      .expect(404);
  });
});
