import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { SocialModule } from '../social/social.module';
import { JobsService } from './jobs.service';

@Module({ imports: [BillingModule, SocialModule], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
