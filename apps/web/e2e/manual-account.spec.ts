import { expect, test } from '@playwright/test';
import { signupViaUi, uid } from './helpers';

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

test('blogger adds a social account by hand and edits it', async ({ page }) => {
  const handle = `m${uid()}`;
  await signupViaUi(page, 'INFLUENCER', `manual-${uid()}@e2e.test`);
  await page.getByLabel('Name').fill('Manual E2E');
  await page.getByRole('checkbox', { name: 'Travel' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL('**/influencer/verification');

  await page.getByRole('button', { name: 'Add manually' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Platform').selectOption('TIKTOK');
  await dialog.getByLabel('Username').fill(`@${handle}`);
  // Followers are required.
  await dialog.getByRole('button', { name: 'Add account' }).click();
  await expect(dialog.getByLabel('Followers')).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('Followers').fill('15400');
  await dialog.getByLabel('Engagement rate, %').fill('3.5');
  await dialog.getByRole('button', { name: 'Add account' }).click();

  await expect(page.getByText('Account added')).toBeVisible();
  await expect(page.getByText(`@${handle}`)).toBeVisible();
  await expect(page.getByText('Added manually')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(dialog.getByLabel('Followers')).toHaveValue('15400');
  await dialog.getByLabel('Followers').fill('16000');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Account updated')).toBeVisible();
  await expect(page.getByText('16K followers').first()).toBeVisible();
});
