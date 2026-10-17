import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { feedQuerySchema, influencerProfileSchema, type InfluencerProfileData } from '@briefluence/shared';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { InfluencersService } from './influencers.service';

@ApiTags('influencers')
@Controller('influencers')
export class InfluencersController {
  constructor(private readonly influencers: InfluencersService) {}

  @Roles('INFLUENCER')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.influencers.getMine(user.id);
  }

  @Roles('INFLUENCER')
  @Put('me')
  @ApiZodBody(influencerProfileSchema)
  update(@CurrentUser() user: AuthUser, @ZodBody(influencerProfileSchema) body: InfluencerProfileData) {
    return this.influencers.upsertMine(user.id, body);
  }

  @Roles('INFLUENCER')
  @Post('me/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser) {
    return this.influencers.submitForReview(user.id);
  }

  @Roles('INFLUENCER')
  @Get('me/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.influencers.dashboard(user.id);
  }

  /** Saved feed filters: an array of { name, query } where query matches the feed query schema. */
  @Roles('INFLUENCER')
  @Put('me/saved-filters')
  @HttpCode(204)
  async saveFilters(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const list = (body as { filters?: unknown })?.filters;
    if (!Array.isArray(list) || list.length > 10) throw new AppError('VALIDATION_FAILED', 'Up to 10 saved filters');
    const clean = list.map((f) => {
      const name = String((f as { name?: unknown })?.name ?? '').slice(0, 40).trim();
      const query = feedQuerySchema.partial().safeParse((f as { query?: unknown })?.query ?? {});
      if (!name || !query.success) throw new AppError('VALIDATION_FAILED', 'Invalid saved filter');
      return { name, query: (f as { query: unknown }).query };
    });
    await this.influencers.saveFilters(user.id, clean);
  }

  @Roles('BRAND', 'ADMIN')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.influencers.getForViewer(user, id);
  }
}
