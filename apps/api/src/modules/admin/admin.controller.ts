import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ACCOUNT_REVIEW_STATUSES,
  DEAL_STATUSES,
  ROLES,
  VERIFICATION_STATUSES,
  verificationDecisionSchema,
  type AccountReviewStatus,
  type DealStatus,
  type Role,
  type VerificationDecisionInput,
  type VerificationStatus,
} from '@briefluence/shared';
import { Clock } from '../../common/clock';
import { Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { JobsService, type JobName } from '../jobs/jobs.service';
import { AdminService, USER_STATES } from './admin.service';

const pick = <T extends string>(list: readonly T[], v?: string) =>
  list.includes(v as T) ? (v as T) : undefined;

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('verifications')
  verifications(@Query('status') status?: string) {
    return this.admin.verifications(
      pick<VerificationStatus>(VERIFICATION_STATUSES, status) ?? 'PENDING_REVIEW',
    );
  }

  @Post('verifications/:id/approve')
  @HttpCode(204)
  approve(@Param('id') id: string) {
    return this.admin.approve(id);
  }

  @Post('verifications/:id/reject')
  @HttpCode(204)
  @ApiZodBody(verificationDecisionSchema)
  reject(
    @Param('id') id: string,
    @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput,
  ) {
    return this.admin.reject(id, body.reason);
  }

  @Get('accounts')
  accounts(@Query('status') status?: string) {
    return this.admin.accounts(
      pick<AccountReviewStatus>(ACCOUNT_REVIEW_STATUSES, status) ?? 'PENDING',
    );
  }

  @Post('accounts/:id/approve')
  @HttpCode(204)
  approveAccount(@Param('id') id: string) {
    return this.admin.approveAccount(id);
  }

  @Post('accounts/:id/reject')
  @HttpCode(204)
  @ApiZodBody(verificationDecisionSchema)
  rejectAccount(
    @Param('id') id: string,
    @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput,
  ) {
    return this.admin.rejectAccount(id, body.reason);
  }

  @Get('deals')
  deals(@Query('status') status?: string, @Query('q') q?: string) {
    return this.admin.deals(pick<DealStatus>(DEAL_STATUSES, status), q?.slice(0, 100));
  }

  @Post('deals/:id/approve')
  @HttpCode(204)
  approveDeal(@Param('id') id: string) {
    return this.admin.approveDeal(id);
  }

  @Post('deals/:id/reject')
  @HttpCode(204)
  @ApiZodBody(verificationDecisionSchema)
  rejectDeal(
    @Param('id') id: string,
    @ZodBody(verificationDecisionSchema) body: VerificationDecisionInput,
  ) {
    return this.admin.rejectDeal(id, body.reason);
  }

  @Post('deals/:id/close')
  @HttpCode(200)
  closeDeal(@Param('id') id: string) {
    return this.admin.closeDeal(id);
  }

  @Get('users')
  users(@Query('role') role?: string, @Query('q') q?: string, @Query('state') state?: string) {
    return this.admin.users(pick<Role>(ROLES, role), q?.slice(0, 100), pick(USER_STATES, state));
  }

  /** Support: mark the email as confirmed (e.g. the person never got the letter). */
  @Post('users/:id/verify-email')
  @HttpCode(204)
  verifyEmail(@Param('id') id: string) {
    return this.admin.verifyEmail(id);
  }

  @Post('users/:id/resend-verification')
  @HttpCode(204)
  resendVerification(@Param('id') id: string) {
    return this.admin.resendVerification(id);
  }

  @Post('users/:id/send-password-reset')
  @HttpCode(204)
  sendPasswordReset(@Param('id') id: string) {
    return this.admin.sendPasswordReset(id);
  }

  /** Ends every session of the user (lost phone, shared password). */
  @Post('users/:id/sign-out')
  @HttpCode(204)
  signOut(@Param('id') id: string) {
    return this.admin.signOutEverywhere(id);
  }

  @Post('users/:id/block')
  @HttpCode(204)
  block(@Param('id') id: string) {
    return this.admin.setBlocked(id, true);
  }

  @Post('users/:id/unblock')
  @HttpCode(204)
  unblock(@Param('id') id: string) {
    return this.admin.setBlocked(id, false);
  }

  @Get('payments')
  payments() {
    return this.admin.payments();
  }

  /** Runs a scheduled job immediately (support / debugging). */
  @Post('jobs/:name/run')
  @HttpCode(200)
  runJob(@Param('name') name: string) {
    return this.jobs.run(name as JobName);
  }

  /** Dev/test only: shifts the server clock to exercise trials and renewals. */
  @Post('dev/advance-time')
  @HttpCode(200)
  advance(@Body() body: { days?: number }) {
    if (this.env.NODE_ENV === 'production') throw new ForbiddenException();
    const days = Math.max(0, Math.min(400, Number(body?.days ?? 0)));
    this.clock.advance(days * 86_400_000);
    return { now: this.clock.now() };
  }

  /** Dev/test only: undoes advance-time. */
  @Post('dev/reset-time')
  @HttpCode(200)
  resetTime() {
    if (this.env.NODE_ENV === 'production') throw new ForbiddenException();
    this.clock.reset();
    return { now: this.clock.now() };
  }
}
