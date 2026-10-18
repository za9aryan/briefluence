import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  API,
  createAdmin,
  createTestApp,
  lastEmailTo,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

describe('admin user support (e2e)', () => {
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

  it('confirms an email, resends the letter, filters unconfirmed users', async () => {
    const admin = await createAdmin(ctx);
    const user = await signup(ctx, 'BRAND', { verified: false });
    await signup(ctx, 'BRAND');

    const unverified = await admin.agent.get(`${API}/admin/users?state=unverified`).expect(200);
    expect(unverified.body.map((u: { email: string }) => u.email)).toEqual([user.email]);

    ctx.email.outbox.length = 0;
    await admin.agent.post(`${API}/admin/users/${user.id}/resend-verification`).expect(204);
    expect((await lastEmailTo(ctx, user.email))?.html).toContain('/verify-email?token=');

    await admin.agent.post(`${API}/admin/users/${user.id}/verify-email`).expect(204);
    expect(
      (await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt,
    ).not.toBeNull();
    await admin.agent.post(`${API}/admin/users/${user.id}/resend-verification`).expect(409);
  });

  it('sends a reset link and signs the user out everywhere; only admins may', async () => {
    const admin = await createAdmin(ctx);
    const user = await signup(ctx, 'INFLUENCER');

    ctx.email.outbox.length = 0;
    await admin.agent.post(`${API}/admin/users/${user.id}/send-password-reset`).expect(204);
    expect((await lastEmailTo(ctx, user.email))?.html).toContain('/reset-password?token=');

    await user.agent.post(`${API}/admin/users/${user.id}/verify-email`).expect(403);
    await user.agent.get(`${API}/auth/me`).expect(200);
    await admin.agent.post(`${API}/admin/users/${user.id}/sign-out`).expect(204);
    await user.agent.post(`${API}/auth/refresh`).expect(401);

    await admin.agent.post(`${API}/admin/users/nope/verify-email`).expect(404);
  });
});
