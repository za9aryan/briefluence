import { Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ACCOUNT_REVIEW_STATUSES,
  influencerFaqSchema,
  portfolioItemSchema,
  verificationDecisionSchema,
  type AccountReviewStatus,
  type InfluencerFaqData,
  type PortfolioItemData,
  type VerificationDecisionInput,
} from '@briefluence/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller()
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Roles('INFLUENCER')
  @Get('influencers/me/portfolio')
  list(@CurrentUser() user: AuthUser) {
    return this.portfolio.listMine(user.id);
  }

  @Roles('INFLUENCER')
  @Post('influencers/me/portfolio')
  @ApiZodBody(portfolioItemSchema)
  create(@CurrentUser() user: AuthUser, @ZodBody(portfolioItemSchema) body: PortfolioItemData) {
    return this.portfolio.create(user.id, body);
  }

  @Roles('INFLUENCER')
  @Put('influencers/me/portfolio/:itemId')
  @ApiZodBody(portfolioItemSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @ZodBody(portfolioItemSchema) body: PortfolioItemData,
  ) {
    return this.portfolio.update(user.id, itemId, body);
  }

  @Roles('INFLUENCER')
  @Delete('influencers/me/portfolio/:itemId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.portfolio.remove(user.id, itemId);
  }

  @Roles('INFLUENCER')
  @Put('influencers/me/faq')
  @ApiZodBody(influencerFaqSchema)
  saveFaq(@CurrentUser() user: AuthUser, @ZodBody(influencerFaqSchema) body: InfluencerFaqData) {
    return this.portfolio.saveFaq(user.id, body);
  }

  // ─── Admin review ────────────────────────────────────────

  @Roles('ADMIN')
  @Get('admin/portfolio')
  queue(@Query('status') status?: string) {
    const s = ACCOUNT_REVIEW_STATUSES.includes(status as AccountReviewStatus)
      ? (status as AccountReviewStatus)
      : 'PENDING';
    return this.portfolio.reviewQueue(s);
  }

  @Roles('ADMIN')
  @Post('admin/portfolio/:id/approve')
  @HttpCode(204)
  approve(@Param('id') id: string) {
    return this.portfolio.approve(id);
  }

  @Roles('ADMIN')
  @Post('admin/portfolio/:id/reject')
  @HttpCode(204)
  @ApiZodBody(verificationDecisionSchema)
  reject(
    @Param('id') id: string,
    @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput,
  ) {
    return this.portfolio.reject(id, body.reason);
  }
}
