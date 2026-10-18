import { Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  offerFeedQuerySchema,
  offerInputSchema,
  offerRequestSchema,
  type OfferFeedQuery,
  type OfferInput,
  type OfferRequestInput,
} from '@briefluence/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import { EmailVerifiedGuard, VerifiedInfluencerGuard } from '../../common/guards';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/zod';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  // ─── Blogger ─────────────────────────────────────────────

  @Roles('INFLUENCER')
  @Get('offers/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.offers.listMine(user.id);
  }

  @Roles('INFLUENCER')
  @Post('offers')
  @ApiZodBody(offerInputSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(offerInputSchema) body: OfferInput) {
    return this.offers.create(user.id, body);
  }

  @Roles('INFLUENCER')
  @Patch('offers/:id')
  @ApiZodBody(offerInputSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(offerInputSchema) body: OfferInput,
  ) {
    return this.offers.update(user.id, id, body);
  }

  /** Only verified bloggers publish; the plan decides how many offers can be live. */
  @Roles('INFLUENCER')
  @UseGuards(EmailVerifiedGuard, VerifiedInfluencerGuard)
  @Post('offers/:id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.publish(user.id, id);
  }

  @Roles('INFLUENCER')
  @Post('offers/:id/pause')
  @HttpCode(200)
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.transition(user.id, id, 'PAUSED');
  }

  @Roles('INFLUENCER')
  @Post('offers/:id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.transition(user.id, id, 'CLOSED');
  }

  @Roles('INFLUENCER')
  @Get('offers/:id/requests')
  requests(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.requestsFor(user.id, id);
  }

  @Roles('INFLUENCER')
  @Post('offer-requests/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.decide(user.id, id, true);
  }

  @Roles('INFLUENCER')
  @Post('offer-requests/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.decide(user.id, id, false);
  }

  // ─── Brand ───────────────────────────────────────────────

  @Roles('BRAND')
  @Get('offers/feed')
  feed(@CurrentUser() user: AuthUser, @ZodQuery(offerFeedQuerySchema) q: OfferFeedQuery) {
    return this.offers.feed(user.id, q);
  }

  @Roles('BRAND')
  @Get('offer-requests/mine')
  myRequests(@CurrentUser() user: AuthUser) {
    return this.offers.myRequests(user.id);
  }

  @Roles('BRAND')
  @UseGuards(EmailVerifiedGuard)
  @Post('offers/:id/requests')
  @ApiZodBody(offerRequestSchema)
  request(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(offerRequestSchema) body: OfferRequestInput,
  ) {
    return this.offers.request(user.id, id, body);
  }

  @Roles('BRAND')
  @Post('offer-requests/:id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.withdraw(user.id, id);
  }

  // ─── Any signed-in role (access checked inside) ───────────

  @Get('offers/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.offers.getForViewer(user, id);
  }
}
