import { Module } from '@nestjs/common';
import { SupportAdminController, SupportController } from './support.controller';
import { SupportGateway } from './support.gateway';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, SupportGateway],
  exports: [SupportService],
})
export class SupportModule {}
