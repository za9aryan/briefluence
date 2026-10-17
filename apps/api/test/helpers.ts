import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@briefluence/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { Clock } from '../src/common/clock';
import { PrismaService } from '../src/common/prisma.service';
import { loadEnv } from '../src/config/env';
import { QueueService } from '../src/queue/queue.service';
import { EmailService } from '../src/modules/notifications/email.service';

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
  clock: Clock;
  queue: QueueService;
  email: EmailService;
  http: () => ReturnType<typeof request>;
  agent: () => ReturnType<typeof request.agent>;
}

export async function createTestApp(): Promise<TestCtx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, loadEnv());
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    clock: app.get(Clock),
    queue: app.get(QueueService),
    email: app.get(EmailService),
    http: () => request(app.getHttpServer()),
    agent: () => request.agent(app.getHttpServer()),
  };
}

export async function resetDb(prisma: PrismaService) {
  const tables = [
    'AuthIdentity',
    'DealView',
    'ExchangeRate',
    'FeedSearch',
    'Notification',
    'Payment',
    'Subscription',
    'Application',
    'Deal',
    'SocialAccount',
    'InfluencerProfile',
    'BrandProfile',
    'RefreshToken',
    'User',
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export const API = '/api/v1';
let counter = 0;

/** Signs up a user, marks the email verified, and returns a cookie-keeping agent. */
export async function signup(
  ctx: TestCtx,
  role: Exclude<Role, 'ADMIN'>,
  opts: { verified?: boolean } = {},
) {
  const agent = ctx.agent();
  const email = `${role.toLowerCase()}${++counter}-${Date.now()}@test.am`;
  const res = await agent
    .post(`${API}/auth/signup`)
    .send({ email, password: 'secret123', role, acceptTerms: true });
  if (res.status !== 201)
    throw new Error(`signup failed ${res.status} ${JSON.stringify(res.body)}`);
  if (opts.verified !== false) {
    await ctx.prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
    await agent.post(`${API}/auth/login`).send({ email, password: 'secret123' }).expect(200);
  }
  return { agent, email, id: res.body.id as string };
}

export async function createAdmin(ctx: TestCtx) {
  const argon2 = await import('argon2');
  const email = `admin${++counter}@test.am`;
  await ctx.prisma.user.create({
    data: {
      email,
      role: 'ADMIN',
      passwordHash: await argon2.hash('Admin12345'),
      emailVerifiedAt: new Date(),
    },
  });
  const agent = ctx.agent();
  await agent.post(`${API}/auth/login`).send({ email, password: 'Admin12345' }).expect(200);
  return { agent, email };
}

export const influencerProfile = {
  displayName: 'Anna Petrosyan',
  country: 'AM',
  city: 'Yerevan',
  gender: 'FEMALE',
  birthYear: 1998,
  languages: ['hy', 'en'],
  niches: ['beauty', 'lifestyle'],
  contactMethod: 'TELEGRAM',
  contactValue: '@anna',
};

export const brandProfile = {
  companyName: 'Ararat Cosmetics',
  country: 'AM',
  city: 'Yerevan',
  website: 'https://ararat.am',
  instagramUrl: 'https://instagram.com/ararat',
  contactName: 'Karen',
  contactPosition: 'PR manager',
  contactMethod: 'TELEGRAM',
  contactValue: '@ararat_pr',
};

export const dealInput = (over: Record<string, unknown> = {}) => ({
  title: 'Skincare reel campaign',
  description: 'Show your morning routine with our new skincare line in a short reel.',
  platforms: ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'],
  contentFormats: ['REEL'],
  niches: ['beauty'],
  countries: ['AM'],
  cities: [],
  languages: ['hy'],
  paymentType: 'MONEY',
  budgetMin: 5_000_000,
  budgetMax: 10_000_000,
  currency: 'AMD',
  slots: 1,
  applicationDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
  ...over,
});

/** Runs the mock OAuth round trip: connect → (fake consent) → callback. */
export async function connectMock(
  ctx: TestCtx,
  agent: ReturnType<typeof request.agent>,
  platform = 'instagram',
) {
  const connect = await agent.get(`${API}/social/${platform}/connect`).expect(302);
  const url = new URL(connect.headers.location as string);
  const callback = await agent.get(`${API}/social/${platform}/callback${url.search}`).expect(302);
  return new URL(callback.headers.location as string);
}

/** Last email sent to an address (log transport). */
export async function lastEmailTo(ctx: TestCtx, to: string) {
  await ctx.queue.drain();
  return [...ctx.email.outbox].reverse().find((e) => e.to === to);
}
