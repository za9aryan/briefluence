import { Module } from '@nestjs/common';
import { BrandsModule } from '../brands/brands.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({ imports: [BrandsModule], controllers: [DealsController], providers: [DealsService], exports: [DealsService] })
export class DealsModule {}
