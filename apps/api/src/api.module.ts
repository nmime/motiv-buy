import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { DocsController } from './docs/docs.controller';
import { DatabaseModule } from '@app/database';
import { AuthMainModule } from '@app/feature-auth-main';
import { UserMainModule } from '@app/feature-user-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { PaymentMainModule } from '@app/feature-payment-main';
import { StatisticMainModule } from '@app/feature-statistic-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { BotMainModule } from '@app/feature-bot-main';
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
    DocsController,
    // Feature module controllers are already exported by their respective modules
    // AuthController - from AuthMainModule
    // UserController - from UserMainModule
    // BalanceController - from BalanceMainModule
    // PaymentController - from PaymentMainModule
    // PaymentWebhookController - from PaymentMainModule
    // StatisticController - from StatisticMainModule
    // StatisticPublicController - from StatisticMainModule
    // TrafficController - from TrafficMainModule
    // TrafficTargetController - from TrafficMainModule
    // TrafficSourceController - from TrafficMainModule
    // TrafficOrderController - from TrafficMainModule
    // BotWebhookController - from BotMainModule
  ],
  providers: [],
})
export class ApiModule {}
