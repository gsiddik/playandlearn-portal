import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Konfigurasi aplikasi yang dipakai bersama oleh main.ts dan tes (prefix, WebSocket, batas body unggahan aset). */
export function configure(app: INestApplication) {
  app.setGlobalPrefix('v1');
  app.useWebSocketAdapter(new WsAdapter(app));
  (app as NestExpressApplication).useBodyParser('json', { limit: '10mb' }); // aset base64 hingga ~5 MB
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',') });
  return app;
}
