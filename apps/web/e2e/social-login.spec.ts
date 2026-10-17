import { expect, test } from '@playwright/test';
import { uid } from './helpers';

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

test('continue with Google from the login page creates an account, then logs back in', async ({
  page,
}) => {
  const email = `google-${uid()}@e2e.test`;

  const viaGoogle = async () => {
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL('**/oauth/mock**');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Name').fill('Google E2E');
    await page.getByRole('button', { name: 'Continue' }).click();
  };

  await page.goto('/login');
  await viaGoogle();
  await page.waitForURL('**/signup/complete**');
  await page.getByRole('radio', { name: /Brand/ }).click();
  await page.getByRole('checkbox', { name: /I accept the/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/brand/**');

  // Same Google account again: straight in, no role question.
  await page.context().clearCookies({ name: 'bf_at' });
  await page.context().clearCookies({ name: 'bf_rt' });
  await page.context().clearCookies({ name: 'bf_role' });
  await page.goto('/login');
  await viaGoogle();
  await page.waitForURL('**/brand/**');
  await expect(page).not.toHaveURL(/signup\/complete/);
});
