import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { getErrorMessage } from '@app/common-shared';

/**
 * Telegram Notification Service
 * Sends direct messages to users via Telegram
 *
 * Architecture Note:
 * In bot-shared to allow other modules to send notifications without
 * depending on bot-main. Bot instance is provided through setter injection.
 */
@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private bot: Bot<Context> | null = null;

  /**
   * Set bot instance (called by BotService after initialization)
   */
  setBot<C extends Context>(bot: Bot<C>): void {
    this.bot = bot as unknown as Bot<Context>;
  }

  /**
   * Send a direct message to a user by their Telegram chat ID
   * Used for notifications, alerts, and system messages
   *
   * @param chatId - Telegram chat ID (can be string or number)
   * @param text - Message text (HTML formatting supported)
   * @param options - Optional keyboard and other settings
   */
  async sendDirectMessage(
    chatId: string | number,
    text: string,
    options?: { keyboard?: InlineKeyboard; disableNotification?: boolean },
  ): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Cannot send direct message: bot not initialized');

      return false;
    }

    try {
      await this.bot.api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: options?.keyboard,
        disable_notification: options?.disableNotification,
      });

      this.logger.debug(`Direct message sent to ${chatId}`);

      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to send direct message to ${chatId}: ${getErrorMessage(error)}`);

      return false;
    }
  }
}
