import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { SocialModule } from '../social/social.module';
import { SupportModule } from '../support/support.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [BillingModule, SocialModule, SupportModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
