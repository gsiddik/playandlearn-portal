import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { Db } from './db';
import { AuthController } from './auth.controller';
import { ChildrenController } from './children.controller';
import { SyncController } from './sync.controller';
import { SchoolController } from './school.controller';
import { OpsController } from './ops.controller';
import { LiveGateway, LiveHub } from './live';

@Module({
  controllers: [HealthController, AuthController, ChildrenController, SyncController, SchoolController, OpsController],
  providers: [Db, LiveHub, LiveGateway],
})
export class AppModule {}
