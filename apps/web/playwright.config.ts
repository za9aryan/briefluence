import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against their OWN servers and database, never your dev data:
 *   API on :4100 and web on :3100, database `briefluence_e2e` (created/migrated automatically).
 * Your dev servers (:4000 / :3000) and the `briefluence` database are not touched.
 */
const E2E_DB =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/briefluence_e2e';
const API_PORT = 4100;
const WEB_PORT = 3100;
const WEB = `http://localhost:${WEB_PORT}`;

const apiEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: E2E_DB,
  API_PORT: String(API_PORT),
  API_URL: `http://localhost:${API_PORT}`,
  WEB_URL: WEB,
  CORS_ORIGINS: WEB,
  PROCESS_ROLE: 'all',
  REDIS_URL: '',
  SOCIAL_MOCK: 'true',
  OAUTH_LOGIN_MOCK: 'true',
  PAYMENT_PROVIDER: 'mock',
  EMAIL_TRANSPORT: 'log',
  STORAGE_DRIVER: 'local',
  RATES_SOURCE: 'static',
  ADMIN_EMAIL: 'admin@briefluence.local',
  ADMIN_PASSWORD: 'Admin12345',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Migrate the E2E database, ensure the admin exists, start the built API.
      command: 'npx prisma migrate deploy && npx tsx prisma/create-admin.ts && node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Production build in its own folder so it never clashes with `next dev`.
      command: `pnpm exec next build && pnpm exec next start --port ${WEB_PORT}`,
      url: WEB,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        API_INTERNAL_URL: `http://localhost:${API_PORT}`,
        // No Caddy here: the support chat's WebSocket goes straight to the E2E API.
        NEXT_PUBLIC_SOCKET_ORIGIN: `http://localhost:${API_PORT}`,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
