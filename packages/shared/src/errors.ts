/** Typed error codes returned by the API as `{ error: { code, message, details? } }`. */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'EMAIL_NOT_VERIFIED',
  'INVALID_TOKEN',
  'ACCOUNT_BLOCKED',
  'PROFILE_INCOMPLETE',
  'NOT_VERIFIED_INFLUENCER',
  'SUBSCRIPTION_REQUIRED',
  'APPLICATION_LIMIT_REACHED',
  'TRIAL_NOT_STARTED',
  'NOT_ELIGIBLE',
  'ALREADY_APPLIED',
  'SOCIAL_ACCOUNT_TAKEN',
  'SOCIAL_PLATFORM_TAKEN',
  'INVALID_TRANSITION',
  'SLOTS_EXCEEDED',
  'DEAL_NOT_EDITABLE',
  'PAYMENT_FAILED',
  'PROVIDER_ERROR',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
