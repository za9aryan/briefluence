import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AmeriaProvider } from './providers/ameria.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PAYMENT_PROVIDER } from './providers/types';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.PAYMENT_PROVIDER === 'ameriabank' ? new AmeriaProvider(env) : new MockPaymentProvider(env)),
    },
  ],
  exports: [BillingService, PAYMENT_PROVIDER],
})
export class BillingModule {}
