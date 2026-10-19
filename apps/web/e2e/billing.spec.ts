import { expect, test } from '@playwright/test';
import { adminRequest, signupViaUi, uid } from './helpers';

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

test('free Pro days → Basic → upgrade to Pro → renew with the saved card', async ({
  page,
  playwright,
  baseURL,
}) => {
  const id = uid();
  const email = `trial-${id}@e2e.test`;
  const adminCtx = await playwright.request.newContext({ baseURL });
  const admin = await adminRequest(adminCtx);

  try {
    await signupViaUi(page, 'INFLUENCER', email);
    await page.getByLabel('Name').fill('Trial E2E');
    await page.getByRole('checkbox', { name: 'Travel' }).click();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.waitForURL('**/influencer/verification');

    // Prices are only shown once signed in; every plan starts with free Pro days.
    await page.goto('/influencer/billing');
    await expect(page.getByText('Choose your plan')).toBeVisible();
    await page.getByRole('button', { name: 'Start with Basic' }).click();
    await expect(page.getByText('Your 30 free Pro days have started')).toBeVisible();
    await expect(page.getByText(/Pro for free: 30 days left/)).toBeVisible();
    await expect(page.getByText('After that: Basic.')).toBeVisible();

    // Free days run out: the blogger is on Basic with its application limit.
    await admin.advanceDays(31);
    await admin.runJob('billing-daily');
    await page.reload();
    await expect(page.getByText('0 of 10 applications used in the last 30 days.')).toBeVisible();
    await expect(page.getByText('Upgrade to Pro')).toBeVisible();

    // Upgrade to Pro through the (mock) bank page.
    await page.getByRole('button', { name: 'Choose Pro', exact: true }).click();
    await page.waitForURL('**/billing/mock-checkout**');
    await page.getByRole('button', { name: 'Pay' }).click();
    await page.waitForURL('**/influencer/billing**');
    await expect(page.getByText('Payment received. Pro is on.')).toBeVisible();
    await expect(page.getByText('Auto-renewal on')).toBeVisible();
    await expect(page.getByText(/Renews automatically on/)).toBeVisible();

    // Unsubscribe: renewal turns off, Pro stays until the period ends; then turn it back on.
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(page.getByText('Auto-renewal off')).toBeVisible();
    await expect(page.getByText(/Renewal is off\. Pro ends on/)).toBeVisible();
    await page.getByRole('button', { name: 'Turn renewal back on' }).click();
    await expect(page.getByText('Auto-renewal on')).toBeVisible();

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
