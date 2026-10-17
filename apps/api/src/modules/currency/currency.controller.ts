import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { RatesService } from './rates.service';

@ApiTags('currency')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly rates: RatesService) {}

  /** Current rates as AMD per 1 unit, with source and time — used for display conversion. */
  @Public()
  @Get('rates')
  async get() {
    const s = await this.rates.get();
    return { base: 'AMD', rates: s.rates, source: s.source, fetchedAt: s.fetchedAt };
  }
}
