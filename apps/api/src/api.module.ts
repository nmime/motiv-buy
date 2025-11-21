import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { DatabaseModule } from '@app/database';
import { AuthController, AuthMainModule } from '@app/feature-auth-main';
import { UserController, UserMainModule } from '@app/feature-user-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { PaymentController, PaymentMainModule, PaymentWebhookController } from '@app/feature-payment-main';
import { StatisticController, StatisticMainModule, StatisticPublicController } from '@app/feature-statistic-main';
import {
  TrafficController,
  TrafficMainModule,
  TrafficOrderController,
  TrafficSourceController,
  TrafficTargetController,
} from '@app/feature-traffic-main';
import { BotMainModule, BotWebhookController } from '@app/feature-bot-main';
import { NotificationSharedModule } from '@app/feature-notification-shared';

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
    // Bot module provides Telegram integration for traffic features
    BotMainModule,
    TrafficMainModule,
    // Notification shared module provides service to create notifications (no scheduler)
    NotificationSharedModule,
  ],
  controllers: [
    HealthController,

    AuthController,
    UserController,
    PaymentController,
    PaymentWebhookController,
    StatisticController,
    StatisticPublicController,
    TrafficController,
    TrafficTargetController,
    TrafficSourceController,
    TrafficOrderController,
    // Bot webhook controller for receiving Telegram updates
    BotWebhookController,
  ],
  providers: [],
})
export class ApiModule {}
