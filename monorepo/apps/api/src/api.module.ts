import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '@app/common-health';
import { UserModule } from '@app/feature-user-main';
import { DatabaseModule, DatabaseHealthIndicator } from '@app/database';
import { RedisHealthIndicator } from '@app/common-redis';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Health check module
    HealthModule,

    // Infrastructure modules
    DatabaseModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
  ],
})
export class ApiModule {}
