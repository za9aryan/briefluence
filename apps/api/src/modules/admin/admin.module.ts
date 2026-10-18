import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { JobsModule } from '../jobs/jobs.module';
import { SocialModule } from '../social/social.module';
import { OffersModule } from '../offers/offers.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule, JobsModule, SocialModule, BillingModule, OffersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAnalyticsService],
})
export class AdminModule {}
