import { Module } from '@nestjs/common';
import { BotFactoryService, BotSubscriptionService } from './service';

/**
 * Bot Shared Module
 *
 * Shared module that exports bot factory and subscription services,
 * along with essential types, DTOs, enums, and utilities for other
 * modules to consume.
 *
 * Provides:
 * - BotFactoryService: Create and validate bot instances (implements IBotTokenValidator)
 * - BotSubscriptionService: Check user subscriptions to chats
 */
@Module({
  imports: [],
  providers: [BotFactoryService, BotSubscriptionService],
  exports: [BotFactoryService, BotSubscriptionService],
})
export class BotSharedModule {}
