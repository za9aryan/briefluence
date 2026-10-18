// Mirrors the Prisma enums in apps/api/prisma/schema.prisma. Keep both in sync.
const values = <T extends string>(...v: T[]) => v;

export const ROLES = values('INFLUENCER', 'BRAND', 'ADMIN');
export type Role = (typeof ROLES)[number];

export const PLATFORMS = values('INSTAGRAM', 'TIKTOK', 'YOUTUBE');
export type Platform = (typeof PLATFORMS)[number];

export const VERIFICATION_STATUSES = values('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const GENDERS = values('MALE', 'FEMALE', 'OTHER');
export type Gender = (typeof GENDERS)[number];

export const GENDER_FILTERS = values('ANY', 'MALE', 'FEMALE');
export type GenderFilter = (typeof GENDER_FILTERS)[number];

export const PAYMENT_TYPES = values('BARTER', 'MONEY', 'MIXED');
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const CURRENCIES = values('AMD', 'USD', 'RUB');
export type Currency = (typeof CURRENCIES)[number];

export const CONTENT_FORMATS = values(
  'POST',
  'REEL',
  'STORY',
  'SHORT_VIDEO',
  'LONG_VIDEO',
  'LIVE',
  'TEXT_MENTION',
  'INTEGRATION',
  'PRODUCT_PLACEMENT',
  'REVIEW',
  'GIVEAWAY',
  'EVENT',
  'UGC',
);
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const DEAL_STATUSES = values(
  'DRAFT',
  'IN_REVIEW',
  'REJECTED',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'EXPIRED',
);
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const APPLICATION_STATUSES = values(
  'APPLIED',
  'VIEWED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'COMPLETED',
);
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = values(
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED',
);
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = values('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REJECTION_REASONS = values('BUDGET', 'AUDIENCE', 'NICHE', 'OTHER');
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const NOTIFICATION_TYPES = values(
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_PENDING',
  'NEW_MATCHING_DEALS',
  'APPLICATION_VIEWED',
  'APPLICATION_SHORTLISTED',
  'APPLICATION_ACCEPTED',
  'APPLICATION_REJECTED',
  'APPLICATION_COMPLETED',
  'NEW_APPLICANT',
  'DEAL_FILLED',
  'DEAL_EXPIRED',
  'TRIAL_ENDING',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_EXPIRED',
  'SOCIAL_TOKEN_REVOKED',
  'POST_SUBMITTED',
  'DEAL_REVIEW_PENDING',
  'DEAL_APPROVED',
  'DEAL_REJECTED',
);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONTACT_METHODS = values(
  'TELEGRAM',
  'MESSENGER',
  'VIBER',
  'WHATSAPP',
  'INSTAGRAM',
  'PHONE',
);
export type ContactMethod = (typeof CONTACT_METHODS)[number];

/** How long the brand wants to work with the blogger. */
export const COLLABORATION_TYPES = values('ONE_TIME', 'LONG_TERM');
export type CollaborationType = (typeof COLLABORATION_TYPES)[number];
