import { PLATFORMS, type Platform } from '@briefluence/shared';
import { z } from 'zod';
import { loadDotenv } from './dotenv';

if (process.env.NODE_ENV !== 'test') loadDotenv();

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    WEB_URL: z.url().default('http://localhost:3000'),
    API_URL: z.url().default('http://localhost:4000'),
    API_PORT: z.coerce.number().int().default(4000),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: optional,
    PROCESS_ROLE: z.enum(['all', 'api', 'worker']).default('all'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_EMAIL_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_DOMAIN: optional,
    COOKIE_SECURE: bool,
    ADMIN_EMAIL: z.email().default('admin@briefluence.local'),
    ADMIN_PASSWORD: z.string().min(8).default('Admin12345'),

    TOKEN_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'Must be 32 bytes, base64-encoded'),

    EMAIL_TRANSPORT: z.enum(['smtp', 'resend', 'log']).default('log'),
    EMAIL_FROM: z.string().default('Briefluence <no-reply@briefluence.local>'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    RESEND_API_KEY: optional,

    STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
    S3_ENDPOINT: optional,
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_PUBLIC_URL: optional,

    /**
     * Which platforms use the fake OAuth provider: "true" = all, "false"/"" = none, or a
     * comma list like "tiktok,youtube" (e.g. real Instagram while other apps are in review).
     */
    SOCIAL_MOCK: z
      .string()
      .default('false')
      .transform((v): Platform[] => {
        const x = v.trim().toLowerCase();
        if (x === 'true' || x === '1') return [...PLATFORMS];
        if (x === 'false' || x === '0' || x === '') return [];
        return x
          .split(',')
          .map((p) => p.trim().toUpperCase())
          .filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
      }),
    INSTAGRAM_APP_ID: optional,
    INSTAGRAM_APP_SECRET: optional,
    INSTAGRAM_GRAPH_VERSION: z.string().default('v23.0'),
    TIKTOK_CLIENT_KEY: optional,
    TIKTOK_CLIENT_SECRET: optional,
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,

    /** cba = Central Bank of Armenia (falls back to open.er-api); static = fixed approximate rates (tests/offline). */
    RATES_SOURCE: z.enum(['cba', 'static']).default('cba'),

    /**
     * Google / Apple sign-in: which providers use the simulated login ("true" = both, "false" = none,
     * or a list like "apple"). Real providers need their keys (Google reuses GOOGLE_CLIENT_ID/SECRET).
     */
    OAUTH_LOGIN_MOCK: z
      .string()
      .default('false')
      .transform((v): ('google' | 'apple')[] => {
        const x = v.trim().toLowerCase();
        if (x === 'true' || x === '1') return ['google', 'apple'];
        if (x === 'false' || x === '0' || x === '') return [];
        return x
          .split(',')
          .map((p) => p.trim())
          .filter((p): p is 'google' | 'apple' => p === 'google' || p === 'apple');
      }),
    APPLE_CLIENT_ID: optional, // Services ID, e.g. am.briefluence.web
    APPLE_TEAM_ID: optional,
    APPLE_KEY_ID: optional,
    APPLE_PRIVATE_KEY: optional, // contents of the .p8 key (newlines as \\n are fine)

    PAYMENT_PROVIDER: z.enum(['mock', 'ameriabank']).default('mock'),
    /** Staging / early launch: allow simulated social login and payments with NODE_ENV=production. */
    ALLOW_MOCKS_IN_PRODUCTION: bool,
    SUBSCRIPTION_PRICE_MINOR: z.coerce.number().int().positive().default(999),
    SUBSCRIPTION_CURRENCY: z.enum(['AMD', 'USD']).default('USD'),
    AMERIA_TEST_MODE: z
      .enum(['true', 'false', '1', '0', ''])
      .default('true')
      .transform((v) => v === 'true' || v === '1'),
    AMERIA_CLIENT_ID: optional,
    AMERIA_USERNAME: optional,
    AMERIA_PASSWORD: optional,
    AMERIA_ORDER_ID_OFFSET: z.coerce.number().int().min(0).default(0),
    AMERIA_BINDING_PAYMENT_TYPE: z.coerce.number().int().default(6),

    SENTRY_DSN: optional,
  })
  .superRefine((e, ctx) => {
    const need = (keys: (keyof typeof e)[], when: string) => {
      for (const k of keys) {
        if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: `Required when ${when}` });
      }
    };
    if (e.STORAGE_DRIVER === 's3') {
      need(
        ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL'],
        'STORAGE_DRIVER=s3',
      );
    }
    if (e.PAYMENT_PROVIDER === 'ameriabank') {
      need(
        ['AMERIA_CLIENT_ID', 'AMERIA_USERNAME', 'AMERIA_PASSWORD'],
        'PAYMENT_PROVIDER=ameriabank',
      );
    }
    const real = (p: Platform) => !e.SOCIAL_MOCK.includes(p);
    if (real('INSTAGRAM'))
      need(['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], 'Instagram is not mocked (SOCIAL_MOCK)');
    if (real('TIKTOK'))
      need(['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'], 'TikTok is not mocked (SOCIAL_MOCK)');
    if (real('YOUTUBE'))
      need(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], 'YouTube is not mocked (SOCIAL_MOCK)');
    if (e.EMAIL_TRANSPORT === 'resend') need(['RESEND_API_KEY'], 'EMAIL_TRANSPORT=resend');
    if (e.NODE_ENV === 'production' && !e.ALLOW_MOCKS_IN_PRODUCTION) {
      if (e.OAUTH_LOGIN_MOCK.length)
        ctx.addIssue({
          code: 'custom',
          path: ['OAUTH_LOGIN_MOCK'],
          message: 'Must be false in production',
        });
      if (e.SOCIAL_MOCK.length)
        ctx.addIssue({
          code: 'custom',
          path: ['SOCIAL_MOCK'],
          message: 'Must be false in production',
        });
      if (e.PAYMENT_PROVIDER === 'mock') {
        ctx.addIssue({
          code: 'custom',
          path: ['PAYMENT_PROVIDER'],
          message: 'mock is not allowed in production',
        });
      }
    }
  });

export type Env = z.output<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosting platforms (Render, Railway…) pass the port in PORT.
  const parsed = envSchema.safeParse({ ...source, API_PORT: source.API_PORT ?? source.PORT });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
