import { expect, test } from '@playwright/test';
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

test('live notifications: the admin approves a blogger, whose open page updates without a reload', async ({
  browser,
}) => {
  const id = uid();
  const blogger = await (await browser.newContext({ storageState: en })).newPage();
  const email = `live-${id}@e2e.test`;
  await signupViaUi(blogger, 'INFLUENCER', email);
  await blogger.getByLabel('Name').fill('Live Blogger');
  await blogger.getByRole('checkbox', { name: 'Food' }).click();
  await blogger.getByRole('button', { name: 'Save and continue' }).click();
  await blogger.waitForURL('**/influencer/verification');
  await verifyEmailViaLink(blogger, email);
  await blogger.goto('/influencer/verification');
  await blogger.getByRole('link', { name: 'Connect Instagram' }).click();
  await expect(seen(blogger, 'Instagram connected')).toBeVisible();
  await blogger.getByRole('button', { name: 'Send for review' }).click();
  await expect(blogger.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();

  // The admin approves from another browser; the blogger's page is not reloaded.
  const admin = await (await browser.newContext({ storageState: en })).newPage();
  await admin.request.post('/api/v1/auth/login', {
    data: { email: 'admin@briefluence.local', password: 'Admin12345' },
  });
  const queue = await (await admin.request.get('/api/v1/admin/verifications')).json();
  const mine = queue.find((p: { email: string }) => p.email === email);
  await admin.request.post(`/api/v1/admin/verifications/${mine.id}/approve`);

  // Bell count and the page itself update live.
  await expect(blogger.getByRole('button', { name: /1 unread notification/ })).toBeVisible({
    timeout: 5_000,
  });
  await expect(blogger.getByText('You are verified')).toBeVisible({ timeout: 5_000 });

  // Reading in one tab clears the count in another tab of the same user.
  const tab2 = await blogger.context().newPage();
  await tab2.goto('/influencer/dashboard');
  await expect(tab2.getByRole('button', { name: /1 unread notification/ })).toBeVisible();
  await blogger.request.post('/api/v1/notifications/read-all');
  await expect(tab2.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible({
    timeout: 5_000,
  });
});
