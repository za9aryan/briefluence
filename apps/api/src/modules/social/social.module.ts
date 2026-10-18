import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { AccountLinksService } from './account-links.service';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController],
  providers: [SocialService, AccountLinksService],
  exports: [SocialService, AccountLinksService],
})
export class SocialModule {}
