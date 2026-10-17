import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({ imports: [DealsModule], controllers: [ApplicationsController], providers: [ApplicationsService] })
export class ApplicationsModule {}
