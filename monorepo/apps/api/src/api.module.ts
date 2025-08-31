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
      envFilePath: ['.env.local', '.env'],
    }),

    // Health check module
    HealthModule,

    // Infrastructure modules
    DatabaseModule,

    // Feature modules
    UserModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
  ],
})
export class ApiModule {}
