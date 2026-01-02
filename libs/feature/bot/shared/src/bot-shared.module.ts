import { Module } from '@nestjs/common';
import {
  BotFactoryService,
  BotSubscriptionService,
  ChannelService,
  TelegramModerationNotifier,
  TelegramNotificationService,
} from './service';

/**
 * Bot Shared Module
 *
 * Shared module that exports bot factory, subscription services, and notification services,
 * along with essential types, DTOs, enums, and utilities for other
 * modules to consume.
 *
 * Provides:
 * - BotFactoryService: Create and validate bot instances (implements IBotTokenValidator)
 * - BotSubscriptionService: Check user subscriptions to chats
 * - ChannelService: High-level channel operations with automatic token management
 * - TelegramModerationNotifier: Send moderation notifications to Telegram
 * - TelegramNotificationService: Send direct messages to users
 */
@Module({
  imports: [],
  providers: [
    BotFactoryService,
    BotSubscriptionService,
    ChannelService,
    TelegramModerationNotifier,
    TelegramNotificationService,
  ],
  exports: [
    BotFactoryService,
    BotSubscriptionService,
    ChannelService,
    TelegramModerationNotifier,
    TelegramNotificationService,
  ],
})
export class BotSharedModule {}
