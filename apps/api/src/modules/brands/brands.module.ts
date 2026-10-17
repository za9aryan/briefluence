import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { InsightsService } from './insights.service';

@Module({ controllers: [BrandsController], providers: [BrandsService, InsightsService], exports: [BrandsService] })
export class BrandsModule {}
