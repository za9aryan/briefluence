import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PASSWORD = 'secret123';
export const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** The API's "log" email transport saves every email as HTML in apps/api/.emails. */
const EMAIL_DIR = resolve(__dirname, '../../api/.emails');

export async function emailLink(to: string, path: 'verify-email' | 'reset-password'): Promise<string> {
  const safe = to.replace(/[^a-z0-9@.]/gi, '_');
  let found: string | undefined;
  await expect
    .poll(
      () => {
        const files = readdirSync(EMAIL_DIR)
          .filter((f) => f.endsWith(`${safe}.html`))
          .map((f) => join(EMAIL_DIR, f))
          .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
        for (const f of files) {
          const m = new RegExp(`(/${path}\\?token=[^"&]+)`).exec(readFileSync(f, 'utf8'));
          if (m) {
            found = m[1]!.replace(/&amp;/g, '&');
            return true;
          }
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

export async function signupViaUi(page: Page, role: 'BRAND' | 'INFLUENCER', email: string) {
  await page.goto(`/signup?role=${role}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /I accept the/ }).check();
  await page.getByRole('button', { name: role === 'BRAND' ? 'Create brand account' : 'Create blogger account' }).click();
  await page.waitForURL(role === 'BRAND' ? '**/brand/onboarding' : '**/influencer/onboarding');
}

export async function verifyEmailViaLink(page: Page, email: string) {
  const link = await emailLink(email, 'verify-email');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
}

export async function adminRequest(request: APIRequestContext) {
  const res = await request.post('/api/v1/auth/login', { data: { email: 'admin@briefluence.local', password: 'Admin12345' } });
  expect(res.ok()).toBeTruthy();
  return {
    runJob: async (name: string) => expect((await request.post(`/api/v1/admin/jobs/${name}/run`)).ok()).toBeTruthy(),
    advanceDays: async (days: number) => expect((await request.post('/api/v1/admin/dev/advance-time', { data: { days } })).ok()).toBeTruthy(),
    resetTime: async () => expect((await request.post('/api/v1/admin/dev/reset-time')).ok()).toBeTruthy(),
  };
}
