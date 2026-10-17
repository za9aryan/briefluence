import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, createTestApp, resetDb, signup, type TestCtx } from './helpers';

const mockCode = (email: string, name = 'Test Person') =>
  `mock:${Buffer.from(JSON.stringify({ email, name })).toString('base64url')}`;

describe('sign in with Google / Apple (e2e, simulated providers)', () => {
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

  /** start → (simulated consent) → callback; returns the final redirect URL. */
  async function signIn(
    agent: ReturnType<TestCtx['agent']>,
    provider: 'google' | 'apple',
    email: string,
    query = '',
  ) {
    const start = await agent.get(`${API}/auth/oauth/${provider}/start${query}`).expect(302);
    const consent = new URL(start.headers.location as string);
    expect(consent.pathname).toBe('/oauth/mock');
    const state = consent.searchParams.get('state')!;
    const cb =
      provider === 'apple'
        ? await agent
            .post(`${API}/auth/oauth/apple/callback`)
            .type('form')
            .send({ code: mockCode(email), state })
            .expect(302)
        : await agent
            .get(`${API}/auth/oauth/google/callback`)
            .query({ code: mockCode(email), state })
            .expect(302);
    return new URL(cb.headers.location as string);
  }

  it('lists the available providers', async () => {
    const res = await ctx.http().get(`${API}/auth/oauth/providers`).expect(200);
    expect(res.body.providers).toEqual(['google', 'apple']);
  });

  it('creates an account from the sign-up page (role known) with a verified email and no password', async () => {
    const agent = ctx.agent();
    const back = await signIn(agent, 'google', 'new.blogger@gmail.com', '?role=INFLUENCER');
    expect(back.pathname).toBe('/influencer/dashboard');
    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body).toMatchObject({
      email: 'new.blogger@gmail.com',
      role: 'INFLUENCER',
      emailVerified: true,
      hasPassword: false,
    });
    // Password login is refused for a password-less account, with the generic message.
    const login = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: 'new.blogger@gmail.com', password: 'whatever1' })
      .expect(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
    // It can set a first password without a current one.
    await agent.post(`${API}/auth/change-password`).send({ newPassword: 'newpass123' }).expect(204);
    await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: 'new.blogger@gmail.com', password: 'newpass123' })
      .expect(200);
  });

  it('sends a new person from the login page to choose a role, then creates the account', async () => {
    const agent = ctx.agent();
    const back = await signIn(agent, 'apple', 'brand.owner@icloud.com');
    expect(back.pathname).toBe('/signup/complete');
    const token = back.searchParams.get('token')!;
    await agent
      .post(`${API}/auth/oauth/complete`)
      .send({ token, role: 'BRAND', acceptTerms: false })
      .expect(400);
    const res = await agent
      .post(`${API}/auth/oauth/complete`)
      .send({ token, role: 'BRAND', acceptTerms: true })
      .expect(200);
    expect(res.body).toMatchObject({ email: 'brand.owner@icloud.com', role: 'BRAND' });
    await agent.get(`${API}/auth/me`).expect(200);
  });

  it('links to an existing account with the same email and signs back in next time', async () => {
    const existing = await signup(ctx, 'BRAND');
    const agent = ctx.agent();
    const back = await signIn(agent, 'google', existing.email);
    expect(back.pathname).toBe('/brand/dashboard');
    expect((await agent.get(`${API}/auth/me`)).body.id).toBe(existing.id);
    expect(await ctx.prisma.authIdentity.count({ where: { userId: existing.id } })).toBe(1);
    // Second time: found by identity, no duplicate.
    const again = ctx.agent();
    await signIn(again, 'google', existing.email);
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('rejects a callback without the browser nonce (login CSRF) and blocked accounts', async () => {
    const agent = ctx.agent();
    const start = await agent.get(`${API}/auth/oauth/google/start?role=BRAND`).expect(302);
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    // A different browser (no nonce cookie) presents the state.
    const forged = await ctx
      .http()
      .get(`${API}/auth/oauth/google/callback`)
      .query({ code: mockCode('x@y.am'), state })
      .expect(302);
    expect(new URL(forged.headers.location as string).searchParams.get('error')).toBe(
      'INVALID_TOKEN',
    );

    const u = await signup(ctx, 'INFLUENCER');
    await ctx.prisma.user.update({ where: { id: u.id }, data: { blockedAt: new Date() } });
    const blocked = await signIn(ctx.agent(), 'google', u.email);
    expect(blocked.searchParams.get('error')).toBe('ACCOUNT_BLOCKED');
  });
});
