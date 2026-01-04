import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotMainModule, BotSchedulerModule } from '@app/feature-bot-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { NotificationMainModule } from '@app/feature-notification-main';
import { PaymentMainModule, PaymentPollingService } from '@app/feature-payment-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { CurrencyRateSchedulerService, CurrencySharedModule } from '@app/feature-currency-shared';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { RedisModule } from '@app/common-redis';
import { HealthModule } from '@app/common-health';
import { BotService } from './service';
import { ModerationCallbackHandler } from './handler';
import { HealthController } from './health.controller';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Architecture:
 * - All handlers and services are provided by BotMainModule
 * - BotSchedulerModule provides bot-only event listeners (PaymentNotificationHandler)
 * - This module only provides the thin wrapper BotService
 * - Follows proper NestJS module architecture with no duplicate providers
 * - BalanceMainModule provides BALANCE_SERVICE_TOKEN for handlers
 *
 * Bot-only scheduled tasks (registered as providers here):
 * - CurrencyRateSchedulerService: Updates currency rates every 10 minutes
 * - PaymentPollingService: Polls payment providers for pending transaction status
 * - NotificationSchedulerService: Processes pending user notifications (via NotificationMainModule)
 * - PaymentNotificationHandler: Sends Telegram notifications on balance credited events
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 10,
      },
    ]),
    RedisModule,
    HealthModule,
    BotMainModule,
    BotSchedulerModule, // Bot-only event listeners and cron handlers
    CurrencySharedModule,
    TrafficMainModule,
    PaymentMainModule,
    BalanceMainModule,
    AuthSharedModule,
    NotificationMainModule,
  ],
  controllers: [HealthController],
  providers: [
    BotService,
    ModerationCallbackHandler,
    CurrencyRateSchedulerService, // Bot-only: updates currency rates
    PaymentPollingService, // Bot-only: polls payment providers for status updates
  ],
  exports: [BotService],
})
export class BotModule {}
