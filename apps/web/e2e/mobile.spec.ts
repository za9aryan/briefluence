import { expect, test } from '@playwright/test';
import { signupViaUi, uid, verifyEmailViaLink } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll('main *')) {
      const card = el.closest('.rounded-card');
      const r = el.getBoundingClientRect();
      if (!r.width || el.children.length) continue;
      const box = card && card !== el ? card.getBoundingClientRect() : { left: 0, right: vw };
      if (r.right > box.right + 1 || r.left < box.left - 1)
        out.push(
          `${(el.textContent || '').trim().slice(0, 40)} ${Math.round(r.left)}-${Math.round(r.right)} outside ${Math.round(box.left)}-${Math.round(box.right)}`,
        );
    }
    return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 8) };
  });

/** Phone width (360px): long usernames, emails and links must stay inside their cards (en/ru/hy). */
test('long handles and links stay inside cards on phones', async ({ browser }) => {
  const shots = process.env.E2E_SHOTS;
  const id = uid();
  const page = await (
    await browser.newContext({ viewport: { width: 360, height: 800 } })
  ).newPage();
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3100' }]);
  await signupViaUi(page, 'INFLUENCER', `mob-${id}@e2e.test`);
  await page.getByLabel('Name').fill('Mobile Blogger');
  await page.getByRole('checkbox', { name: 'Food' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL('**/influencer/verification');
  const long = `the.very_long-instagram.username_of_a_blogger_${id}`.slice(0, 60);
  expect(
    (
      await page.request.post('/api/v1/social/accounts/manual', {
        data: { platform: 'INSTAGRAM', username: long, followers: 15400 },
      })
    ).ok(),
  ).toBeTruthy();
  for (const lang of ['ru', 'hy', 'en']) {
    await page
      .context()
      .addCookies([{ name: 'NEXT_LOCALE', value: lang, url: 'http://localhost:3100' }]);
    await page.reload({ waitUntil: 'networkidle' });
    if (shots) await page.screenshot({ path: `${shots}/mob-verif-${lang}.png`, fullPage: true });
    expect((await overflow(page)).out, lang).toEqual([]);
  }
  const v = await overflow(page);

  const brand = await (
    await browser.newContext({ viewport: { width: 360, height: 800 } })
  ).newPage();
  const bEmail = `mob-brand-with-a-really-long-address-${id}@e2e.test`;
  await signupViaUi(brand, 'BRAND', bEmail);
  await verifyEmailViaLink(brand, bEmail);
  await brand.request.put('/api/v1/brands/me', {
    data: {
      companyName: 'Long Links LLC',
      country: 'AM',
      city: 'Yerevan',
      website:
        'https://www.a-very-long-company-website-address-for-testing.am/en/about-us/our-story',
      instagramUrl: 'https://www.instagram.com/a_very_long_brand_instagram_handle_for_testing/',
      contactName: 'Karen',
      contactMethod: 'TELEGRAM',
      contactValue: '@long_links',
    },
  });
  const deal = await (
    await brand.request.post('/api/v1/deals', {
      data: {
        title: `Reels with a long link ${id}`,
        description:
          'Please read the brief at https://docs.example.com/briefs/2026/autumn-campaign/reels-guidelines-and-examples-final-v3.pdf before you apply.',
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

  const admin = await (
    await browser.newContext({ viewport: { width: 360, height: 800 } })
  ).newPage();
  await admin.request.post('/api/v1/auth/login', {
    data: { email: 'admin@briefluence.local', password: 'Admin12345' },
  });
  await admin.goto('/admin/brief-review', { waitUntil: 'networkidle' });
  const card = admin.locator('.rounded-card', { hasText: `Reels with a long link ${id}` });
  await card.scrollIntoViewIfNeeded();
  const a = await overflow(admin);
  if (shots) await card.screenshot({ path: `${shots}/mob-briefrev.png` });
  expect(v.out).toEqual([]);
  expect(a.out).toEqual([]);
});
