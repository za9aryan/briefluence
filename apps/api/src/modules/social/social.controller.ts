import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { manualAccountSchema, type ManualAccountInput } from '@briefluence/shared';
import type { Request, Response } from 'express';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { SocialService } from './social.service';

const NONCE_COOKIE = 'bf_oauth';

@ApiTags('social')
@Controller('social')
export class SocialController {
  private readonly logger = new Logger(SocialController.name);

  constructor(
    private readonly social: SocialService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Roles('INFLUENCER')
  @Get('accounts')
  list(@CurrentUser() user: AuthUser) {
    return this.social.listMine(user.id);
  }

  /** Redirects the browser to the platform's OAuth consent screen. */
  @Roles('INFLUENCER')
  @Get(':platform/connect')
  async connect(
    @CurrentUser() user: AuthUser,
    @Param('platform') raw: string,
    @Res() res: Response,
  ) {
    const platform = this.social.parsePlatform(raw);
    const { url, nonce } = await this.social.connectUrl(user.id, platform);
    res.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax',
      domain: this.env.COOKIE_DOMAIN,
      path: '/api/v1/social',
      maxAge: 15 * 60_000,
    });
    res.redirect(302, url);
  }

  /** OAuth callback; identifies the user from the signed state, then returns to the verification page. */
  @Public()
  @Get(':platform/callback')
  async callback(
    @Param('platform') raw: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const back = new URL('/influencer/verification', this.env.WEB_URL);
    try {
      const platform = this.social.parsePlatform(raw);
      if (error || !code || !state) throw new AppError('INVALID_TOKEN', 'Connection was cancelled');
      const nonce = (req.cookies as Record<string, string> | undefined)?.[NONCE_COOKIE];
      await this.social.handleCallback(platform, code, state, nonce);
      back.searchParams.set('connected', platform.toLowerCase());
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Could not connect the account, try again';
      if (!(err instanceof AppError))
        this.logger.error(`OAuth callback failed: ${(err as Error).message}`);
      back.searchParams.set('error', message);
    }
    res.clearCookie(NONCE_COOKIE, { path: '/api/v1/social', domain: this.env.COOKIE_DOMAIN });
    res.redirect(302, back.toString());
  }

  @Roles('INFLUENCER')
  @Post('accounts/manual')
  @ApiZodBody(manualAccountSchema)
  addManual(@CurrentUser() user: AuthUser, @ZodBody(manualAccountSchema) body: ManualAccountInput) {
    return this.social.addManual(user.id, body);
  }

  @Roles('INFLUENCER')
  @Patch('accounts/:id')
  @ApiZodBody(manualAccountSchema)
  updateManual(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(manualAccountSchema) body: ManualAccountInput,
  ) {
    return this.social.updateManual(user.id, id, body);
  }

  @Roles('INFLUENCER')
  @Post('accounts/:id/sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.social.syncMine(user.id, id);
  }

  @Roles('INFLUENCER')
  @Delete('accounts/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.social.disconnect(user.id, id);
  }
}
