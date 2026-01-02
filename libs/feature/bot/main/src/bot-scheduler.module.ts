import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { AppCommonIntlModule } from '@app/common-intl';
import { BotSharedModule } from '@app/feature-bot-shared';
import { PaymentNotificationHandler } from './handler/payment-notification.handler';

/**
 * Bot Scheduler Module
 *
 * Contains event listeners and scheduled tasks that should only run in the bot application.
 * This module is separate from BotMainModule to prevent cron jobs and event listeners
 * from running in the API application.
 *
 * Features:
 * - Payment notification handler (listens for balance credited events)
 * - Future: Any other bot-specific cron jobs or event listeners
 *
 * Usage:
 * - Import in apps/bot only
 * - Do NOT import in apps/api
 *
 * Note: PaymentPollingService is registered directly in apps/bot/src/bot.module.ts
 * to avoid importing @app/feature-payment-main from libs.
 *
 * Architecture:
 * - Uses BotSharedModule for TelegramNotificationService (no circular dependency)
 * - PaymentNotificationHandler uses TelegramNotificationService to send messages
 */
@Module({
  imports: [
    DatabaseModule,
    BotSharedModule, // Provides TelegramNotificationService
    PaymentSharedModule,
    AppCommonIntlModule,
  ],
  providers: [PaymentNotificationHandler],
  exports: [PaymentNotificationHandler],
})
export class BotSchedulerModule {}
