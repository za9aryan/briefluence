import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Test env: root .env for secrets, then forced overrides so tests never touch dev data or real services. */
export function loadTestEnv() {
  const file = resolve(__dirname, '../../../.env');
  if (existsSync(file)) process.loadEnvFile(file);
  const testDb =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/briefluence_test';
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: testDb,
    REDIS_URL: '',
    EMAIL_TRANSPORT: 'log',
    STORAGE_DRIVER: 'local',
    SOCIAL_MOCK: 'true',
    PAYMENT_PROVIDER: 'mock',
    RATES_SOURCE: 'static',
    PROCESS_ROLE: 'all',
    WEB_URL: 'http://localhost:3000',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-test-access-secret-0000',
    JWT_EMAIL_SECRET: process.env.JWT_EMAIL_SECRET ?? 'test-email-secret-test-email-secret-00000',
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString('base64'),
  });
}
