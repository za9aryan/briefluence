import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'node:path';
import type { Env } from './config/env';
import { SocketAdapter } from './modules/support/socket-adapter';

/** Shared HTTP setup for main.ts and e2e tests. */
export function configureApp(app: INestApplication, env: Env) {
  app.setGlobalPrefix('api/v1');
  // Requests reach the API through the website (and a reverse proxy in production). Trust the
  // private-network hops so req.ip (rate limits, logs) is the visitor, not the proxy.
  (app.getHttpAdapter().getInstance() as express.Express).set('trust proxy', env.TRUST_PROXY);
  app.use(cookieParser());
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  // Support chat live updates (Socket.IO at /api/v1/ws), same origins and cookies as the API.
  app.useWebSocketAdapter(new SocketAdapter(app, origins));
  // Local file storage driver serves uploads from the API.
  app.use(
    '/api/v1/files',
    express.static(join(process.cwd(), 'uploads'), { maxAge: '7d', fallthrough: false }),
  );

  const config = new DocumentBuilder()
    .setTitle('Briefluence API')
    .setDescription(
      'Influencer marketplace REST API. Auth uses httpOnly cookies set by /auth/login.',
    )
    .setVersion('1.0')
    .addCookieAuth('bf_at')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
}
