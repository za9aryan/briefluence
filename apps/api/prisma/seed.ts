/**
 * Dev seed: 1 admin, 5 brands, 30 influencers with fake stats, 20 deals, sample applications.
 * Wipes existing data first. Refuses to run in production.
 *
 * Logins (password for all non-admin users: Password123):
 *   admin:       ADMIN_EMAIL / ADMIN_PASSWORD from .env
 *   brands:      brand1@briefluence.local … brand5@briefluence.local
 *   influencers: influencer1@briefluence.local … influencer30@briefluence.local
 *                (1–24 approved, 25–27 pending review, 28–30 draft;
 *                 1–20 have started the free month, 21–30 have not — they see the "start" step)
 */
import { faker } from '@faker-js/faker';
import {
  CITIES,
  CONTENT_FORMATS,
  NICHES,
  matchScore,
  startTrial,
  addDays,
  type ContentFormat,
  type Platform,
} from '@briefluence/shared';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { CryptoService } from '../src/common/crypto.service';
import { loadEnv } from '../src/config/env';
import { toMatchDeal, toMatchInfluencer } from '../src/modules/deals/match-input';

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');

const prisma = new PrismaClient();
const crypto = new CryptoService(env);
faker.seed(42);

const PASSWORD = 'Password123';
const AM_CITIES = CITIES.AM!;
const pickSome = <T>(arr: readonly T[], min: number, max: number) =>
  faker.helpers.arrayElements(arr as T[], faker.number.int({ min, max }));

function audience(platform: Platform) {
  if (platform === 'TIKTOK') return { audienceGender: Prisma.DbNull, audienceAge: Prisma.DbNull, audienceCountries: Prisma.DbNull };
  const female = faker.number.int({ min: 25, max: 80 });
  const young = faker.number.int({ min: 20, max: 45 });
  return {
    audienceGender: { male: 100 - female, female },
    audienceAge: { '13-17': 5, '18-24': young, '25-34': 75 - young - 10, '35-44': 12, '45-54': 5, '55-64': 2, '65+': 1 },
    audienceCountries: { AM: faker.number.int({ min: 50, max: 85 }), RU: 8, US: 5, FR: 2 },
  };
}

