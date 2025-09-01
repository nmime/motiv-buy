import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { UserController } from './user.controller';
import { AuthController } from './auth.controller';
import { BalanceController } from './balance.controller';
import { StatisticsController } from './statistics.controller';
import { TrafficController } from './traffic.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    HealthController,
    UserController,
    AuthController,
    BalanceController,
    StatisticsController,
    TrafficController,
  ],
  providers: [
  ],
})
export class ApiModule {}
