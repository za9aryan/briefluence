import { expect, test } from '@playwright/test';
import { adminRequest, signupViaUi, uid } from './helpers';

test.use({ storageState: { cookies: [{ name: 'NEXT_LOCALE', value: 'en', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] } });

test('trial → pay → renew with the saved card', async ({ page, playwright }) => {
  const id = uid();
  const email = `trial-${id}@e2e.test`;
  const adminCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const admin = await adminRequest(adminCtx);

  try {
    await signupViaUi(page, 'INFLUENCER', email);
    await page.getByLabel('Name').fill('Trial E2E');
    await page.getByRole('checkbox', { name: 'Travel' }).click();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.waitForURL('**/influencer/verification');

    await page.goto('/influencer/billing');
    await page.getByRole('button', { name: 'Start my free month' }).click();
    await expect(page.getByText('Your free month has started')).toBeVisible();
    await expect(page.getByText(/Free month: 30 days left/)).toBeVisible();

    // Trial runs out.
    await admin.advanceDays(31);
    await admin.runJob('billing-daily');
    await page.reload();
    await expect(page.getByText('Your plan is not active.')).toBeVisible();

    // Pay through the (mock) bank page.
    await page.getByRole('button', { name: /Subscribe again for/ }).click();
    await page.waitForURL('**/billing/mock-checkout**');
    await page.getByRole('button', { name: 'Pay' }).click();
    await page.waitForURL('**/influencer/billing**');
    await expect(page.getByText('Payment received. Your plan is active.')).toBeVisible();
    await expect(page.getByText(/Renews on/)).toBeVisible();

    // A month later the daily job charges the saved card.
    await admin.advanceDays(32);
    await admin.runJob('billing-daily');
    await expect
      .poll(async () => {
        await page.reload();
        return page.getByRole('cell', { name: 'Renewal' }).count();
      })
      .toBe(1);
    await expect(page.getByRole('cell', { name: 'Paid' })).toHaveCount(2);
  } finally {
    await admin.resetTime();
    await adminCtx.dispose();
  }
});
