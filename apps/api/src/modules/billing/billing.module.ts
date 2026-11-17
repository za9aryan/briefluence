import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { PaddleBillingService } from './paddle/paddle-billing.service';
import { PaddleClient } from './paddle/paddle.client';
import { PlansService } from './plans.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { PaddleProviderStub } from './providers/paddle.provider';
import { PAYMENT_PROVIDER } from './providers/types';

@Module({
  controllers: [BillingController, CouponsController],
  providers: [
    BillingService,
    PlansService,
    CouponsService,
    PaddleClient,
    PaddleBillingService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.PAYMENT_PROVIDER === 'paddle' ? new PaddleProviderStub() : new MockPaymentProvider(env),
    },
  ],
  exports: [BillingService, PlansService, PaddleBillingService, PAYMENT_PROVIDER],
})
export class BillingModule {}
