import { Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  notificationSettingsSchema,
  resetPasswordSchema,
  signupSchema,
  tokenSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type NotificationSettingsInput,
  type ResetPasswordInput,
  type SignupInput,
  type TokenInput,
} from '@briefluence/shared';
import type { Request, Response } from 'express';
import { COOKIE_REFRESH, type AuthedRequest, type AuthUser } from '../../common/auth-user';
import { CurrentUser, Public } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { AuthService } from './auth.service';
import { clearSessionCookies, setSessionCookies } from './cookies';

/**
 * Sign-up / login attempts per IP per minute. 10 in production; the isolated E2E servers raise it
 * (AUTH_RATE_LIMIT) because the whole browser suite signs up many accounts from one address.
 * Read at import time because decorators are evaluated then.
 */
const AUTH_LIMIT = { default: { limit: Number(process.env.AUTH_RATE_LIMIT) || 10, ttl: 60_000 } };
/** Language the visitor browses in (set by the website; requests reach the API through the same origin). */
const uiLocale = (req: Request) => (req.cookies as Record<string, string> | undefined)?.NEXT_LOCALE;
const refreshCookie = (req: Request) =>
  (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('signup')
  @ApiZodBody(signupSchema)
  async signup(
    @ZodBody(signupSchema) body: SignupInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.signup(body, uiLocale(req));
    setSessionCookies(res, this.env, session);
    return this.auth.me(session.user.id);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  @ApiZodBody(loginSchema)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body, uiLocale(req));
    setSessionCookies(res, this.env, session);
    return this.auth.me(session.user.id);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const session = await this.auth.refresh(refreshCookie(req));
      setSessionCookies(res, this.env, session);
      return { ok: true };
    } catch (err) {
      clearSessionCookies(res, this.env);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req));
    clearSessionCookies(res, this.env);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('verify-email')
  @HttpCode(200)
  @ApiZodBody(tokenSchema)
  async verifyEmail(
    @ZodBody(tokenSchema) body: TokenInput,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.verifyEmail(body.token);
    // If the link is opened in the same browser, refresh the session so the new status applies at once.
    if (req.user?.id === user.id) {
      await this.auth.logout(refreshCookie(req));
      setSessionCookies(res, this.env, await this.auth.createSession(user));
    }
    return { ok: true };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(204)
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(204)
  @ApiZodBody(forgotPasswordSchema)
  forgot(@ZodBody(forgotPasswordSchema) body: ForgotPasswordInput) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(204)
  @ApiZodBody(resetPasswordSchema)
  reset(@ZodBody(resetPasswordSchema) body: ResetPasswordInput) {
    return this.auth.resetPassword(body);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Throttle(AUTH_LIMIT)
  @Post('change-password')
  @HttpCode(204)
  @ApiZodBody(changePasswordSchema)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    setSessionCookies(res, this.env, await this.auth.changePassword(user.id, body));
  }

  @Patch('settings')
  @HttpCode(204)
  @ApiZodBody(notificationSettingsSchema)
  settings(
    @CurrentUser() user: AuthUser,
    @ZodBody(notificationSettingsSchema) body: NotificationSettingsInput,
  ) {
    return this.auth.updateSettings(user.id, body);
  }
}
