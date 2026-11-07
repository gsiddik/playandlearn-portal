import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Db } from './db';
import { configure } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configure(app);
  if (process.env.MIGRATE === '1') await app.get(Db).migrate();
  await app.get(Db).bootstrapOps();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
