import { Module } from '@nestjs/common';
import { BotSharedModule } from '@app/feature-bot-shared';
import { RedisModule } from '@app/common-redis';
import { DatabaseModule } from '@app/database';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { UserSharedModule } from '@app/feature-user-shared';
import { BalanceSharedModule } from '@app/feature-balance-shared';
import { StatisticSharedModule } from '@app/feature-statistic-shared';
import { TrafficSharedModule } from '@app/feature-traffic-shared';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { AppCommonIntlModule } from '@app/common-intl';
import { BotService, BotUserService, BotSessionService, MenuService, MessageService, SessionService } from './service';
import { BotConfigModule } from './config';
import { OrderModule } from './handler/order/order.module';
import {
  CallbackRouterHandler,
  MenuActionHandler,
  ProfileActionHandler,
  BalanceActionHandler,
  StatisticsActionHandler,
  OrderActionHandler,
  SettingsActionHandler,
  SupportHandler,
  HelpHandler,
  TrafficHandler,
  MiscMenuHandler,
  InformationCommandHandler,
  // Routing handlers
  TrafficRoutingHandler,
  BalanceRoutingHandler,
  OrderRoutingHandler,
  SettingsRoutingHandler,
  MenuRoutingHandler,
} from './handler';
import { RateLimitMiddleware } from './middleware';
import { BotWebhookController } from './controller';

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
    BotConfigModule,
    RedisModule,
    DatabaseModule,
    BotSharedModule,
    AuthSharedModule,
    UserSharedModule,
    BalanceSharedModule,
    StatisticSharedModule,
    TrafficSharedModule,
    PaymentSharedModule,
    AppCommonIntlModule,
    OrderModule,
  ],
  controllers: [BotWebhookController],
  providers: [
    BotService,
    BotUserService,
    BotSessionService,
    MenuService,
    SessionService,
    MessageService,
    CallbackRouterHandler,
    MenuActionHandler,
    ProfileActionHandler,
    BalanceActionHandler,
    StatisticsActionHandler,
    OrderActionHandler,
    SettingsActionHandler,
    SupportHandler,
    HelpHandler,
    TrafficHandler,
    MiscMenuHandler,
    InformationCommandHandler,
    TrafficRoutingHandler,
    BalanceRoutingHandler,
    OrderRoutingHandler,
    SettingsRoutingHandler,
    MenuRoutingHandler,
    RateLimitMiddleware,
  ],
  exports: [
    BotSharedModule,
    BotService,
    BotUserService,
    BotSessionService,
    MenuService,
    SessionService,
    MessageService,
    InformationCommandHandler,
    RateLimitMiddleware,
  ],
})
export class BotMainModule {}
