import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../../common/app-error';
import { Public } from '../../../common/decorators';
import { ZodPipe } from '../../../common/zod';
import { ENV } from '../../../config/config.module';
import type { Env } from '../../../config/env';
import { AuthService } from '../auth.service';
import { setSessionCookies } from '../cookies';
import { OAuthLoginService } from './oauth-login.service';

const NONCE_COOKIE = 'bf_oauth_login';
const COOKIE_PATH = '/api/v1/auth/oauth';
const HOME = {
  INFLUENCER: '/influencer/dashboard',
  BRAND: '/brand/dashboard',
  ADMIN: '/admin/overview',
} as const;

const completeSchema = z.object({
  token: z.string().min(10).max(4000),
  role: z.enum(['INFLUENCER', 'BRAND']),
  acceptTerms: z.literal(true, { error: 'acceptTerms' }),
});

@ApiTags('auth')
@Controller('auth/oauth')
export class OAuthLoginController {
  constructor(
    private readonly oauth: OAuthLoginService,
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Which "Continue with …" buttons to show. */
  @Public()
  @Get('providers')
  providers() {
    return { providers: this.oauth.available() };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':provider/start')
  async start(
    @Param('provider') provider: string,
    @Query('role') role: string | undefined,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ) {
    const { url, nonce, provider: p } = await this.oauth.start(provider, role, next);
    res.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      // Apple returns with a cross-site form POST, which only carries SameSite=None (Secure) cookies.
      sameSite: p === 'apple' && this.env.COOKIE_SECURE ? 'none' : 'lax',
      secure: this.env.COOKIE_SECURE,
      domain: this.env.COOKIE_DOMAIN,
      path: COOKIE_PATH,
      maxAge: 15 * 60_000,
    });
    res.redirect(302, url);
  }

  @Public()
  @Get(':provider/callback')
  callbackGet(
    @Param('provider') provider: string,
    @Query() q: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleCallback(provider, q, req, res);
  }

  /** Apple posts the result (response_mode=form_post). */
  @Public()
  @Post(':provider/callback')
  callbackPost(
    @Param('provider') provider: string,
    @Body() body: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleCallback(provider, body ?? {}, req, res);
  }

  private async handleCallback(
    provider: string,
    p: Record<string, string>,
    req: Request,
    res: Response,
  ) {
    const cookies = (req.cookies ?? {}) as Record<string, string>;
    res.clearCookie(NONCE_COOKIE, { path: COOKIE_PATH, domain: this.env.COOKIE_DOMAIN });
    try {
      if (p.error || !p.code || !p.state)
        throw new AppError('INVALID_TOKEN', 'Sign-in was cancelled');
      const result = await this.oauth.callback(
        provider,
        p.code,
        p.state,
        cookies[NONCE_COOKIE],
        { user: p.user },
        cookies.NEXT_LOCALE,
      );
      if (result.kind === 'complete') {
        return res.redirect(
          302,
          `${this.env.WEB_URL}/signup/complete?token=${encodeURIComponent(result.token)}`,
        );
      }
      setSessionCookies(res, this.env, result.session);
      return res.redirect(
        302,
        `${this.env.WEB_URL}${result.next ?? HOME[result.session.user.role]}`,
      );
    } catch (err) {
      const code = err instanceof AppError ? err.code : 'PROVIDER_ERROR';
      return res.redirect(302, `${this.env.WEB_URL}/login?error=${code}`);
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('complete')
  @HttpCode(200)
  async complete(
    @Body(new ZodPipe(completeSchema)) body: z.infer<typeof completeSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.oauth.complete(
      body.token,
      body.role,
      (req.cookies as Record<string, string> | undefined)?.NEXT_LOCALE,
    );
    setSessionCookies(res, this.env, session);
    return this.auth.me(session.user.id);
  }
}
