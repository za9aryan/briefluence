import { expect, test, type Page } from '@playwright/test';
import { signupViaUi, uid, verifyEmailViaLink, seen } from './helpers';

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

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS)
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png`, fullPage: true });
};

test('blogger picks a username → public page for guests (locked) and brands (full)', async ({
  browser,
}) => {
  const id = uid();
  const username = `e2e.${id}`;
  const title = `1 Reel for your cafe ${id}`;
  const newPage = async () => (await browser.newContext({ storageState: en })).newPage();

  // ── Verified blogger with one live offer ──
  const blogger = await newPage();
  const bloggerEmail = `public-${id}@e2e.test`;
  await signupViaUi(blogger, 'INFLUENCER', bloggerEmail);
  await blogger.getByLabel('Name').fill('Public Blogger');
  await blogger.getByRole('checkbox', { name: 'Food' }).click();
  await blogger.getByRole('button', { name: 'Save and continue' }).click();
  await blogger.waitForURL('**/influencer/verification');
  await verifyEmailViaLink(blogger, bloggerEmail);
  await blogger.request.post('/api/v1/billing/plan', { data: { plan: 'BASIC' } });
  await blogger.goto('/influencer/verification');
  await blogger.getByRole('link', { name: 'Connect Instagram' }).click();
  await expect(seen(blogger, 'Instagram connected')).toBeVisible();
  await blogger.getByRole('button', { name: 'Send for review' }).click();

  const admin = await newPage();
  await admin.request.post('/api/v1/auth/login', {
    data: { email: 'admin@briefluence.local', password: 'Admin12345' },
  });
  const queue = await (await admin.request.get('/api/v1/admin/verifications')).json();
  const mine = queue.find((p: { email: string }) => p.email === bloggerEmail);
  await admin.request.post(`/api/v1/admin/verifications/${mine.id}/approve`);

  const offer = await (
    await blogger.request.post('/api/v1/offers', {
      data: {
        title,
        description: 'One Instagram reel about your place, with a short honest review.',
        priceMinor: 5_000,
        currency: 'USD',
        collaborationType: 'ONE_TIME',
        platforms: ['INSTAGRAM'],
        contentFormats: ['REEL'],
        niches: ['food'],
      },
    })
  ).json();
  await blogger.request.post(`/api/v1/offers/${offer.id}/publish`);
  await admin.request.post(`/api/v1/admin/offers/${offer.id}/approve`);

  // ── Username on the Account page ──
  await blogger.goto('/influencer/account');
  await blogger.getByLabel('Username').fill('admin');
  await blogger.getByRole('button', { name: 'Save' }).first().click();
  await expect(blogger.getByText('This name is reserved. Pick another one.')).toBeVisible();
  await blogger.getByLabel('Username').fill(`@${username.toUpperCase()}`);
  await blogger.getByRole('button', { name: 'Save' }).first().click();
  await expect(blogger.getByText(new RegExp(`/@${username.replace('.', '\\.')}$`))).toBeVisible();
  await expect(blogger.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await blogger.setViewportSize({ width: 360, height: 800 });
  await shot(blogger, 'public-username-card');

  // ── Guest: who the blogger is and their offer, but no stats or price ──
  const guest = await newPage();
  await guest.setViewportSize({ width: 360, height: 800 });
  await guest.goto(`/@${username}`);
  await expect(guest.getByRole('heading', { name: 'Public Blogger' })).toBeVisible();
  await expect(guest).toHaveTitle(/Public Blogger/);
  await expect(
    guest.getByText('Followers, reach and audience are shown to signed-in brands.'),
  ).toBeVisible();
  await expect(guest.getByText('Price after sign-in')).toBeVisible();
  await expect(guest.getByText('$50')).toHaveCount(0);
  await shot(guest, 'public-guest');
  await guest.getByRole('button', { name: title }).click();
  const gate = guest.getByRole('dialog');
  await expect(gate.getByRole('heading', { name: 'Sign in to see more' })).toBeVisible();
  await shot(guest, 'public-guest-gate');
  await gate.getByRole('link', { name: 'Log in' }).click();
  await guest.waitForURL(`**/login?next=${encodeURIComponent(`/@${username}`)}`);

  // ── Brand: the full profile, with the price; the offer opens its page ──
  const brand = await newPage();
  const brandEmail = `public-brand-${id}@e2e.test`;
  await signupViaUi(brand, 'BRAND', brandEmail);
  await brand.goto('/brand/onboarding');
  await brand.getByLabel('Company name').fill(`Public Cafe ${id}`);
  await brand.getByRole('button', { name: 'Save and post a brief' }).click();
  await brand.waitForURL('**/brand/deals/new');
  await brand.goto(`/@${username}`);
  await expect(brand.getByRole('heading', { name: 'Public Blogger' })).toBeVisible();
  await expect(brand.getByText('Price after sign-in')).toHaveCount(0);
  await expect(brand.getByText(/\$50/).first()).toBeVisible();
  await brand.getByRole('link', { name: title }).click();
  await brand.waitForURL(`**/brand/offers/${offer.id}`);

  // The brand's usual blogger page shows the offers row too.
  await brand.goto(`/brand/influencers/${mine.id}`);
  await expect(brand.getByRole('link', { name: title })).toBeVisible();

  // Unknown usernames are a plain 404.
  const missing = await guest.goto(`/@nobody-${id}`);
  expect(missing?.status()).toBe(404);
});