async function wipe() {
  await prisma.$transaction([
    prisma.feedSearch.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.application.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.socialAccount.deleteMany(),
    prisma.influencerProfile.deleteMany(),
    prisma.brandProfile.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  await wipe();
  const now = new Date();
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const adminHash = await argon2.hash(env.ADMIN_PASSWORD, { type: argon2.argon2id });

  await prisma.user.create({
    data: { email: env.ADMIN_EMAIL.toLowerCase(), passwordHash: adminHash, role: 'ADMIN', emailVerifiedAt: now },
  });

  // ─── Brands ────────────────────────────────────────────
  const brandNames = ['Yerevan Roasters', 'Ararat Cosmetics', 'Sevan Sportswear', 'Gyumri Bakery', 'Dilijan Eco Resort'];
  const brands = [];
  for (const [i, companyName] of brandNames.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `brand${i + 1}@briefluence.local`,
        passwordHash: hash,
        role: 'BRAND',
        emailVerifiedAt: now,
        brand: {
          create: {
            companyName,
            website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.am`,
            instagramUrl: `https://www.instagram.com/${companyName.toLowerCase().replace(/\s+/g, '_')}`,
            description: faker.company.catchPhrase() + '. ' + faker.lorem.sentences(2),
            country: 'AM',
            city: faker.helpers.arrayElement(AM_CITIES.slice(0, 4)),
            contactName: faker.person.fullName(),
            contactPosition: faker.helpers.arrayElement(['Marketing manager', 'PR manager', 'Founder', 'SMM specialist']),
            contactMethod: (['TELEGRAM', 'WHATSAPP', 'PHONE', 'INSTAGRAM', 'VIBER'] as const)[i],
            contactValue: i === 0 ? 'yerevan_roasters' : i === 3 ? 'gyumri.bakery' : `+3749${faker.string.numeric(7)}`,
          },
        },
      },
      include: { brand: true },
    });
    brands.push(user.brand!);
  }

  // ─── Influencers ───────────────────────────────────────
  const influencers = [];
  for (let i = 1; i <= 30; i++) {
    const status = i <= 24 ? 'APPROVED' : i <= 27 ? 'PENDING_REVIEW' : 'DRAFT';
    const gender = faker.helpers.arrayElement(['MALE', 'FEMALE', 'FEMALE'] as const);
    const firstName = faker.person.firstName(gender === 'MALE' ? 'male' : 'female');
    const platforms = pickSome<Platform>(['INSTAGRAM', 'TIKTOK', 'YOUTUBE'], 1, 2);
    if (i === 1 && !platforms.includes('INSTAGRAM')) platforms.unshift('INSTAGRAM');
    const trial = startTrial(addDays(now, -faker.number.int({ min: 0, max: 20 })));
    const user = await prisma.user.create({
      data: {
        email: `influencer${i}@briefluence.local`,
        passwordHash: hash,
        role: 'INFLUENCER',
        emailVerifiedAt: i === 30 ? null : now,
        // The free month is opt-in: only bloggers 1–20 have started it.
        ...(i <= 20 ? { subscription: { create: { status: trial.status, trialEndsAt: trial.trialEndsAt } } } : {}),
        influencer: {
          create: {
            displayName: `${firstName} ${faker.person.lastName()}`,
            bio: faker.lorem.sentence({ min: 8, max: 16 }),
            country: 'AM',
            city: faker.helpers.weightedArrayElement([
              { weight: 6, value: 'Yerevan' },
              { weight: 1, value: 'Gyumri' },
              { weight: 1, value: 'Vanadzor' },
              { weight: 1, value: 'Dilijan' },
            ]),
            gender,
            birthYear: faker.number.int({ min: 1985, max: 2006 }),
            languages: pickSome(['hy', 'ru', 'en'], 1, 3),
            niches: pickSome(NICHES, 1, 3),
            contactEmail: `${firstName.toLowerCase()}${i}@mail.am`,
            contactPhone: `+374 ${faker.string.numeric(2)} ${faker.string.numeric(6)}`,
            telegram: `@${firstName.toLowerCase()}_${i}`,
            status,
            approvedAt: status === 'APPROVED' ? now : null,
            submittedAt: status !== 'DRAFT' ? addDays(now, -1) : null,
            profileViews: faker.number.int({ min: 0, max: 120 }),
            socialAccounts: {
              create: platforms.map((platform) => {
                const followers = faker.helpers.weightedArrayElement([
                  { weight: 4, value: faker.number.int({ min: 1_500, max: 10_000 }) },
                  { weight: 4, value: faker.number.int({ min: 10_000, max: 50_000 }) },
                  { weight: 2, value: faker.number.int({ min: 50_000, max: 400_000 }) },
                  { weight: 1, value: faker.number.int({ min: 500_000, max: 1_200_000 }) },
                ]);
                const username = `${firstName.toLowerCase()}.${platform.toLowerCase()}${i}`;
                const profileUrl = {
                  INSTAGRAM: `https://www.instagram.com/${username}`,
                  TIKTOK: `https://www.tiktok.com/@${username}`,
                  YOUTUBE: `https://www.youtube.com/@${username}`,
                }[platform];
                return {
                  platform,
                  externalId: `seed-${platform}-${i}`,
                  username,
                  profileUrl,
                  followers,
                  mediaCount: faker.number.int({ min: 30, max: 900 }),
                  avgViews: Math.round(followers * faker.number.float({ min: 0.1, max: 0.6 })),
                  engagementRate: faker.number.float({ min: 0.8, max: 9, fractionDigits: 2 }),
                  ...audience(platform),
                  accessTokenEnc: crypto.encrypt(`${platform}:mock-seed-${i}`),
                  lastSyncedAt: now,
                };
              }),
            },
          },
        },
      },
      include: { influencer: { include: { socialAccounts: true } } },
    });
    influencers.push(user.influencer!);
  }

  // ─── Deals ─────────────────────────────────────────────
  const titles = [
    'Reel about our new seasonal coffee',
    'Morning routine with our skincare line',
    'Gym outfit try-on haul',
    'Weekend breakfast at our bakery',
    'Stay & review: forest cabin weekend',
    'Unboxing our holiday gift box',
    'Running challenge with our sneakers',
    'Tasting video: 5 new pastries',
    'Story series: spa day at the resort',
    'Make-up tutorial with the new palette',
  ];
  const deals = [];
  for (let i = 0; i < 20; i++) {
    const brand = brands[i % brands.length]!;
    const paymentType = faker.helpers.arrayElement(['MONEY', 'BARTER', 'MIXED'] as const);
    const status = i < 14 ? 'ACTIVE' : i < 16 ? 'DRAFT' : i < 18 ? 'PAUSED' : 'CLOSED';
    const platforms = pickSome<Platform>(['INSTAGRAM', 'TIKTOK', 'YOUTUBE'], 1, 2);
    // Most briefs in AMD; some in USD / RUB to show display conversion.
    const currency = faker.helpers.weightedArrayElement([
      { weight: 6, value: 'AMD' },
      { weight: 2, value: 'USD' },
      { weight: 2, value: 'RUB' },
    ] as const);
    const budgetMin =
      currency === 'AMD'
        ? faker.number.int({ min: 20, max: 100 }) * 1_000_00
        : currency === 'USD'
          ? faker.number.int({ min: 5, max: 25 }) * 10_00
          : faker.number.int({ min: 5, max: 25 }) * 1_000_00;
    const sizePreset = faker.helpers.arrayElement([
      [null, null],
      [1_000, 10_000],
      [10_000, 50_000],
      [50_000, 500_000],
      [5_000, null],
    ] as const);
    deals.push(
      await prisma.deal.create({
        data: {
          brandId: brand.id,
          title: `${titles[i % titles.length]}${i >= titles.length ? ' — round 2' : ''}`,
          description: faker.lorem.paragraphs(2),
          platforms,
          contentFormats: pickSome<ContentFormat>(CONTENT_FORMATS, 1, 2),
          niches: pickSome(NICHES, 0, 2),
          countries: ['AM'],
          cities: i % 4 === 0 ? ['Yerevan'] : [],
          languages: pickSome(['hy', 'ru', 'en'], 0, 2),
          minFollowers: sizePreset[0],
          maxFollowers: sizePreset[1],
          minEngagementRate: faker.helpers.arrayElement([null, 2, 3, 4]),
          influencerGender: faker.helpers.arrayElement(['ANY', 'ANY', 'ANY', 'FEMALE', 'MALE'] as const),
          influencerAgeMin: i % 5 === 0 ? 18 : null,
          influencerAgeMax: i % 5 === 0 ? 35 : null,
          audienceGender: faker.helpers.arrayElement(['ANY', 'ANY', 'FEMALE'] as const),
          audienceAgeMin: i % 3 === 0 ? 18 : null,
          audienceAgeMax: i % 3 === 0 ? 34 : null,
          audienceCountry: i % 2 === 0 ? 'AM' : null,
          paymentType,
          budgetMin: paymentType === 'BARTER' ? null : budgetMin,
          budgetMax: paymentType === 'BARTER' ? null : budgetMin * 2,
          currency,
          barterDescription: paymentType === 'MONEY' ? null : faker.helpers.arrayElement([
            'Dinner for two and a gift box',
            'Full skincare set',
            'Two-night stay for two',
            'Sneakers + sportswear set',
          ]),
          barterValue: paymentType === 'MONEY' ? null : Math.round((faker.number.int({ min: 20, max: 150 }) * 1_000_00 * { AMD: 1, USD: 1 / 390, RUB: 1 / 4.5 }[currency])),
          slots: faker.number.int({ min: 1, max: 5 }),
          applicationDeadline: addDays(now, status === 'CLOSED' ? -2 : faker.number.int({ min: 5, max: 30 })),
          publishBy: addDays(now, 40),
          status,
          publishedAt: status === 'DRAFT' ? null : addDays(now, -faker.number.int({ min: 0, max: 5 })),
        },
      }),
    );
  }

  // ─── Applications ──────────────────────────────────────
  const approved = influencers.filter((p) => p.status === 'APPROVED');
  let count = 0;
  for (const deal of deals.filter((d) => d.status === 'ACTIVE' || d.status === 'CLOSED')) {
    const md = toMatchDeal({ ...deal, status: 'ACTIVE' });
    for (const p of faker.helpers.shuffle(approved).slice(0, 8)) {
      const match = matchScore(md, toMatchInfluencer(p));
      if (!match) continue;
      const status = faker.helpers.weightedArrayElement([
        { weight: 4, value: 'APPLIED' },
        { weight: 2, value: 'VIEWED' },
        { weight: 2, value: 'SHORTLISTED' },
        { weight: 1, value: 'ACCEPTED' },
        { weight: 1, value: 'REJECTED' },
      ] as const);
      await prisma.application.create({
        data: {
          dealId: deal.id,
          influencerId: p.id,
          socialAccountId: match.accountId,
          pitch: faker.lorem.sentences({ min: 2, max: 4 }).slice(0, 480),
          proposedPrice: deal.paymentType === 'BARTER' ? null : deal.budgetMin,
          matchScore: match.score,
          status,
          rejectionReason: status === 'REJECTED' ? 'BUDGET' : null,
        },
      });
      count++;
    }
  }

  // ─── Feed searches (for brand insights) ────────────────
  const searchers = influencers.filter((p) => p.status === 'APPROVED');
  const searches = [];
  for (let d = 0; d < 60; d++) {
    // More activity on recent days and on weekends.
    const day = addDays(now, -d);
    const weekend = [0, 6].includes(day.getUTCDay());
    const n = Math.round((weekend ? 16 : 10) * (1 - d / 120) + faker.number.int({ min: 0, max: 6 }));
    for (let k = 0; k < n; k++) {
      const p = faker.helpers.arrayElement(searchers);
      searches.push({
        influencerId: p.id,
        platforms: faker.helpers.weightedArrayElement([
          { weight: 5, value: ['INSTAGRAM'] },
          { weight: 2, value: ['TIKTOK'] },
          { weight: 1, value: ['YOUTUBE'] },
          { weight: 2, value: ['INSTAGRAM', 'TIKTOK'] },
          { weight: 2, value: [] },
        ]) as Platform[],
        niches: faker.datatype.boolean(0.7) ? pickSome(p.niches.length ? p.niches : NICHES, 1, 2) : [],
        cities: faker.datatype.boolean(0.4) ? [faker.helpers.weightedArrayElement([{ weight: 6, value: 'Yerevan' }, { weight: 1, value: 'Gyumri' }, { weight: 1, value: 'Vanadzor' }, { weight: 1, value: 'Dilijan' }])] : [],
        paymentTypes: faker.helpers.weightedArrayElement([
          { weight: 4, value: ['MONEY'] },
          { weight: 3, value: ['BARTER'] },
          { weight: 2, value: ['MIXED'] },
          { weight: 3, value: [] },
        ]) as ('MONEY' | 'BARTER' | 'MIXED')[],
        budgetMin: faker.datatype.boolean(0.35) ? faker.helpers.arrayElement([10_000, 30_000, 50_000, 80_000, 150_000, 300_000]) * 100 : null,
        createdAt: new Date(day.getTime() - faker.number.int({ min: 0, max: 86_000_000 })),
      });
    }
  }
  await prisma.feedSearch.createMany({ data: searches });

  console.log(`Seeded: 1 admin, ${brands.length} brands, ${influencers.length} influencers, ${deals.length} deals, ${count} applications, ${searches.length} feed searches`);
  console.log(`Logins: ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}; brand1@briefluence.local / ${PASSWORD}; influencer1@briefluence.local / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
