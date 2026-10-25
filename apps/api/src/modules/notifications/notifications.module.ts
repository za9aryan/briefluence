import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Global()
@Module({
  controllers: [NotificationsController, PushController],
  providers: [NotificationsService, EmailService, PushService],
  exports: [NotificationsService, EmailService, PushService],
})
export class NotificationsModule {}
