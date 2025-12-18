import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BotMainModule } from '@app/feature-bot-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { NotificationMainModule } from '@app/feature-notification-main';
import { PaymentMainModule } from '@app/feature-payment-main';
import { BalanceMainModule } from '@app/feature-balance-main';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { BotService } from './service';
import { ModerationCallbackHandler } from './handler';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Architecture:
 * - All handlers and services are provided by BotMainModule
 * - This module only provides the thin wrapper BotService
 * - Follows proper NestJS module architecture with no duplicate providers
 * - BalanceMainModule provides BALANCE_SERVICE_TOKEN for handlers
 *
 * Integrates notification system for scheduled notifications and event processing.
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
    BotMainModule,
    TrafficMainModule,
    PaymentMainModule,
    BalanceMainModule,
    AuthSharedModule,
    NotificationMainModule,
  ],
  providers: [BotService, ModerationCallbackHandler],
  exports: [BotService],
})
export class BotModule {}
