import { Global, Module } from '@nestjs/common';
import { CurrencyController } from './currency.controller';
import { RatesService } from './rates.service';

@Global()
@Module({ controllers: [CurrencyController], providers: [RatesService], exports: [RatesService] })
export class CurrencyModule {}
