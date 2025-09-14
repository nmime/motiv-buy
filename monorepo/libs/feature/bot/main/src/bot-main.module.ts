import { Module } from '@nestjs/common';
import { BotSharedModule } from '@app/feature-bot-shared';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/common-redis';
import { AuthMainModule } from '@app/feature-auth-main';
import { AuthSharedModule } from '@app/feature-auth-shared';
import { BalanceMainModule } from '@app/feature-balance-main';
import { UserMainModule } from '@app/feature-user-main';
import { StatisticMainModule } from '@app/feature-statistic-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { BotService, MenuService, SessionService } from './service';
import { CommandHandler, MenuHandler, CallbackHandler } from './handler';

/**
 * Bot Main Module
 *
 * Core business logic module for Telegram bot functionality.
 * Integrates with Grammy framework for bot interactions, Redis for session management,
 * and the existing auth system for user authentication and management.
 *
 * Features:
 * - Grammy bot initialization and lifecycle management
 * - Redis-based session storage with TTL support
 * - Dynamic menu generation with inline keyboards
 * - Authentication integration with existing auth services
 * - Command processing and callback handling
 * - Error handling and logging
 *
 * @module BotMainModule
 */
@Module({
  imports: [
    // Core infrastructure
    DatabaseModule,
    RedisModule,

    // Bot-specific modules
    BotSharedModule,

    // Authentication modules
    AuthMainModule,
    AuthSharedModule,

    // Business domain modules
    BalanceMainModule,
    UserMainModule,
    StatisticMainModule,
    TrafficMainModule,
  ],
  providers: [
    // Core bot services
    BotService,
    MenuService,
    SessionService,

    // Bot handlers
    CommandHandler,
    MenuHandler,
    CallbackHandler,
  ],
  exports: [
    // Export services for use in applications
    BotService,
    MenuService,
    SessionService,

    // Export handlers for direct use if needed
    CommandHandler,
    MenuHandler,
    CallbackHandler,
  ],
})
export class BotMainModule {}
