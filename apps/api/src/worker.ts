import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/**
 * Standalone worker: processes BullMQ jobs and runs cron schedules, no HTTP.
 * Run the API with PROCESS_ROLE=api and this with PROCESS_ROLE=worker.
 */
async function bootstrap() {
  process.env.PROCESS_ROLE = 'worker';
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('Worker started', 'Worker');
}
void bootstrap();
