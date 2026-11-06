import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Db } from './db';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  if (process.env.MIGRATE === '1') await app.get(Db).migrate();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
