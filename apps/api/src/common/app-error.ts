import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@briefluence/shared';

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_TOKEN: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  ACCOUNT_BLOCKED: HttpStatus.FORBIDDEN,
  EMAIL_NOT_VERIFIED: HttpStatus.FORBIDDEN,
  PROFILE_INCOMPLETE: HttpStatus.FORBIDDEN,
  NOT_VERIFIED_INFLUENCER: HttpStatus.FORBIDDEN,
  NOT_ELIGIBLE: HttpStatus.FORBIDDEN,
  SUBSCRIPTION_REQUIRED: HttpStatus.PAYMENT_REQUIRED,
  APPLICATION_LIMIT_REACHED: HttpStatus.PAYMENT_REQUIRED,
  TRIAL_NOT_STARTED: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  SOCIAL_ACCOUNT_TAKEN: HttpStatus.CONFLICT,
  SOCIAL_PLATFORM_TAKEN: HttpStatus.CONFLICT,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  ALREADY_APPLIED: HttpStatus.CONFLICT,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  SLOTS_EXCEEDED: HttpStatus.CONFLICT,
  DEAL_NOT_EDITABLE: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PAYMENT_FAILED: HttpStatus.PAYMENT_REQUIRED,
  PROVIDER_ERROR: HttpStatus.BAD_GATEWAY,
};

/** Typed API error; rendered as `{ error: { code, message, details } }` by the exception filter. */
export class AppError extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    const body: ApiErrorBody = { error: { code, message, details } };
    super(body, STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`);
export const forbidden = (msg = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', msg);
