import { Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  DEAL_STATUSES,
  dealInputSchema,
  feedQuerySchema,
  reachPreviewSchema,
  type DealData,
  type DealStatus,
  type FeedQuery,
  type ReachPreviewInput,
} from '@briefluence/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import {
  EmailVerifiedGuard,
  TrialStartedGuard,
  VerifiedInfluencerGuard,
} from '../../common/guards';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/zod';
import { DealsService } from './deals.service';

@ApiTags('deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Roles('BRAND')
  @UseGuards(EmailVerifiedGuard)
  @Post()
  @ApiZodBody(dealInputSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(dealInputSchema) body: DealData) {
    return this.deals.create(user.id, body);
  }

  @Roles('BRAND')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    const s = DEAL_STATUSES.includes(status as DealStatus) ? (status as DealStatus) : undefined;
    return this.deals.listMine(user.id, s);
  }

  @Roles('BRAND')
  @Post('preview-reach')
  @HttpCode(200)
  @ApiZodBody(reachPreviewSchema)
  preview(@ZodBody(reachPreviewSchema) body: ReachPreviewInput) {
    return this.deals.previewReach(body);
  }

  /**
   * Needs a started free month and a verified profile. The feed stays visible after the trial
   * ends; applying is what needs an active subscription.
   */
  @Roles('INFLUENCER')
  @UseGuards(TrialStartedGuard, VerifiedInfluencerGuard)
  @Get('feed')
  feed(@CurrentUser() user: AuthUser, @ZodQuery(feedQuerySchema) q: FeedQuery) {
    return this.deals.feed(user.id, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deals.getForViewer(user, id);
  }

  @Roles('BRAND')
  @Patch(':id')
  @ApiZodBody(dealInputSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(dealInputSchema) body: DealData,
  ) {
    return this.deals.update(user.id, id, body);
  }

  @Roles('BRAND')
  @UseGuards(EmailVerifiedGuard)
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deals.publish(user.id, id);
  }

  @Roles('BRAND')
  @Post(':id/pause')
  @HttpCode(200)
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deals.transition(user.id, id, 'PAUSED');
  }

  @Roles('BRAND')
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.deals.transition(user.id, id, 'CLOSED');
  }
}
