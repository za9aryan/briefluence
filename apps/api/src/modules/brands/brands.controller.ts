import { Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { brandProfileSchema, setLogoSchema, type BrandProfileData } from '@briefluence/shared';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { BrandsService } from './brands.service';
import { INSIGHT_PERIODS, InsightsService, type InsightPeriod } from './insights.service';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(
    private readonly brands: BrandsService,
    private readonly insightsService: InsightsService,
  ) {}

  @Roles('BRAND')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.brands.getMine(user.id);
  }

  @Roles('BRAND')
  @Put('me')
  @ApiZodBody(brandProfileSchema)
  update(@CurrentUser() user: AuthUser, @ZodBody(brandProfileSchema) body: BrandProfileData) {
    return this.brands.upsertMine(user.id, body);
  }

  /** Just the logo, saved right after upload (null removes it). */
  @Roles('BRAND')
  @Put('me/logo')
  @ApiZodBody(setLogoSchema)
  setLogo(@CurrentUser() user: AuthUser, @ZodBody(setLogoSchema) body: { logoUrl: string | null }) {
    return this.brands.setLogo(user.id, body.logoUrl);
  }

  @Roles('BRAND')
  @Get('me/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.brands.dashboard(user.id);
  }

  /** Aggregated trends for brands: what bloggers search for and which briefs they open, merged. */
  @Roles('BRAND', 'ADMIN')
  @Get('me/insights')
  insights(@Query('days') days?: string) {
    const d = Number(days);
    const period = (INSIGHT_PERIODS as readonly number[]).includes(d) ? (d as InsightPeriod) : 30;
    return this.insightsService.forBrands(period);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.brands.getPublic(id);
  }
}
