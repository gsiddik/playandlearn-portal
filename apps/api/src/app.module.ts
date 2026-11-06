import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { Db } from './db';
import { AuthController } from './auth.controller';
import { ChildrenController } from './children.controller';
import { SyncController } from './sync.controller';

@Module({
  controllers: [HealthController, AuthController, ChildrenController, SyncController],
  providers: [Db],
})
export class AppModule {}
