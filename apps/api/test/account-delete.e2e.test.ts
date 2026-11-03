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

describe('delete my account (e2e)', () => {
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

  it('influencer: wrong password refused; then anonymized, signed out, email free again', async () => {
    const inf = await signup(ctx, 'INFLUENCER');
    await inf.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    await connectMock(ctx, inf.agent, 'instagram');

    const wrong = await inf.agent.post(`${API}/account/delete`).send({ password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    await inf.agent.post(`${API}/account/delete`).send({ password: 'secret123' }).expect(204);
    await inf.agent.get(`${API}/auth/me`).expect(401);
    await ctx
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: inf.email, password: 'secret123' })
      .expect(401);

    const u = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: inf.id },
      include: { influencer: { include: { socialAccounts: true } }, refreshTokens: true },
    });
    expect(u.deletedAt).not.toBeNull();
    expect(u.blockedAt).not.toBeNull();
    expect(u.email).not.toBe(inf.email);
    expect(u.passwordHash).toBeNull();
    expect(u.refreshTokens).toHaveLength(0);
    expect(u.influencer?.displayName).toBe('Deleted account');
    expect(u.influencer?.socialAccounts).toHaveLength(0);

    // The address can sign up again.
    await ctx
      .agent()
      .post(`${API}/auth/signup`)
      .send({ email: inf.email, password: 'secret123', role: 'INFLUENCER', acceptTerms: true })
      .expect(201);
  });

  it('company: live briefs close; admins see it as deleted and cannot unblock it', async () => {
    const admin = await createAdmin(ctx);
    const b = await signup(ctx, 'BRAND');
    await b.agent.put(`${API}/brands/me`).send(brandProfile).expect(200);
    const brand = await ctx.prisma.brandProfile.findFirstOrThrow({ where: { userId: b.id } });
    await ctx.prisma.deal.create({
      data: {
        brandId: brand.id,
        title: 'Reel',
        description: 'A reel',
        paymentType: 'MONEY',
        budgetMin: 100_00,
        applicationDeadline: new Date(Date.now() + 7 * 86_400_000),
        status: 'ACTIVE',
      },
    });

    await b.agent.post(`${API}/account/delete`).send({ password: 'secret123' }).expect(204);
    expect((await ctx.prisma.deal.findFirstOrThrow({ where: { brandId: brand.id } })).status).toBe(
      'CLOSED',
    );
    expect(
      (await ctx.prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } })).companyName,
    ).toBe('Deleted company');

    const users = (await admin.agent.get(`${API}/admin/users`).expect(200)).body as {
      id: string;
      deletedAt: string | null;
    }[];
    expect(users.find((x) => x.id === b.id)?.deletedAt).toBeTruthy();
    await admin.agent.post(`${API}/admin/users/${b.id}/unblock`).expect(409);
  });

  it('admins see every offer with status=ALL', async () => {
    const admin = await createAdmin(ctx);
    expect((await admin.agent.get(`${API}/admin/offers?status=ALL`).expect(200)).body).toEqual([]);
  });
});
