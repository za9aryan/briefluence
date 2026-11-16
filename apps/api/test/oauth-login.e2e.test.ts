import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, createTestApp, resetDb, signup, type TestCtx } from './helpers';

const mockCode = (email: string, name = 'Test Person') =>
  `mock:${Buffer.from(JSON.stringify({ email, name })).toString('base64url')}`;

describe('sign in with Google (e2e, simulated provider)', () => {
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
  async function signIn(agent: ReturnType<TestCtx['agent']>, email: string, query = '') {
    const start = await agent.get(`${API}/auth/oauth/google/start${query}`).expect(302);
    const consent = new URL(start.headers.location as string);
    expect(consent.pathname).toBe('/oauth/mock');
    const state = consent.searchParams.get('state')!;
    const cb = await agent
      .get(`${API}/auth/oauth/google/callback`)
      .query({ code: mockCode(email), state })
      .expect(302);
    return new URL(cb.headers.location as string);
  }

  it('lists the available providers', async () => {
    const res = await ctx.http().get(`${API}/auth/oauth/providers`).expect(200);
    expect(res.body.providers).toEqual(['google']);
    // Apple sign-in is gone.
    await ctx.http().get(`${API}/auth/oauth/apple/start`).expect(404);
  });

  it('creates an account from the sign-up page (role known) with a verified email and no password', async () => {
    const agent = ctx.agent();
    const back = await signIn(agent, 'new.blogger@gmail.com', '?role=INFLUENCER');
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
    const back = await signIn(agent, 'brand.owner@gmail.com');
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
    expect(res.body).toMatchObject({ email: 'brand.owner@gmail.com', role: 'BRAND' });
    await agent.get(`${API}/auth/me`).expect(200);
  });

  it('never takes over an existing account: the simulated login only types an email', async () => {
    const existing = await signup(ctx, 'BRAND');
    const back = await signIn(ctx.agent(), existing.email);
    expect(back.searchParams.get('error')).toBe('CONFLICT');
    expect(await ctx.prisma.authIdentity.count({ where: { userId: existing.id } })).toBe(0);
  });

  it('signs back in with a known identity, and not as a second account', async () => {
    const agent = ctx.agent();
    await signIn(agent, 'returning@gmail.com', '?role=INFLUENCER');
    await signIn(ctx.agent(), 'returning@gmail.com');
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

    await signIn(ctx.agent(), 'later.blocked@gmail.com', '?role=INFLUENCER');
    await ctx.prisma.user.updateMany({
      where: { email: 'later.blocked@gmail.com' },
      data: { blockedAt: new Date() },
    });
    const blocked = await signIn(ctx.agent(), 'later.blocked@gmail.com');
    expect(blocked.searchParams.get('error')).toBe('ACCOUNT_BLOCKED');
  });
});
