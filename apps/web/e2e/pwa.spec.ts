import { expect, test } from '@playwright/test';
import { signupViaUi, uid } from './helpers';

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
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

test('installable: manifest, icons and an uncached service worker', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m).toMatchObject({ name: 'briefluence', display: 'standalone', start_url: '/' });
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBeTruthy();
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect(await sw.text()).toContain("addEventListener('push'");
});

for (const [name, ua, steps] of [
  [
    'iPhone',
    IPHONE,
    ['Tap Share (the square with an arrow).', 'Choose “Add to Home Screen”, then Add.'],
  ],
  ['Android', ANDROID, ['Open the browser menu (⋮).']],
] as const) {
  test(`settings explain how to install on ${name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: en,
      userAgent: ua,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await signupViaUi(page, 'BRAND', `pwa-${uid()}@e2e.test`);
    await page.getByLabel('Brand name').fill('PWA Cafe');
    await page.getByLabel('Contact person').fill('Karen');
    await page.getByLabel('Contact method').selectOption('WHATSAPP');
    await page.getByLabel('Phone number').fill('+374 91 222333');
    await page.getByRole('button', { name: 'Save and post a brief' }).click();
    await page.waitForURL('**/brand/deals/new');
    await page.goto('/brand/account');
    await expect(page.getByText('App and notifications')).toBeVisible();
    for (const s of steps) await expect(page.getByText(s)).toBeVisible();
    // No VAPID keys on the E2E server: the switch explains instead of failing.
    const toggle = page.getByRole('switch', { name: /Push notifications on this device/ });
    await expect(toggle).toBeDisabled();
    if (process.env.E2E_SHOTS)
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/pwa-${name}.png`, fullPage: true });
    await ctx.close();
  });
}
