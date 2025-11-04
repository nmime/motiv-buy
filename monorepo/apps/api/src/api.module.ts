import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { DatabaseModule } from '@app/database';
import { AuthMainModule } from '@app/feature-auth-main';
import { UserMainModule } from '@app/feature-user-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { PaymentMainModule } from '@app/feature-payment-main';
import { StatisticMainModule } from '@app/feature-statistic-main';
import { TrafficMainModule } from '@app/feature-traffic-main';

import { AuthController } from '@app/feature-auth-main';
import { UserController } from '@app/feature-user-main';
import { BalanceController } from '@app/feature-balance-main';
import { PaymentController, PaymentWebhookController } from '@app/feature-payment-main';
import { StatisticController, StatisticPublicController } from '@app/feature-statistic-main';
import {
  TrafficController,
  TrafficTargetController,
  TrafficSourceController,
  TrafficOrderController,
} from '@app/feature-traffic-main';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 10,
      },
    ]),
    DatabaseModule,
    AuthMainModule,
    UserMainModule,
    BalanceMainModule,
    PaymentMainModule,
    StatisticMainModule,
    TrafficMainModule,
  ],
  controllers: [
    HealthController,

    AuthController,
    UserController,
    BalanceController,
    PaymentController,
    PaymentWebhookController,
    StatisticController,
    StatisticPublicController,
    TrafficController,
    TrafficTargetController,
    TrafficSourceController,
    TrafficOrderController,
  ],
  providers: [],
})
export class ApiModule {}
