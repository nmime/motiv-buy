import { Module } from '@nestjs/common';
import { BotFactoryService, BotSubscriptionService, TelegramModerationNotifier } from './service';

/**
 * Bot Shared Module
 *
 * Shared module that exports bot factory, subscription services, and moderation notifier,
 * along with essential types, DTOs, enums, and utilities for other
 * modules to consume.
 *
 * Provides:
 * - BotFactoryService: Create and validate bot instances (implements IBotTokenValidator)
 * - BotSubscriptionService: Check user subscriptions to chats
 * - TelegramModerationNotifier: Send moderation notifications to Telegram
 */
@Module({
  imports: [],
  providers: [BotFactoryService, BotSubscriptionService, TelegramModerationNotifier],
  exports: [BotFactoryService, BotSubscriptionService, TelegramModerationNotifier],
})
export class BotSharedModule {}
