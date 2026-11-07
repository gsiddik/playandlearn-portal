import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Db } from './db';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',') });
  if (process.env.MIGRATE === '1') await app.get(Db).migrate();
  await app.get(Db).bootstrapOps();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
