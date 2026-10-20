import { expect, test } from '@playwright/test';
import { signupViaUi, uid, verifyEmailViaLink } from './helpers';

const en = {
  cookies: [
    {
      name: 'NEXT_LOCALE',
      value: 'en',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ],
  origins: [],
};
test.use({ storageState: en });

// Smallest valid PNG (1×1); the API checks the magic bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const shots = process.env.E2E_SHOTS;

test('portfolio + FAQ: blogger adds work → admin approves → brand sees it and gets it with the application', async ({
  browser,
}) => {
  const id = uid();
  const newPage = async () => (await browser.newContext({ storageState: en })).newPage();

  // ── Verified blogger ──
  const blogger = await newPage();
  const bloggerEmail = `portfolio-blogger-${id}@e2e.test`;
  await signupViaUi(blogger, 'INFLUENCER', bloggerEmail);
  await blogger.getByLabel('Name').fill('Portfolio Blogger');
  await blogger.getByRole('checkbox', { name: 'Food' }).click();
  await blogger.getByLabel('Contact method').selectOption('TELEGRAM');
  await blogger.getByLabel('Username or phone').fill('@portfolio_blogger');
  await blogger.getByRole('button', { name: 'Save and continue' }).click();
  await blogger.waitForURL('**/influencer/verification');
  await verifyEmailViaLink(blogger, bloggerEmail);
  await blogger.request.post('/api/v1/billing/plan', { data: { plan: 'BASIC' } });
  await blogger.goto('/influencer/verification');
  await blogger.getByRole('link', { name: 'Connect Instagram' }).click();
  await expect(blogger.getByText('Instagram connected')).toBeVisible();
  await blogger.getByRole('button', { name: 'Send for review' }).click();
  const admin = await newPage();
  await admin.request.post('/api/v1/auth/login', {
    data: { email: 'admin@briefluence.local', password: 'Admin12345' },
  });
  const queue = await (await admin.request.get('/api/v1/admin/verifications')).json();
  const profileId = queue.find((p: { email: string }) => p.email === bloggerEmail).id as string;
  await admin.request.post(`/api/v1/admin/verifications/${profileId}/approve`);

  // ── Blogger adds a work and answers one question ──
  await blogger.goto('/influencer/account');
  await expect(blogger.getByText('No work added yet')).toBeVisible();
  await blogger.getByRole('button', { name: 'Add work' }).click();
  await blogger
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: PNG });
  await expect(blogger.getByRole('dialog').getByRole('button', { name: 'Change' })).toBeVisible();
  await blogger.getByLabel('Title').fill(`Story for a coffee shop ${id}`);
  await blogger.getByLabel('Link').fill('https://www.instagram.com/p/abc123/');
  await blogger.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(blogger.getByText('In review')).toBeVisible();
  await blogger.getByLabel('Who is your audience?').fill('Women 20–30 in Yerevan who love food');
  await blogger.getByRole('button', { name: 'Save' }).last().click();
  await expect(blogger.getByText('Saved', { exact: true }).first()).toBeVisible();
  if (shots) await blogger.screenshot({ path: `${shots}/settings.png`, fullPage: true });

  // ── Admin approves it in the review queue ──
  await admin.goto('/admin/portfolio');
  const card = admin
    .locator('div')
    .filter({ hasText: `Story for a coffee shop ${id}` })
    .last();
  await expect(card).toBeVisible();
  if (shots) await admin.screenshot({ path: `${shots}/admin.png`, fullPage: true });
  await admin.getByRole('button', { name: 'Approve' }).first().click();
  await expect(admin.getByText('Nothing to review')).toBeVisible();

  // ── Brand with a live brief ──
  const brand = await newPage();
  const brandEmail = `portfolio-brand-${id}@e2e.test`;
  await signupViaUi(brand, 'BRAND', brandEmail);
  await verifyEmailViaLink(brand, brandEmail);
  await brand.goto('/brand/onboarding');
  await brand.getByLabel('Brand name').fill(`Portfolio Cafe ${id}`);
  await brand.getByLabel('Contact person').fill('Karen');
  await brand.getByLabel('Contact method').selectOption('WHATSAPP');
  await brand.getByLabel('Phone number').fill('+374 91 222333');
  await brand.getByRole('button', { name: 'Save and post a brief' }).click();
  await brand.waitForURL('**/brand/deals/new');
  const deal = await (
    await brand.request.post('/api/v1/deals', {
      data: {
        title: `Reels for a coffee shop ${id}`,
        description: 'Film a short Reel about our new coffee bar and the people who come here.',
        platforms: ['INSTAGRAM'],
        contentFormats: ['REEL'],
        niches: ['food'],
        countries: ['AM'],
        cities: [],
        languages: [],
        paymentType: 'MONEY',
        budgetMin: 3_000_000,
        budgetMax: 5_000_000,
        currency: 'AMD',
        slots: 1,
        applicationDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      },
    })
  ).json();
  await brand.request.post(`/api/v1/deals/${deal.id}/publish`);
  await admin.request.post(`/api/v1/admin/deals/${deal.id}/approve`);

  // ── Blogger applies with the approved work attached ──
  await blogger.goto(`/influencer/deals/${deal.id}`);
  await blogger.getByRole('button', { name: 'Apply' }).first().click();
  await blogger.getByLabel('Your pitch').fill('Hi! I film food Reels in Yerevan every week.');
  await blogger.getByRole('checkbox', { name: `Story for a coffee shop ${id}` }).click();
  if (shots) await blogger.screenshot({ path: `${shots}/apply.png` });
  await blogger.getByRole('button', { name: 'Send application' }).click();
  await expect(blogger.getByRole('dialog')).toBeHidden();

  // ── Brand sees the attached work on the application and the profile ──
  await brand.goto(`/brand/deals/${deal.id}/applicants`);
  await expect(brand.getByText('Attached work')).toBeVisible();
  await expect(brand.getByRole('button', { name: `Story for a coffee shop ${id}` })).toBeVisible();
  if (shots) await brand.screenshot({ path: `${shots}/applicants.png`, fullPage: true });
  if (shots) {
    await brand.setViewportSize({ width: 375, height: 900 });
    await brand.screenshot({ path: `${shots}/applicants-m.png` });
    await brand.setViewportSize({ width: 1280, height: 720 });
  }
  await brand.goto(`/brand/influencers/${profileId}`);
  await expect(brand.getByRole('heading', { name: 'FAQ' })).toBeVisible();
  await brand.getByText('Who is your audience?').click();
  await expect(brand.getByText('Women 20–30 in Yerevan who love food')).toBeVisible();
  // Unanswered questions stay hidden.
  await expect(brand.getByText('What brands have you worked with?')).toHaveCount(0);
  await expect(brand.getByRole('link', { name: 'instagram.com' })).toBeVisible();
  if (shots) await brand.screenshot({ path: `${shots}/brand.png`, fullPage: true });

  // ── The blogger card on an offer page shows the same portfolio and FAQ ──
  const offer = await (
    await blogger.request.post('/api/v1/offers', {
      data: {
        title: `1 Story ${id}`,
        description: 'One Instagram story about your place with a link sticker.',
        priceMinor: 1_000_000,
        currency: 'AMD',
        collaborationType: 'ONE_TIME',
        platforms: ['INSTAGRAM'],
        contentFormats: ['STORY'],
        niches: ['food'],
      },
    })
  ).json();
  await blogger.request.post(`/api/v1/offers/${offer.id}/publish`);
  await admin.request.post(`/api/v1/admin/offers/${offer.id}/approve`);
  await brand.goto(`/brand/offers/${offer.id}`);
  await expect(brand.getByRole('button', { name: `Story for a coffee shop ${id}` })).toBeVisible();
  await brand.getByText('Who is your audience?').click();
  await expect(brand.getByText('Women 20–30 in Yerevan who love food')).toBeVisible();
  if (shots) await brand.screenshot({ path: `${shots}/offer.png`, fullPage: true });
});
