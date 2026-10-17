import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { BillingService } from './billing.service';
import { MockPaymentProvider, type MockCard } from './providers/mock.provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/types';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Roles('INFLUENCER')
  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getForUser(user.id);
  }

  /** Blogger confirms the free month (it is not started automatically). */
  @Roles('INFLUENCER')
  @Post('trial')
  @HttpCode(200)
  trial(@CurrentUser() user: AuthUser) {
    return this.billing.startTrial(user.id);
  }

  @Roles('INFLUENCER')
  @Post('checkout')
  @HttpCode(200)
  checkout(@CurrentUser() user: AuthUser) {
    return this.billing.checkout(user.id);
  }

  /** Bank redirect target. Public because the access cookie may expire while the user is on the bank page. */
  @Public()
  @Get('return')
  async return(@Query('paymentID') paymentId: string | undefined, @Res() res: Response) {
    const back = new URL('/influencer/billing', this.env.WEB_URL);
    try {
      if (!paymentId) throw new AppError('VALIDATION_FAILED', 'Missing payment id');
      back.searchParams.set('payment', await this.billing.handleReturn(paymentId));
    } catch {
      back.searchParams.set('payment', 'failed');
    }
    res.redirect(302, back.toString());
  }

  @Roles('INFLUENCER')
  @Post('cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser) {
    return this.billing.cancel(user.id);
  }

  @Roles('INFLUENCER')
  @Post('resume')
  @HttpCode(200)
  resume(@CurrentUser() user: AuthUser) {
    return this.billing.resume(user.id);
  }

  @Roles('INFLUENCER')
  @Delete('card')
  @HttpCode(200)
  removeCard(@CurrentUser() user: AuthUser) {
    return this.billing.removeCard(user.id);
  }

  @Roles('INFLUENCER')
  @Get('payments')
  payments(@CurrentUser() user: AuthUser) {
    return this.billing.payments(user.id);
  }

  /** Fake bank page callback; only exists with PAYMENT_PROVIDER=mock. */
  @Roles('INFLUENCER')
  @Post('mock/complete')
  @HttpCode(200)
  mockComplete(@Body() body: { paymentID?: string; card?: MockCard }) {
    if (!(this.provider instanceof MockPaymentProvider)) throw new AppError('NOT_FOUND', 'Not found');
    const card: MockCard = body.card === 'decline' || body.card === 'renewal_decline' ? body.card : 'success';
    const next = body.paymentID ? this.provider.complete(body.paymentID, card) : null;
    if (!next) throw new AppError('NOT_FOUND', 'Unknown payment');
    return { redirectUrl: next };
  }
}
