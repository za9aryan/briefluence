import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { PrismaModule } from './common/prisma.service';
import { ConfigModule } from './config/config.module';
import { loadEnv } from './config/env';
import { AdminModule } from './modules/admin/admin.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { DealsModule } from './modules/deals/deals.module';
import { OffersModule } from './modules/offers/offers.module';
import { HealthController } from './modules/health/health.controller';
import { InfluencersModule } from './modules/influencers/influencers.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SocialModule } from './modules/social/social.module';
import { StorageModule } from './modules/storage/storage.module';
import { SupportModule } from './modules/support/support.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';

const env = loadEnv();

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CommonModule,
    QueueModule,
    RealtimeModule,
    ScheduleModule.forRoot(),
    JwtModule.register({ global: true, secret: env.JWT_ACCESS_SECRET }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      skipIf: () => env.NODE_ENV === 'test',
    }),
    NotificationsModule,
    CurrencyModule,
    StorageModule,
    AuthModule,
    InfluencersModule,
    SocialModule,
    BrandsModule,
    DealsModule,
    OffersModule,
    ApplicationsModule,
    BillingModule,
    AdminModule,
    SupportModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
