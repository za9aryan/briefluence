import { Module } from '@nestjs/common';
import { InfluencersController } from './influencers.controller';
import { InfluencersService } from './influencers.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  controllers: [InfluencersController, PortfolioController],
  providers: [InfluencersService, PortfolioService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
