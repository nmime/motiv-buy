import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { DocsController } from './docs/docs.controller';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/common-redis';
import { HealthModule } from '@app/common-health';
import { AuthMainModule } from '@app/feature-auth-main';
import { UserMainModule } from '@app/feature-user-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { PaymentMainModule } from '@app/feature-payment-main';
import { StatisticMainModule } from '@app/feature-statistic-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { BotMainModule } from '@app/feature-bot-main';
import { NotificationSharedModule } from '@app/feature-notification-shared';

/**
 * API Application Module
 *
 * REST API composition root for handling HTTP requests.
 *
 * Important: All cron jobs and scheduled tasks run ONLY in the bot application.
 * This module does NOT include:
 * - ScheduleModule (no cron jobs in API)
 * - CurrencyMainModule (currency rate scheduler runs in bot only)
 * - PaymentPollingService (runs in bot only)
 * - PaymentNotificationHandler (runs in bot only via BotSchedulerModule)
 * - NotificationSchedulerService (runs in bot only via NotificationMainModule)
 *
 * The API handles:
 * - REST endpoints for all features
 * - Payment webhooks (CryptoBot, Heleket, YooKassa)
 * - Bot webhooks (Telegram updates in webhook mode)
 */
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
    RedisModule,
    HealthModule,
    AuthMainModule,
    UserMainModule,
    BalanceMainModule,
    PaymentMainModule, // Webhooks only, no polling (PaymentPollingService removed)
    StatisticMainModule,
    // Bot module provides Telegram integration for traffic features
    // Note: BotSchedulerModule NOT imported (bot-only handlers)
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
