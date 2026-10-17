import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack (API on :4000 with SOCIAL_MOCK=true and
 * PAYMENT_PROVIDER=mock, web on :3000). Locally the dev servers are reused; in CI they are started.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @briefluence/api start',
      url: 'http://localhost:4000/api/v1/health',
      reuseExistingServer: true,
      cwd: '../..',
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @briefluence/web start',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      cwd: '../..',
      timeout: 120_000,
    },
  ],
});
