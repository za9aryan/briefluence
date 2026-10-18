import { expect, test } from '@playwright/test';
import { PASSWORD, signupViaUi, uid, verifyEmailViaLink } from './helpers';

test.use({
  storageState: {
    cookies: [
      {
        name: 'NEXT_LOCALE',
        value: 'en',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  },
});

test('sign-up → verify → apply → accept → done', async ({ browser }) => {
  const id = uid();
  const bloggerEmail = `blogger-${id}@e2e.test`;
  const brandEmail = `brand-${id}@e2e.test`;
  const dealTitle = `E2E brief ${id}`;
  const newCtx = () =>
    browser.newContext({
      storageState: {
        cookies: [
          {
            name: 'NEXT_LOCALE',
            value: 'en',
            domain: 'localhost',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
    });

  // ── Blogger: sign up, onboard, connect Instagram, submit for review ──
  const blogger = await (await newCtx()).newPage();
  await signupViaUi(blogger, 'INFLUENCER', bloggerEmail);
  await blogger.getByLabel('Name').fill('Ani E2E');
  await blogger.getByRole('checkbox', { name: 'Beauty' }).click();
  await blogger.getByLabel('Contact method').selectOption('WHATSAPP');
  await blogger.getByLabel('Phone number').fill('+374 91 123456');
  await blogger.getByRole('button', { name: 'Save and continue' }).click();
  await blogger.waitForURL('**/influencer/verification');
  // The free month is opt-in: briefs stay locked until the blogger starts it.
  await blogger.goto('/influencer/deals');
  await expect(blogger.getByText('Two steps to see briefs')).toBeVisible();
  await blogger.getByRole('button', { name: 'Start 30 free days' }).click();
  await expect(blogger.getByText('Your 30 free days have started')).toBeVisible();
  await verifyEmailViaLink(blogger, bloggerEmail);
  await blogger.goto('/influencer/verification');
  await blogger.getByRole('link', { name: 'Connect Instagram' }).click();
  await expect(blogger.getByText('Instagram connected')).toBeVisible();
  await blogger.getByRole('button', { name: 'Send for review' }).click();
  await expect(blogger.getByText('We are reviewing your profile').first()).toBeVisible();

  // ── Admin approves ──
  const admin = await (await newCtx()).newPage();
  await admin.goto('/login');
  await admin.getByLabel('Email').fill('admin@briefluence.local');
  await admin.getByLabel('Password', { exact: true }).fill('Admin12345');
  await admin.getByRole('button', { name: 'Log in' }).click();
  await admin.waitForURL('**/admin/verifications');
  const card = admin
    .locator('div', { hasText: bloggerEmail })
    .filter({ has: admin.getByRole('button', { name: 'Approve' }) })
    .last();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText('Approved. The blogger got an email.')).toBeVisible();

  // ── Brand: sign up, verify, profile, post a brief ──
  const brand = await (await newCtx()).newPage();
  await signupViaUi(brand, 'BRAND', brandEmail);
  await verifyEmailViaLink(brand, brandEmail);
  await brand.goto('/brand/onboarding');
  await brand.getByLabel('Brand name').fill(`E2E Cafe ${id}`);
  await brand.getByLabel('Contact person').fill('Karen');
  await brand.getByLabel('Contact method').selectOption('TELEGRAM');
  await brand.getByLabel('Username or phone').fill('@e2e_cafe');
  await brand.getByRole('button', { name: 'Save and post a brief' }).click();
  await brand.waitForURL('**/brand/deals/new');
  await brand.getByLabel('Title').fill(dealTitle);
  await brand
    .getByLabel('Description')
    .fill('Come for dinner and film a Reels about our new menu, please.');
  await brand.getByRole('checkbox', { name: 'Reel' }).click();
  await brand.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(brand.getByText('Matching now')).toBeVisible();
  await brand.getByRole('button', { name: 'Next', exact: true }).click();
  await brand.getByLabel('What the blogger gets').fill('Dinner for two');
  await brand.getByRole('button', { name: 'Next', exact: true }).click();
  await brand.getByRole('button', { name: 'Publish', exact: true }).click();
  await brand.waitForURL('**/applicants**');
  await expect(brand.getByText(/In review\. We check every brief/)).toBeVisible();

  // ── Admin approves the brief ──
  await admin.goto('/admin/brief-review');
  const briefCard = admin
    .locator('div', { hasText: dealTitle })
    .filter({ has: admin.getByRole('button', { name: 'Approve and publish' }) })
    .last();
  await briefCard.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(admin.getByText('Brief is live. The brand got a notification.')).toBeVisible();

  // ── Blogger applies from the feed ──
  await blogger.goto('/influencer/deals');
  await blogger.getByRole('link', { name: dealTitle }).click();
  await blogger.getByRole('button', { name: 'Apply' }).first().click();
  await blogger
    .getByLabel('Your pitch')
    .fill('I post about food in Yerevan and would love to film this.');
  await blogger.getByRole('button', { name: 'Send application' }).click();
  await expect(blogger.getByText('Application sent.')).toBeVisible();

  // ── Brand accepts; contacts are revealed ──
  await brand.reload();
  await expect(brand.getByText('Ani E2E')).toBeVisible();
  await brand.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(brand.getByRole('link', { name: /WhatsApp: \+37491123456/ })).toHaveAttribute(
    'href',
    'https://wa.me/37491123456',
  );

  // ── Blogger sees the brand contacts ──
  await blogger.goto('/influencer/applications');
  await blogger.getByRole('tab', { name: /Accepted/ }).click();
  await expect(blogger.getByText('Have a great collab!')).toBeVisible();
  await expect(blogger.getByRole('link', { name: /Telegram: @e2e_cafe/ })).toHaveAttribute(
    'href',
    'https://t.me/e2e_cafe',
  );

  // ── Brand marks it done ──
  await brand.reload();
  await brand.getByRole('button', { name: 'Mark as done' }).click();
  await expect(brand.getByText('Marked as done')).toBeVisible();
  expect(PASSWORD).toBeTruthy();
});
