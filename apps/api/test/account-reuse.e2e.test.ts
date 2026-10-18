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

describe('re-registration warning (e2e)', () => {
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
    const b = await signup(ctx, 'INFLUENCER');
    await b.agent.put(`${API}/influencers/me`).send(influencerProfile).expect(200);
    return b;
  }

  it('flags an account that was linked to another user before; admin sees the history and decides', async () => {
    const admin = await createAdmin(ctx);
    const first = await blogger();
    const acc = await first.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'INSTAGRAM', username: 'fake_acc', followers: 9000 })
      .expect(201);
    expect((await admin.agent.get(`${API}/admin/accounts?status=REUSED`).expect(200)).body).toEqual(
      [],
    );
    await first.agent.delete(`${API}/social/accounts/${acc.body.id}`).expect(204);

    // A "new" blogger adds the same handle: works normally, but admins are warned.
    const second = await blogger();
    const again = await second.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'INSTAGRAM', username: '@Fake_Acc', followers: 9100 })
      .expect(201);
    expect(again.body).not.toHaveProperty('reuseWarning');
    const notes = await admin.agent.get(`${API}/notifications`).expect(200);
    expect(notes.body.items[0].type).toBe('SOCIAL_ACCOUNT_REUSED');

    const reused = (await admin.agent.get(`${API}/admin/accounts?status=REUSED`).expect(200)).body;
    expect(reused.map((a: { id: string }) => a.id)).toEqual([again.body.id]);
    expect(reused[0].reuseWarning).toBe(true);
    const users = (await admin.agent.get(`${API}/admin/users?role=INFLUENCER`).expect(200)).body;
    expect(users.find((u: { email: string }) => u.email === second.email).reuseWarnings).toEqual([
      again.body.id,
    ]);
    expect(users.find((u: { email: string }) => u.email === first.email).reuseWarnings).toEqual([]);

    const history = (
      await admin.agent.get(`${API}/admin/accounts/${again.body.id}/history`).expect(200)
    ).body;
    expect(history.links).toHaveLength(2);
    expect(history.links[0]).toMatchObject({
      email: second.email,
      current: true,
      unlinkedAt: null,
    });
    expect(history.links[1]).toMatchObject({ email: first.email, current: false });
    expect(history.links[1].unlinkedAt).not.toBeNull();

    // Only admins; "Allow" clears the warning.
    await second.agent.get(`${API}/admin/accounts/${again.body.id}/history`).expect(403);
    await admin.agent.post(`${API}/admin/accounts/${again.body.id}/allow-reuse`).expect(204);
    expect((await admin.agent.get(`${API}/admin/accounts?status=REUSED`).expect(200)).body).toEqual(
      [],
    );

    // A third user with the same handle raises it again; the admin can reject the account.
    const third = await blogger();
    const third1 = await third.agent
      .post(`${API}/social/accounts/manual`)
      .send({ platform: 'INSTAGRAM', username: 'fake_acc', followers: 1 })
      .expect(409); // still taken by the second
    expect(third1.body.error.code).toBe('SOCIAL_ACCOUNT_TAKEN');
    await admin.agent
      .post(`${API}/admin/accounts/${again.body.id}/reject`)
      .send({ reason: 'Linked to another account before.' })
      .expect(204);
    const mine = (await second.agent.get(`${API}/influencers/me`).expect(200)).body
      .socialAccounts[0];
    expect(mine).toMatchObject({
      reviewStatus: 'REJECTED',
      reviewNote: 'Linked to another account before.',
    });
  });
});
