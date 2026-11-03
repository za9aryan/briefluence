import { expect, test } from '@playwright/test';
import { PASSWORD, signupViaUi, uid } from './helpers';

/** "Are you sure?" before logging out, and deleting the account from Settings. */
test('log out asks first; delete account anonymizes and signs out', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3100' }]);
  const email = `del-${uid()}@e2e.test`;
  await signupViaUi(page, 'INFLUENCER', email);
  await page.getByLabel('Name').fill('Leaving Soon');
  await page.getByRole('checkbox', { name: 'Food' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL('**/influencer/verification');

  // Log out → confirm dialog; Cancel keeps the session.
  await page.getByRole('button', { name: 'Account' }).first().click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  const ask = page.getByRole('dialog', { name: 'Log out?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(/influencer\/verification/);

  await page.goto('/influencer/settings');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dlg = page.getByRole('dialog', { name: 'Delete your account?' });
  const go = dlg.getByRole('button', { name: 'Delete for good' });
  await expect(go).toBeDisabled();
  await dlg.getByLabel('Your password').fill('wrong-password');
  await go.click();
  await expect(dlg.getByText(/password/i).last()).toBeVisible();
  await dlg.getByLabel('Your password').fill(PASSWORD);
  await go.click();
  await page.waitForURL((u) => u.pathname === '/');

  const login = await page.request.post('/api/v1/auth/login', {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(401);
});
