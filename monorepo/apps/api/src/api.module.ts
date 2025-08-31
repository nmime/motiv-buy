import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '@app/common-health';
import { UserModule } from '@app/feature-user-main';
import { StatisticMainModule } from '@app/feature-statistic-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { UserMainModule as TrafficMainModule } from '@app/feature-traffic-main';
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
    
    // Feature modules
    UserModule,
    StatisticMainModule,
    BalanceMainModule,
    TrafficMainModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
  ],
})
export class ApiModule {}
