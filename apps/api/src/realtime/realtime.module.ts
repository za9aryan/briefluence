import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/** The app-wide live channel (Socket.IO at /api/v1/ws), injectable everywhere. */
@Global()
@Module({ providers: [RealtimeGateway], exports: [RealtimeGateway] })
export class RealtimeModule {}
