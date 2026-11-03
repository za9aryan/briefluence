import { Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { deleteAccountSchema, type DeleteAccountInput } from '@briefluence/shared';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { clearSessionCookies } from '../auth/cookies';
import { AccountService } from './account.service';

@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Companies and influencers delete their own account (always the caller's, never by id). */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('delete')
  @HttpCode(204)
  @ApiZodBody(deleteAccountSchema)
  async delete(
    @CurrentUser() user: AuthUser,
    @ZodBody(deleteAccountSchema) body: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.delete(user.id, body);
    clearSessionCookies(res, this.env);
  }
}
