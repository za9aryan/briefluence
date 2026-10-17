import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  configureApp(app, env);
  await app.listen(env.API_PORT);
  Logger.log(`API on ${env.API_URL}/api/v1 — docs at ${env.API_URL}/api/docs`, 'Bootstrap');
}
void bootstrap();
