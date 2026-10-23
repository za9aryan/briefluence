import type { Platform } from './enums';

export const NICHES = [
  'food',
  'beauty',
  'fashion',
  'fitness',
  'travel',
  'tech',
  'kids',
  'lifestyle',
  'auto',
  'education',
] as const;
export type Niche = (typeof NICHES)[number];

/** ISO 639-1 content languages offered in the MVP. */
export const LANGUAGES = ['hy', 'ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** ISO 3166-1 alpha-2. Armenia is the launch market. */
export const COUNTRIES = ['AM', 'GE', 'RU', 'US', 'FR', 'DE', 'AE', 'UA', 'KZ', 'IR'] as const;
export type Country = (typeof COUNTRIES)[number];
export const DEFAULT_COUNTRY: Country = 'AM';

export const CITIES: Partial<Record<Country, readonly string[]>> = {
  AM: [
    'Yerevan',
    'Gyumri',
    'Vanadzor',
    'Vagharshapat',
    'Abovyan',
    'Kapan',
    'Hrazdan',
    'Armavir',
    'Artashat',
    'Ijevan',
    'Gavar',
    'Goris',
    'Dilijan',
    'Sevan',
    'Jermuk',
  ],
  GE: ['Tbilisi', 'Batumi', 'Kutaisi'],
  RU: ['Moscow', 'Saint Petersburg', 'Krasnodar', 'Sochi'],
  US: ['Los Angeles', 'New York', 'Glendale'],
  FR: ['Paris', 'Lyon', 'Marseille'],
  DE: ['Berlin', 'Munich'],
  AE: ['Dubai', 'Abu Dhabi'],
  UA: ['Kyiv'],
  KZ: ['Almaty', 'Astana'],
  IR: ['Tehran'],
};

export const AUDIENCE_AGE_BUCKETS = [
  '13-17',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+',
] as const;

export const AUDIENCE_SIZE_PRESETS = {
  nano: { min: 1_000, max: 10_000 },
  micro: { min: 10_000, max: 50_000 },
  mid: { min: 50_000, max: 500_000 },
  macro: { min: 500_000, max: null },
} as const;
export type AudienceSizePreset = keyof typeof AUDIENCE_SIZE_PRESETS;

export const INFLUENCER_AGE_RANGE = { min: 16, max: 65 } as const;
export const PITCH_MAX_LENGTH = 500;
/** Portfolio items a blogger can keep, and how many of them can go with one application. */
export const PORTFOLIO_MAX_ITEMS = 12;
export const APPLICATION_PORTFOLIO_MAX = 3;
export const FAQ_ANSWER_MAX_LENGTH = 1000;
/** Support chat limits. */
export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;
/** Answered tickets with no user reply for this long are closed by the daily job. */
export const SUPPORT_AUTO_CLOSE_DAYS = 7;
/** Guests (not signed in): new tickets per email in 24 hours. */
export const SUPPORT_GUEST_TICKETS_PER_DAY = 3;
/** Per IP address it is higher: many people share one IP (mobile operators, offices). */
export const SUPPORT_GUEST_TICKETS_PER_IP_PER_DAY = 20;
/** Messages anyone can send to one ticket in 10 minutes. */
export const SUPPORT_MESSAGES_PER_10_MIN = 20;
/** Free Pro days every blogger gets when they choose a plan. */
export const TRIAL_DAYS = 30;
/** Basic's application limit counts applications in this rolling window. */
export const PLAN_WINDOW_DAYS = 30;
export const TRIAL_REMINDER_DAYS_BEFORE = 3;
/** Days after the first failed renewal on which the charge is retried. */
export const RENEWAL_RETRY_DAYS = [1, 3, 5] as const;
export const ENGAGEMENT_SAMPLE_SIZE = 12;
export const TIMEZONE = 'Asia/Yerevan';

export const PLATFORM_LABELS: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
};
