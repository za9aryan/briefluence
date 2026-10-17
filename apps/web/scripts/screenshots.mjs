#!/usr/bin/env node
// Captures key screens for visual review: node scripts/screenshots.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? './screenshots';
const base = process.argv[3] ?? 'http://localhost:3000';
const browser = await chromium.launch();

async function session(viewport, locale, email, password) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: base }]);
  const page = await ctx.newPage();
  if (email) {
    const res = await page.request.post(`${base}/api/v1/auth/login`, { data: { email, password } });
    if (!res.ok()) throw new Error(`login ${email} failed ${res.status()}`);
  }
  return { ctx, page };
}

async function shot(page, path, name) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log('saved', name);
}

const desktop = { width: 1366, height: 860 };
const phone = { width: 390, height: 844 };

for (const locale of ['en', 'ru', 'hy']) {
  const { ctx, page } = await session(desktop, locale);
  await shot(page, '/', `landing-${locale}`);
  await ctx.close();
}
{
  const { ctx, page } = await session(phone, 'hy');
  await shot(page, '/', 'landing-phone-hy');
  await shot(page, '/signup', 'signup-phone-hy');
  await ctx.close();
}
{
  const { ctx, page } = await session(desktop, 'en', 'influencer1@briefluence.local', 'Password123');
  await shot(page, '/influencer/dashboard', 'inf-dashboard');
  await shot(page, '/influencer/deals', 'inf-feed');
  const first = await page.locator('a[href^="/influencer/deals/"]').first().getAttribute('href');
  if (first) await shot(page, first, 'inf-deal');
  await shot(page, '/influencer/verification', 'inf-verification');
  await shot(page, '/influencer/billing', 'inf-billing');
  await ctx.close();
}
{
  const { ctx, page } = await session(phone, 'ru', 'influencer1@briefluence.local', 'Password123');
  await shot(page, '/influencer/deals', 'inf-feed-phone-ru');
  await ctx.close();
}
{
  const { ctx, page } = await session(desktop, 'ru', 'brand1@briefluence.local', 'Password123');
  await shot(page, '/brand/dashboard', 'brand-dashboard-ru');
  await shot(page, '/brand/deals', 'brand-deals-ru');
  await shot(page, '/brand/deals/new', 'brand-wizard-ru');
  await page.goto(`${base}/brand/deals`, { waitUntil: 'networkidle' });
  const first = await page.locator('a[href$="/applicants"]').first().getAttribute('href');
  if (first) await shot(page, first, 'brand-applicants-ru');
  await ctx.close();
}
{
  const { ctx, page } = await session(desktop, 'en', 'admin@briefluence.local', 'Admin12345');
  await shot(page, '/admin/verifications', 'admin-verifications');
  await ctx.close();
}
await browser.close();
