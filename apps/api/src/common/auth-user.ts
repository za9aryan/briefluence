import type { Role } from '@briefluence/shared';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  role: Role;
  emailVerified: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  ev: boolean;
}

export type AuthedRequest = Request & { user?: AuthUser };

export const COOKIE_ACCESS = 'bf_at';
export const COOKIE_REFRESH = 'bf_rt';
/** Non-secret hint for the Next.js middleware to route by role; the API never trusts it. */
export const COOKIE_ROLE = 'bf_role';
