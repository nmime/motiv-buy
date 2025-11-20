import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotSharedModule } from '@app/feature-bot-shared';
import { RedisModule } from '@app/common-redis';
import { DatabaseModule } from '@app/database';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { UserSharedModule } from '@app/feature-user-shared';
import { BalanceSharedModule } from '@app/feature-balance-shared';
import { StatisticSharedModule } from '@app/feature-statistic-shared';
import { TrafficSharedModule } from '@app/feature-traffic-shared';
import { AppCommonIntlModule } from '@app/common-intl';
import { ModerationService } from '@app/feature-traffic-main';
import { BotService, MenuService, MessageService, SessionService, TelegramModerationNotifier } from './service';
import { BotConfigService } from './config';
import { OrderModule } from './features/order/order.module';
import {
  CallbackRouterHandler,
  MenuActionHandler,
  ProfileActionHandler,
  BalanceActionHandler,
  StatisticsActionHandler,
  OrderActionHandler,
  SettingsActionHandler,
  ModerationActionHandler,
} from './handler';
import { RateLimitMiddleware } from './middleware';

/**
 * Bot Main Module
 *
 * Core business logic module for Telegram bot functionality.
 * Integrates with Grammy framework for bot interactions and Redis for session management.
 *
 * Features:
 * - Grammy bot initialization and lifecycle management
 * - Redis-based session storage with TTL support
 * - Dynamic menu generation with inline keyboards
 * - Command processing and callback handling
 * - Error handling and logging
 *
 * Architecture:
 * - Only imports shared modules to avoid circular dependencies
 * - Provides bot services for use by bot application
 * - Maintains clean domain boundaries
 *
 * @module BotMainModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Make ConfigService available globally
    RedisModule,
    DatabaseModule,
    BotSharedModule,
    AuthSharedModule,
    UserSharedModule,
    BalanceSharedModule,
    StatisticSharedModule,
    TrafficSharedModule,
    // Note: TrafficMainModule removed to prevent circular dependency
    // Traffic services are injected by the app layer
    AppCommonIntlModule,
    OrderModule,
  ],
  providers: [
    BotConfigService,
    BotService,
    MenuService,
    SessionService,
    MessageService,
    TelegramModerationNotifier,
    ModerationService,
    // Note: Handlers moved to Bot application module to prevent instantiation in API context
    // CallbackRouterHandler,
    // MenuActionHandler,
    // ProfileActionHandler,
    // BalanceActionHandler,
    // StatisticsActionHandler,
    // OrderActionHandler,
    // SettingsActionHandler,
    // ModerationActionHandler,
    RateLimitMiddleware,
  ],
  exports: [
    BotConfigService,
    BotService,
    MenuService,
    SessionService,
    MessageService,
    TelegramModerationNotifier,
    // Export middleware and service for use by Bot app
    ModerationService,
    RateLimitMiddleware,
  ],
})
export class BotMainModule {}
