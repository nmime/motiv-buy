import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DatabaseModule } from '@app/database';
import { AuthMainModule } from '@app/feature-auth-main';
import { UserMainModule } from '@app/feature-user-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { StatisticMainModule } from '@app/feature-statistic-main';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthMainModule,
    UserMainModule,
    BalanceMainModule,
    StatisticMainModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
  ],
})
export class ApiModule {}
