import { expect, test } from '@playwright/test';
import { uid } from './helpers';

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

test('support chat: guest writes → admin sees it live and replies → guest sees the reply live', async ({
  browser,
}) => {
  const shots = process.env.E2E_SHOTS;
  const id = uid();
  const newPage = async () => (await browser.newContext({ storageState: en })).newPage();

  // ── Admin keeps the inbox open ──
  const admin = await newPage();
  await admin.request.post('/api/v1/auth/login', {
    data: { email: 'admin@briefluence.local', password: 'Admin12345' },
  });
  await admin.goto('/admin/support');
  await expect(admin.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();

  // ── A visitor who is not signed in opens the chat on the home page ──
  const guest = await newPage();
  await guest.goto('/');
  await guest.getByRole('button', { name: 'Chat with support' }).click();
  const chat = guest.getByRole('dialog', { name: 'Support' });
  await chat.getByRole('radio', { name: 'Account' }).click();
  await chat.getByLabel('Your email').fill(`guest-${id}@e2e.test`);
  await chat.getByLabel('Name').fill(`Guest ${id}`);
  await chat.getByLabel('Message').fill('I was blocked and do not know why.');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByText('I was blocked and do not know why.')).toBeVisible();
  await expect(chat.getByText(/We’ll reply here/)).toBeVisible();
  if (shots) await guest.screenshot({ path: `${shots}/support-guest.png` });

  // ── The new conversation appears in the admin inbox without a reload ──
  const row = admin.getByRole('button', { name: new RegExp(`Guest ${id}`) });
  await expect(row).toBeVisible();
  await row.click();
  await admin.getByRole('button', { name: 'Assign to me' }).click();
  await expect(admin.getByText('Assigned', { exact: true }).first()).toBeVisible();
  // The ticket follows to "Mine" and stays in the list.
  await expect(admin.getByRole('tab', { name: /Mine/, selected: true })).toBeVisible();
  await expect(row).toBeVisible();
  await admin.getByLabel('Write a reply…').fill('Hi! Let me check your account.');
  await admin.getByRole('button', { name: 'Send reply' }).click();
  if (shots) await admin.screenshot({ path: `${shots}/support-admin.png`, fullPage: true });

  // ── The guest sees the reply without a reload, then answers ──
  await expect(chat.getByText('Hi! Let me check your account.')).toBeVisible();
  await expect(chat.getByText('Answered')).toBeVisible();
  await chat.getByLabel('Write a message…').fill('Thank you!');
  await chat.getByLabel('Write a message…').press('Enter');
  // In the conversation (the inbox row shows it as a preview too).
  await expect(admin.locator('p', { hasText: 'Thank you!' })).toBeVisible();

  // Closing on the admin side shows up for the guest, who can start over.
  await admin.getByRole('button', { name: 'Close conversation' }).click();
  await expect(chat.getByText('This conversation is closed.')).toBeVisible();
  await expect(chat.getByRole('button', { name: 'Start a new conversation' })).toBeVisible();
});

test('support chat on a phone opens full screen', async ({ browser }) => {
  const page = await (
    await browser.newContext({ storageState: en, viewport: { width: 375, height: 760 } })
  ).newPage();
  await page.goto('/for-influencers');
  await page.getByRole('button', { name: 'Chat with support' }).click();
  const chat = page.getByRole('dialog', { name: 'Support' });
  // It grows out of the button, then fills the screen.
  await expect.poll(async () => (await chat.boundingBox())?.width).toBe(375);
  expect(await chat.boundingBox()).toMatchObject({ x: 0, y: 0, width: 375 });
  if (process.env.E2E_SHOTS)
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/support-mobile.png` });
  await chat.getByRole('button', { name: 'Close chat' }).click();
  await expect(chat).toBeHidden();
  // It shrinks back into the button, which gets the focus again.
  await expect(page.getByRole('button', { name: 'Chat with support' })).toBeFocused();
});
