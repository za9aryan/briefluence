import { Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  applicantsQuerySchema,
  applicationStatusUpdateSchema,
  applySchema,
  type ApplicantsQuery,
  type ApplicationStatusUpdateInput,
} from '@briefluence/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Roles } from '../../common/decorators';
import {
  ActiveSubscriptionGuard,
  EmailVerifiedGuard,
  VerifiedInfluencerGuard,
} from '../../common/guards';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/zod';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@Controller()
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Roles('INFLUENCER')
  @UseGuards(EmailVerifiedGuard, VerifiedInfluencerGuard, ActiveSubscriptionGuard)
  @Post('deals/:id/applications')
  @ApiZodBody(applySchema)
  apply(
    @CurrentUser() user: AuthUser,
    @Param('id') dealId: string,
    @ZodBody(applySchema) body: z.output<typeof applySchema>,
  ) {
    return this.applications.apply(user.id, dealId, body);
  }

  @Roles('BRAND')
  @Get('deals/:id/applications')
  forDeal(
    @CurrentUser() user: AuthUser,
    @Param('id') dealId: string,
    @ZodQuery(applicantsQuerySchema) q: ApplicantsQuery,
  ) {
    return this.applications.listForDeal(user.id, dealId, q);
  }

  @Roles('INFLUENCER')
  @Get('applications/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.applications.listMine(user.id);
  }

  @Roles('BRAND')
  @Patch('applications/:id/status')
  @ApiZodBody(applicationStatusUpdateSchema)
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @ZodBody(applicationStatusUpdateSchema) body: ApplicationStatusUpdateInput,
  ) {
    return this.applications.updateStatus(user.id, id, body);
  }

  @Roles('INFLUENCER')
  @Post('applications/:id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applications.withdraw(user.id, id);
  }
}
