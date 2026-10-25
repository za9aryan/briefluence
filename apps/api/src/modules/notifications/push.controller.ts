import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  type PushSubscriptionInput,
} from '@briefluence/shared';
import type { AuthedRequest, AuthUser } from '../../common/auth-user';
import { CurrentUser, Public } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { PushService } from './push.service';

/** Web Push devices of the signed-in user. */
@ApiTags('notifications')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The VAPID public key browsers need to subscribe; `enabled: false` when push is not set up. */
  @Public()
  @Get('public-key')
  publicKey() {
    return this.push.publicKey();
  }

  @Post('subscriptions')
  @HttpCode(204)
  @ApiZodBody(pushSubscriptionSchema)
  subscribe(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
    @ZodBody(pushSubscriptionSchema) body: PushSubscriptionInput,
  ) {
    return this.push.subscribe(user.id, body, req.headers['user-agent']?.slice(0, 300));
  }

  @Post('subscriptions/remove')
  @HttpCode(204)
  @ApiZodBody(pushUnsubscribeSchema)
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @ZodBody(pushUnsubscribeSchema) body: { endpoint: string },
  ) {
    return this.push.unsubscribe(user.id, body.endpoint);
  }
}
