import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import {
  checkoutSchema,
  choosePlanSchema,
  type CheckoutInput,
  type ChoosePlanInput,
} from '@briefluence/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/app-error';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { ApiZodBody, ZodBody } from '../../common/zod';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { BillingService } from './billing.service';
import { PaddleBillingService, type PaddleEvent } from './paddle/paddle-billing.service';
import { PaddleClient, verifyPaddleSignature } from './paddle/paddle.client';
import { MockPaymentProvider, type MockCard } from './providers/mock.provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/types';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly paddle: PaddleBillingService,
    private readonly paddleClient: PaddleClient,
  ) {}

  /**
   * Paddle webhooks. Verified with the destination's secret over the raw body (parsing first
   * would change it), processed once per event id. Public: Paddle calls it, no session.
   */
  @Public()
  @SkipThrottle()
  @Post('paddle/webhook')
  @HttpCode(200)
  async paddleWebhook(@Req() req: RawBodyRequest<Request>) {
    const cfg = this.paddleClient.config;
    if (!cfg) throw new AppError('NOT_FOUND', 'Not found');
    const raw = req.rawBody?.toString('utf8') ?? '';
    const ok = verifyPaddleSignature(
      raw,
      req.headers['paddle-signature'] as string | undefined,
      cfg.webhookSecret,
      Math.floor(Date.now() / 1000),
    );
    if (!ok) throw new AppError('INVALID_TOKEN', 'Bad signature');
    await this.paddle.handle(JSON.parse(raw) as PaddleEvent);
    return { ok: true };
  }

  /** Paddle: open Paddle's "update payment method" checkout for the current subscription. */
  @Roles('INFLUENCER')
  @Post('payment-method')
  @HttpCode(200)
  paymentMethod(@CurrentUser() user: AuthUser) {
    return this.billing.paymentMethod(user.id);
  }

  /** Sandbox demo: Paddle-linked subscriptions, to run simulations on. */
  @Roles('ADMIN')
  @Get('paddle/demo/subscriptions')
  demoSubscriptions() {
    return this.paddle.demoSubscriptions();
  }

  /** Sandbox demo: simulate a renewal (paid / failed) or a cancellation through Paddle. */
  @Roles('ADMIN')
  @Post('paddle/demo/simulate')
  @HttpCode(200)
  simulate(@Body() raw: unknown) {
    const body = z
      .object({
        subscriptionId: z.string().min(1).max(64),
        scenario: z.enum(['renewal_success', 'renewal_failed', 'cancellation']),
      })
      .safeParse(raw);
    if (!body.success) throw new AppError('VALIDATION_FAILED', 'Invalid simulation');
    return this.paddle.simulate(body.data.subscriptionId, body.data.scenario, this.env.WEB_URL);
  }

  @Roles('INFLUENCER')
  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getForUser(user.id);
  }

  /** Blogger chooses a plan (Basic or Pro); the free Pro days start now. Not automatic. */
  @Roles('INFLUENCER')
  @Post('plan')
  @HttpCode(200)
  @ApiZodBody(choosePlanSchema)
  choosePlan(@CurrentUser() user: AuthUser, @ZodBody(choosePlanSchema) body: ChoosePlanInput) {
    return this.billing.choosePlan(user.id, body.plan);
  }

  /** Pays for a Pro plan (monthly or yearly) on the bank page. */
  @Roles('INFLUENCER')
  @Post('checkout')
  @HttpCode(200)
  @ApiZodBody(checkoutSchema)
  checkout(@CurrentUser() user: AuthUser, @ZodBody(checkoutSchema) body: CheckoutInput) {
    return this.billing.checkout(user.id, body.plan);
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

  /** Switch Pro monthly <-> yearly at the next renewal (send the current plan to undo). */
  @Roles('INFLUENCER')
  @Post('switch')
  @HttpCode(200)
  @ApiZodBody(checkoutSchema)
  switchPlan(@CurrentUser() user: AuthUser, @ZodBody(checkoutSchema) body: CheckoutInput) {
    return this.billing.switchPlan(user.id, body.plan);
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
    if (!(this.provider instanceof MockPaymentProvider))
      throw new AppError('NOT_FOUND', 'Not found');
    const card: MockCard =
      body.card === 'decline' || body.card === 'renewal_decline' ? body.card : 'success';
    const next = body.paymentID ? this.provider.complete(body.paymentID, card) : null;
    if (!next) throw new AppError('NOT_FOUND', 'Unknown payment');
    return { redirectUrl: next };
  }
}
