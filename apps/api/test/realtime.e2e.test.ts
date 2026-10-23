import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API, createAdmin, createTestApp, resetDb, signup, type TestCtx } from './helpers';

/** Session cookies of a fresh login, as a Cookie header for the socket handshake. */
async function cookieFor(ctx: TestCtx, email: string, password: string) {
  const res = await ctx.http().post(`${API}/auth/login`).send({ email, password }).expect(200);
  return (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
}

describe('live notifications (e2e)', () => {
  let ctx: TestCtx;
  let port: number;
  const sockets: Socket[] = [];
  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
    port = (ctx.app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(async () => {
    for (const s of sockets) s.close();
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  const connect = async (cookie: string) => {
    const s = io(`http://localhost:${port}`, {
      path: '/api/v1/ws',
      transports: ['websocket'],
      extraHeaders: { cookie },
    });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.on('connect', () => resolve());
      s.on('connect_error', reject);
    });
    return s;
  };
  const next = (s: Socket) =>
    new Promise<{ kind: string; id?: string }>((resolve) =>
      s.once('notifications:update', resolve),
    );

  it('a new notification reaches every open tab of that user only; reading syncs the tabs', async () => {
    const user = await signup(ctx, 'BRAND');
    const other = await signup(ctx, 'INFLUENCER');
    const admin = await createAdmin(ctx);
    const tab1 = await connect(await cookieFor(ctx, user.email, 'secret123'));
    const tab2 = await connect(await cookieFor(ctx, user.email, 'secret123'));
    const stranger = await connect(await cookieFor(ctx, other.email, 'secret123'));
    let strangerGot = false;
    stranger.on('notifications:update', () => (strangerGot = true));

    // Something that notifies the user: support answers their question.
    const t = await user.agent
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'Hi' })
      .expect(201);
    const got = Promise.all([next(tab1), next(tab2)]);
    await admin.agent
      .post(`${API}/admin/support/${t.body.ticket.id}/messages`)
      .send({ body: 'Hello!' })
      .expect(201);
    const [a, b] = await got;
    expect(a.kind).toBe('new');
    expect(b.id).toBe(a.id);

    const read = next(tab2);
    await user.agent.post(`${API}/notifications/read-all`).expect(204);
    expect((await read).kind).toBe('read');
    expect(strangerGot).toBe(false);
  });
});
