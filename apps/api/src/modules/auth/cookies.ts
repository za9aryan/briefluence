import type { CookieOptions, Response } from 'express';
import { COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_ROLE } from '../../common/auth-user';
import type { Env } from '../../config/env';
import type { Session } from './auth.service';

export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function base(env: Env): CookieOptions {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', domain: env.COOKIE_DOMAIN };
}

export function setSessionCookies(res: Response, env: Env, s: Session) {
  const b = base(env);
  res.cookie(COOKIE_ACCESS, s.accessToken, { ...b, path: '/', maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000 });
  res.cookie(COOKIE_REFRESH, s.refreshToken, { ...b, path: REFRESH_COOKIE_PATH, expires: s.refreshExpiresAt });
  res.cookie(COOKIE_ROLE, s.user.role, { ...b, path: '/', expires: s.refreshExpiresAt });
}

export function clearSessionCookies(res: Response, env: Env) {
  const b = base(env);
  res.clearCookie(COOKIE_ACCESS, { ...b, path: '/' });
  res.clearCookie(COOKIE_REFRESH, { ...b, path: REFRESH_COOKIE_PATH });
  res.clearCookie(COOKIE_ROLE, { ...b, path: '/' });
}
