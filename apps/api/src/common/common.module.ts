import { Global, Module } from '@nestjs/common';
import { Clock } from './clock';
import { CryptoService } from './crypto.service';

@Global()
@Module({ providers: [CryptoService, Clock], exports: [CryptoService, Clock] })
export class CommonModule {}
