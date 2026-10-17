import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, createTestApp, lastEmailTo, resetDb, signup, type TestCtx } from './helpers';

const tokenFrom = (html: string, path: string) => {
  const m = new RegExp(`${path}\\?token=([^"&]+)`).exec(html);
  if (!m) throw new Error('token not found in email');
  return decodeURIComponent(m[1]!);
};

describe('auth (e2e)', () => {
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

  it('signs up, sets httpOnly cookies, and returns the user', async () => {
    const res = await ctx
      .http()
      .post(`${API}/auth/signup`)
      .send({ email: 'New@Test.am', password: 'secret123', role: 'BRAND', acceptTerms: true })
      .expect(201);
    expect(res.body).toMatchObject({ email: 'new@test.am', role: 'BRAND', emailVerified: false });
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/bf_at=.*HttpOnly/);
    expect(cookies).toMatch(/bf_rt=.*Path=\/api\/v1\/auth/);
    expect(cookies).toMatch(/bf_role=BRAND/);
  });

  it('rejects invalid input, admin sign-up, and duplicate emails', async () => {
    const bad = await ctx.http().post(`${API}/auth/signup`).send({ email: 'x', password: '1', role: 'BRAND' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    await ctx
      .http()
      .post(`${API}/auth/signup`)
      .send({ email: 'a@test.am', password: 'secret123', role: 'ADMIN', acceptTerms: true })
      .expect(400);
    const body = { email: 'dup@test.am', password: 'secret123', role: 'INFLUENCER', acceptTerms: true };
    await ctx.http().post(`${API}/auth/signup`).send(body).expect(201);
    const dup = await ctx.http().post(`${API}/auth/signup`).send(body).expect(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in and out; wrong password is rejected', async () => {
    const { email } = await signup(ctx, 'INFLUENCER');
    const wrong = await ctx.http().post(`${API}/auth/login`).send({ email, password: 'nope1234' }).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const agent = ctx.agent();
    await agent.post(`${API}/auth/login`).send({ email, password: 'secret123' }).expect(200);
    await agent.get(`${API}/auth/me`).expect(200);
    await agent.post(`${API}/auth/logout`).expect(204);
    await agent.get(`${API}/auth/me`).expect(401);
    await agent.post(`${API}/auth/refresh`).expect(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { agent } = await signup(ctx, 'BRAND');
    const first = await agent.post(`${API}/auth/refresh`).expect(200);
    const setCookie = (first.headers['set-cookie'] as unknown as string[]).join(';');
    const stolen = /bf_rt=([^;]+)/.exec(setCookie)?.[1];
    expect(stolen).toBeTruthy();
    // The legitimate client rotates again; the old token is now spent.
    await agent.post(`${API}/auth/refresh`).expect(200);
    // An attacker replays the spent token → whole family revoked.
    await ctx.http().post(`${API}/auth/refresh`).set('Cookie', `bf_rt=${stolen}`).expect(401);
    await agent.post(`${API}/auth/refresh`).expect(401);
  });

  it('verifies email with the emailed link and refreshes the session', async () => {
    const { agent, email } = await signup(ctx, 'INFLUENCER', { verified: false });
    expect((await agent.get(`${API}/auth/me`)).body.emailVerified).toBe(false);
    const mail = await lastEmailTo(ctx, email);
    expect(mail?.subject).toBe('Confirm your email');
    const token = tokenFrom(mail!.html, 'verify-email');
    await agent.post(`${API}/auth/verify-email`).send({ token }).expect(200);
    expect((await agent.get(`${API}/auth/me`)).body.emailVerified).toBe(true);
    await ctx.http().post(`${API}/auth/verify-email`).send({ token: 'garbage-token-value' }).expect(401);
  });

  it('resends the verification email', async () => {
    const { agent, email } = await signup(ctx, 'BRAND', { verified: false });
    ctx.email.outbox.length = 0;
    await agent.post(`${API}/auth/resend-verification`).expect(204);
    expect((await lastEmailTo(ctx, email))?.subject).toBe('Confirm your email');
  });

  it('resets the password with a single-use link and signs out other sessions', async () => {
    const { agent, email } = await signup(ctx, 'BRAND');
    await ctx.http().post(`${API}/auth/forgot-password`).send({ email: 'nobody@test.am' }).expect(204);
    await ctx.http().post(`${API}/auth/forgot-password`).send({ email }).expect(204);
    const token = tokenFrom((await lastEmailTo(ctx, email))!.html, 'reset-password');
    await ctx.http().post(`${API}/auth/reset-password`).send({ token, password: 'newpass123' }).expect(204);
    const reused = await ctx.http().post(`${API}/auth/reset-password`).send({ token, password: 'other1234' }).expect(401);
    expect(reused.body.error.code).toBe('INVALID_TOKEN');
    await agent.post(`${API}/auth/refresh`).expect(401);
    await ctx.http().post(`${API}/auth/login`).send({ email, password: 'newpass123' }).expect(200);
  });

  it('changes password and notification settings', async () => {
    const { agent, email } = await signup(ctx, 'INFLUENCER');
    await agent.post(`${API}/auth/change-password`).send({ currentPassword: 'wrong', newPassword: 'abc12345' }).expect(401);
    await agent.post(`${API}/auth/change-password`).send({ currentPassword: 'secret123', newPassword: 'abc12345' }).expect(204);
    await agent.get(`${API}/auth/me`).expect(200);
    await ctx.http().post(`${API}/auth/login`).send({ email, password: 'abc12345' }).expect(200);
    await agent.patch(`${API}/auth/settings`).send({ digestEmails: false }).expect(204);
    expect((await agent.get(`${API}/auth/me`)).body.digestEmails).toBe(false);
  });

  it('blocks login for blocked users and enforces roles', async () => {
    const { agent, email } = await signup(ctx, 'INFLUENCER');
    await agent.get(`${API}/brands/me`).expect(403);
    await agent.get(`${API}/admin/stats`).expect(403);
    await ctx.http().get(`${API}/auth/me`).expect(401);
    await ctx.prisma.user.update({ where: { email }, data: { blockedAt: new Date() } });
    const res = await ctx.http().post(`${API}/auth/login`).send({ email, password: 'secret123' }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED');
  });
});
