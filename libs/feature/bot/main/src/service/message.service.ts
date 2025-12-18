/**
 * Message Service
 *
 * Provides unified interface for sending and editing messages.
 * Automatically handles message editing vs sending based on context.
 * Includes date/time formatting with locale support.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { InlineKeyboard } from 'grammy';
import { I18nService } from 'nestjs-i18n';

interface MessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: InlineKeyboard;
  disableNotification?: boolean;
}

/**
 * Locale to Intl locale mapping
 */
const LocaleMap: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
};

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly i18n: I18nService) {}

  /**
   * Send or edit a message based on context
   */
  async sendOrEditMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    const messageId = ctx.callbackQuery?.message?.message_id;
    const chatId = ctx.chat?.id;

    if (!chatId) {
      throw new Error(this.i18n.t('common.errors.chat_id_not_found'));
    }

    try {
      if (messageId) {
        // Edit existing message
        this.logger.debug('Editing message', { messageId, chatId });
        await ctx.api.editMessageText(chatId, messageId, options.text, {
          parse_mode: options.parseMode ?? 'HTML',
          reply_markup: options.replyMarkup,
        });

        return;
      }

      // Send new message
      this.logger.debug('Sending new message', { chatId });
      await ctx.reply(options.text, {
        parse_mode: options.parseMode,
        reply_markup: options.replyMarkup,
        disable_notification: options.disableNotification,
      });
    } catch (error) {
      // If edit failed because message wasn't modified, that's ok
      if (this.isMessageNotModifiedError(error)) {
        this.logger.debug('Message not modified, skipping edit');

        return;
      }

      // If edit failed because message doesn't exist, send new one
      if (this.isMessageNotFoundError(error)) {
        this.logger.debug('Message not found, sending new message', { messageId });
        await ctx.reply(options.text, {
          parse_mode: options.parseMode ?? 'HTML',
          reply_markup: options.replyMarkup,
          disable_notification: options.disableNotification,
        });

        return;
      }

      this.logger.error('Failed to send/edit message', { error, messageId, chatId });
      throw error;
    }
  }

  /**
   * Send new message (always creates new message)
   */
  async sendNewMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    const chatId = ctx.chat?.id;

    if (!chatId) {
      throw new Error(this.i18n.t('common.errors.chat_id_not_found'));
    }

    this.logger.debug('Sending new message', { chatId });

    await ctx.reply(options.text, {
      parse_mode: options.parseMode,
      reply_markup: options.replyMarkup,
      disable_notification: options.disableNotification,
    });
  }

  /**
   * Edit existing message
   */
  async editMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    const messageId = ctx.callbackQuery?.message?.message_id;
    const chatId = ctx.chat?.id;

    if (!chatId) {
      throw new Error(this.i18n.t('common.errors.chat_id_not_found'));
    }

    if (!messageId) {
      this.logger.warn('No message ID found, sending new message instead');
      await this.sendOrEditMessage(ctx, options);

      return;
    }

    try {
      this.logger.debug('Editing message', { messageId, chatId });
      await ctx.api.editMessageText(chatId, messageId, options.text, {
        parse_mode: options.parseMode,
        reply_markup: options.replyMarkup,
      });
    } catch (error) {
      if (this.isMessageNotModifiedError(error)) {
        this.logger.debug('Message not modified');

        return;
      }

      this.logger.error('Failed to edit message', { error, messageId, chatId });
      throw error;
    }
  }

  /**
   * Delete current message
   */
  async deleteMessage(ctx: BotContext): Promise<void> {
    const messageId = ctx.callbackQuery?.message?.message_id;
    const chatId = ctx.chat?.id;

    if (!chatId || !messageId) {
      return;
    }

    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      this.logger.error('Failed to delete message', { error, messageId, chatId });
    }
  }

  /**
   * Clear stored message ID
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clearMessageId(ctx: BotContext): void {
    // Not needed anymore - using callbackQuery.message
  }

  /**
   * Check if error is "message not modified"
   */
  private isMessageNotModifiedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return message.includes('message is not modified') || message.includes('400');
  }

  /**
   * Check if error is "message not found"
   */
  private isMessageNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return message.includes('message to edit not found') || message.includes('message not found');
  }

  /**
   * Get user's locale from context
   * Checks session language, from.language_code, or falls back to 'en'
   */
  private getLocale(ctx: BotContext): string {
    const sessionLang = ctx.session?.language;
    const fromLang = ctx.from?.language_code;
    const baseLang = sessionLang ?? fromLang ?? 'en';

    return LocaleMap[baseLang] ?? LocaleMap['en'];
  }

  /**
   * Format date using user's locale
   * @param ctx - Bot context to get locale from
   * @param date - Date to format (handles undefined gracefully)
   * @returns Formatted date string (e.g., "Dec 17, 2025" for en-US, "17 дек. 2025 г." for ru-RU)
   */
  formatDate(ctx: BotContext, date: Date | undefined): string {
    if (!date) {
      return ctx.t('common.unknown');
    }

    const locale = this.getLocale(ctx);

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Format date and time using user's locale
   * @param ctx - Bot context to get locale from
   * @param date - Date to format (handles undefined gracefully)
   * @returns Formatted date/time string (e.g., "Dec 17, 2025, 10:30 PM")
   */
  formatDateTime(ctx: BotContext, date: Date | undefined): string {
    if (!date) {
      return ctx.t('common.unknown');
    }

    const locale = this.getLocale(ctx);

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Format relative time (e.g., "2 hours ago", "in 3 days")
   * @param ctx - Bot context to get locale from
   * @param date - Date to calculate relative time from
   * @returns Formatted relative time string
   */
  formatRelativeTime(ctx: BotContext, date: Date | undefined): string {
    if (!date) {
      return ctx.t('common.unknown');
    }

    const locale = this.getLocale(ctx);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    }

    if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    }

    if (Math.abs(diffMins) >= 1) {
      return rtf.format(diffMins, 'minute');
    }

    return rtf.format(diffSecs, 'second');
  }
}
