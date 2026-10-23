import type { AddressInfo } from 'node:net';
import { io } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobsService } from '../src/modules/jobs/jobs.service';
import {
  API,
  createAdmin,
  createTestApp,
  lastEmailTo,
  resetDb,
  signup,
  type TestCtx,
} from './helpers';

const DAY = 86_400_000;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('support chat (e2e)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.clock.reset();
  });

  it('guest: email required → ticket → admin replies by email link → guest continues on another device', async () => {
    const admin = await createAdmin(ctx);
    const guest = ctx.agent();
    await guest
      .post(`${API}/support/tickets`)
      .send({ topic: 'ACCOUNT', body: 'I cannot log in' })
      .expect(400);
    const started = await guest
      .post(`${API}/support/tickets`)
      .set('Cookie', 'NEXT_LOCALE=ru')
      .send({
        topic: 'ACCOUNT',
        body: 'I cannot log in',
        guestEmail: 'Anna@Mail.am',
        guestName: 'Anna',
      })
      .expect(201);
    expect(started.body.ticket).toMatchObject({ status: 'OPEN', guestEmail: 'anna@mail.am' });
    expect(String(started.headers['set-cookie'])).toContain('bf_support=');
    const ticketId = started.body.ticket.id as string;
    const current = await guest.get(`${API}/support/current`).expect(200);
    expect(current.body.messages).toHaveLength(1);

    // Another visitor without the cookie sees nothing and cannot post.
    expect((await ctx.http().get(`${API}/support/current`).expect(200)).body.ticket).toBeNull();
    await ctx
      .http()
      .post(`${API}/support/tickets/${ticketId}/messages`)
      .send({ body: 'hi' })
      .expect(404);

    const inbox = (await admin.agent.get(`${API}/admin/support?box=unassigned`).expect(200)).body;
    expect(inbox.counts.unassigned).toBe(1);
    expect(inbox.items[0]).toMatchObject({
      id: ticketId,
      unread: true,
      person: { kind: 'GUEST', name: 'Anna' },
    });
    expect(await ctx.prisma.notification.count({ where: { type: 'SUPPORT_NEW_TICKET' } })).toBe(1);

    // Admin answers: the ticket becomes theirs, waits for the guest, and an email goes out in Russian.
    await admin.agent
      .post(`${API}/admin/support/${ticketId}/messages`)
      .send({ body: 'Try resetting your password.' })
      .expect(201);
    const detail = (await admin.agent.get(`${API}/admin/support/${ticketId}`).expect(200)).body;
    expect(detail.status).toBe('ANSWERED');
    expect(detail.assignee.email).toBe(admin.email);
    const mail = await lastEmailTo(ctx, 'anna@mail.am');
    expect(mail?.subject).toContain('Ответ поддержки');
    const link = /\/support\?t=([^"&\s]+)/.exec(mail!.html)!;
    expect(link).toBeTruthy();

    // The link works on a new device: sets the cookie and shows the reply.
    const phone = ctx.agent();
    const resumed = await phone
      .post(`${API}/support/resume`)
      .send({ token: decodeURIComponent(link[1]!) })
      .expect(201);
    expect(resumed.body.ticket.unread).toBe(true);
    await phone
      .post(`${API}/support/tickets/${ticketId}/messages`)
      .send({ body: 'It worked, thanks!' })
      .expect(201);
    expect((await phone.get(`${API}/support/current`).expect(200)).body.ticket.status).toBe('OPEN');
    await ctx
      .http()
      .post(`${API}/support/resume`)
      .send({ token: 'x'.repeat(40) })
      .expect(401);

    // Closed tickets take no more messages.
    await admin.agent.post(`${API}/admin/support/${ticketId}/close`).expect(200);
    await phone
      .post(`${API}/support/tickets/${ticketId}/messages`)
      .send({ body: 'one more' })
      .expect(409);
  });

  it('signed-in user: one open ticket at a time, private to them; assignment; auto-close after 7 days', async () => {
    const user = await signup(ctx, 'BRAND');
    const other = await signup(ctx, 'INFLUENCER');
    const started = await user.agent
      .post(`${API}/support/tickets`)
      .send({ topic: 'PAYMENTS', body: 'Charged twice?' })
      .expect(201);
    const id = started.body.ticket.id as string;
    await user.agent
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'again' })
      .expect(409);
    await other.agent
      .post(`${API}/support/tickets/${id}/messages`)
      .send({ body: 'peek' })
      .expect(404);
    expect((await other.agent.get(`${API}/support/current`).expect(200)).body.ticket).toBeNull();

    const a1 = await createAdmin(ctx);
    const a2 = await createAdmin(ctx);
    const a2id = (await ctx.prisma.user.findUniqueOrThrow({ where: { email: a2.email } })).id;
    await a1.agent.post(`${API}/admin/support/${id}/assign`).send({ assigneeId: a2id }).expect(200);
    expect(
      await ctx.prisma.notification.count({ where: { userId: a2id, type: 'SUPPORT_ASSIGNED' } }),
    ).toBe(1);
    expect(
      (await a2.agent.get(`${API}/admin/support?box=mine`).expect(200)).body.items,
    ).toHaveLength(1);
    await a1.agent
      .post(`${API}/admin/support/${id}/assign`)
      .send({ assigneeId: user.id })
      .expect(400);

    // The user's own message only notifies the assignee.
    await user.agent
      .post(`${API}/support/tickets/${id}/messages`)
      .send({ body: 'Any news?' })
      .expect(201);
    const notes = await ctx.prisma.notification.findMany({
      where: { type: 'SUPPORT_USER_MESSAGE' },
    });
    expect(notes.map((n) => n.userId)).toEqual([a2id]);

    await a2.agent
      .post(`${API}/admin/support/${id}/messages`)
      .send({ body: 'Refunded.' })
      .expect(201);
    expect(
      await ctx.prisma.notification.count({ where: { userId: user.id, type: 'SUPPORT_REPLY' } }),
    ).toBe(1);
    expect((await user.agent.get(`${API}/support/current`).expect(200)).body.ticket.unread).toBe(
      true,
    );
    await user.agent.post(`${API}/support/tickets/${id}/read`).expect(204);
    expect((await user.agent.get(`${API}/support/current`).expect(200)).body.ticket.unread).toBe(
      false,
    );

    const jobs = ctx.app.get(JobsService);
    ctx.clock.advance(6 * DAY);
    expect(await jobs.run('support-autoclose')).toEqual({ closed: 0 });
    ctx.clock.advance(2 * DAY);
    expect(await jobs.run('support-autoclose')).toEqual({ closed: 1 });
    // A closed ticket lets the user start a new one.
    await user.agent
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'New question' })
      .expect(201);
  });

  it('spam guards: honeypot, 3 guest tickets per email a day; images must be our uploads', async () => {
    await ctx
      .http()
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'buy now', guestEmail: 'bot@spam.am', website: 'http://spam' })
      .expect(400);
    for (let i = 0; i < 3; i++)
      await ctx
        .agent()
        .post(`${API}/support/tickets`)
        .send({ topic: 'OTHER', body: `question ${i}`, guestEmail: 'same@mail.am' })
        .expect(201);
    await ctx
      .agent()
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'question 4', guestEmail: 'same@mail.am' })
      .expect(429);

    await ctx
      .agent()
      .post(`${API}/support/tickets`)
      .send({
        topic: 'OTHER',
        imageUrl: 'https://elsewhere.example/x.png',
        guestEmail: 'img@mail.am',
      })
      .expect(400);
    const up = await ctx
      .http()
      .post(`${API}/support/attachments`)
      .attach('file', PNG, { filename: 's.png', contentType: 'image/png' })
      .expect(201);
    await ctx
      .agent()
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', imageUrl: up.body.url, guestEmail: 'img@mail.am' })
      .expect(201);
  });

  it('a blocked user can still write as a guest; the admin sees the matching blocked account', async () => {
    const user = await signup(ctx, 'INFLUENCER');
    const admin = await createAdmin(ctx);
    await admin.agent.post(`${API}/admin/users/${user.id}/block`).expect(204);
    const t = await ctx
      .agent()
      .post(`${API}/support/tickets`)
      .send({ topic: 'ACCOUNT', body: 'Why was I blocked?', guestEmail: user.email })
      .expect(201);
    const detail = (await admin.agent.get(`${API}/admin/support/${t.body.ticket.id}`).expect(200))
      .body;
    expect(detail.account).toMatchObject({ id: user.id, blocked: true, matchedByEmail: true });
  });

  it('pushes a live update to admins over WebSocket', async () => {
    const admin = await createAdmin(ctx);
    const login = await ctx
      .http()
      .post(`${API}/auth/login`)
      .send({ email: admin.email, password: 'Admin12345' })
      .expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])
      .map((c) => c.split(';')[0])
      .join('; ');
    const { port } = ctx.app.getHttpServer().address() as AddressInfo;
    const socket = io(`http://localhost:${port}`, {
      path: '/api/v1/ws',
      transports: ['websocket'],
      extraHeaders: { cookie },
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const pushed = new Promise<{ ticketId: string }>((resolve) =>
      socket.on('support:update', resolve),
    );
    const t = await request(ctx.app.getHttpServer())
      .post(`${API}/support/tickets`)
      .send({ topic: 'OTHER', body: 'Hello', guestEmail: 'live@mail.am' })
      .expect(201);
    expect((await pushed).ticketId).toBe(t.body.ticket.id);
    socket.disconnect();

    // No session and no support cookie: the server drops the socket.
    const anon = io(`http://localhost:${port}`, { path: '/api/v1/ws', transports: ['websocket'] });
    await new Promise<void>((resolve) => anon.on('disconnect', () => resolve()));
    anon.close();
  });
});
