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

test('blogger offer → admin approves → brand requests → blogger accepts → contacts', async ({
  browser,
}) => {
  const id = uid();
  const title = `1 Story for 10,000 AMD ${id}`;
  const newPage = async () => (await browser.newContext({ storageState: en })).newPage();

  // ── Verified blogger ──
  const blogger = await newPage();
  const bloggerEmail = `offer-blogger-${id}@e2e.test`;
  await signupViaUi(blogger, 'INFLUENCER', bloggerEmail);
  await blogger.getByLabel('Name').fill('Offer Blogger');
  await blogger.getByRole('checkbox', { name: 'Food' }).click();
  await blogger.getByLabel('Contact method').selectOption('TELEGRAM');
  await blogger.getByLabel('Username or phone').fill('@offer_blogger');
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
  const mine = queue.find((p: { email: string }) => p.email === bloggerEmail);
  await admin.request.post(`/api/v1/admin/verifications/${mine.id}/approve`);

  // ── Blogger creates an offer and sends it for review ──
  await blogger.goto('/influencer/offers');
  await blogger.getByRole('link', { name: 'New offer' }).first().click();
  await blogger.getByLabel('Title').fill(title);
  await blogger
    .getByLabel('Description')
    .fill('One Instagram story about your place with a link sticker.');
  await blogger.getByLabel('Price', { exact: true }).fill('10000');
  await blogger.getByRole('checkbox', { name: 'Instagram' }).click();
  await blogger.getByRole('checkbox', { name: 'Story' }).click();
  await blogger.getByRole('button', { name: 'Send for review' }).click();
  await blogger.waitForURL('**/influencer/offers');
  await expect(blogger.getByText(/In review\. We check every offer/)).toBeVisible();

  // ── Admin approves the offer on the review page ──
  await admin.goto('/admin/offer-review');
  await admin
    .locator('div', { hasText: title })
    .filter({ has: admin.getByRole('button', { name: 'Approve and publish' }) })
    .last()
    .getByRole('button', { name: 'Approve and publish' })
    .click();
  await expect(admin.getByText('Offer is live. The blogger got a notification.')).toBeVisible();

  // ── Brand finds it and sends a request ──
  const brand = await newPage();
  const brandEmail = `offer-brand-${id}@e2e.test`;
  await signupViaUi(brand, 'BRAND', brandEmail);
  await verifyEmailViaLink(brand, brandEmail);
  await brand.goto('/brand/onboarding');
  await brand.getByLabel('Brand name').fill(`Offer Cafe ${id}`);
  await brand.getByLabel('Contact person').fill('Karen');
  await brand.getByLabel('Contact method').selectOption('WHATSAPP');
  await brand.getByLabel('Phone number').fill('+374 91 222333');
  await brand.getByRole('button', { name: 'Save and post a brief' }).click();
  await brand.waitForURL('**/brand/deals/new');
  await brand.goto('/brand/offers');
  await brand.getByLabel('Search offers').fill(id);
  // The blogger's name on the card opens their profile.
  await brand.getByRole('link', { name: 'Offer Blogger' }).first().click();
  await brand.waitForURL('**/brand/influencers/**');
  await expect(brand.getByRole('heading', { name: 'Offer Blogger' })).toBeVisible();
  await brand.goBack();
  await brand.getByLabel('Search offers').fill(id);
  await brand.getByRole('link', { name: title }).click();
  await expect(brand.getByText('1 view')).toBeVisible();
  await brand.getByRole('button', { name: 'Send request' }).click();
  await brand
    .getByLabel('Message to the blogger')
    .fill('We would love a story about our new menu next week.');
  await brand.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
  await expect(brand.getByText('Request sent. The blogger will answer here.')).toBeVisible();
  // …and so does the name in the side card of the offer page.
  await brand.getByRole('link', { name: 'Offer Blogger' }).click();
  await brand.waitForURL('**/brand/influencers/**');
  await brand.goBack();

  // ── Blogger accepts; both sides see contacts ──
  await blogger.goto('/influencer/offers');
  await expect(blogger.getByText('1 new')).toBeVisible();
  await blogger.getByRole('link', { name: title }).click();
  await expect(
    blogger.getByText('We would love a story about our new menu next week.'),
  ).toBeVisible();
  await blogger.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(blogger.getByRole('link', { name: /WhatsApp: \+37491222333/ })).toBeVisible();

  await brand.goto('/brand/offers?tab=requests');
  await expect(brand.getByRole('link', { name: /Telegram: @offer_blogger/ })).toBeVisible();
});
