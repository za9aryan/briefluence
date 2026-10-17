import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_EMAIL_SECRET: 'b'.repeat(40),
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  REDIS_URL: 'redis://x',
};

describe('loadEnv', () => {
  it('rejects simulated login / payments in production by default', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', SOCIAL_MOCK: 'true', PAYMENT_PROVIDER: 'mock' })).toThrow(/SOCIAL_MOCK/);
  });
  it('allows them with ALLOW_MOCKS_IN_PRODUCTION (staging / pre-approval launch)', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', SOCIAL_MOCK: 'true', PAYMENT_PROVIDER: 'mock', ALLOW_MOCKS_IN_PRODUCTION: 'true' });
    expect(env.SOCIAL_MOCK).toEqual(['INSTAGRAM', 'TIKTOK', 'YOUTUBE']);
  });
  it('takes the port from PORT when API_PORT is not set', () => {
    expect(loadEnv({ ...base, SOCIAL_MOCK: 'true', PORT: '10000' }).API_PORT).toBe(10000);
    expect(loadEnv({ ...base, SOCIAL_MOCK: 'true', PORT: '10000', API_PORT: '4500' }).API_PORT).toBe(4500);
  });
});
