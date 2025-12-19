/**
 * Message Service
 *
 * Provides unified interface for sending and editing messages.
 * Automatically handles message editing vs sending based on context.
 * Includes date/time formatting with locale support.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { defaultLanguage } from '@app/common-shared';
import { InlineKeyboard } from 'grammy';
import { I18nService } from 'nestjs-i18n';

/**
 * Default parse mode for all messages
 */
const defaultParseMode = 'HTML' as const;

/**
 * Supported parse modes for Telegram messages
 */
type ParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

/**
 * Options for sending/editing messages
 */
interface MessageOptions {
  text: string;
  parseMode?: ParseMode;
  replyMarkup?: InlineKeyboard;
  disableNotification?: boolean;
}

/**
 * Locale to Intl locale mapping
 */
const localeMap: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
};

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly i18n: I18nService) {}

  /**
   * Send or edit a message based on context
   * Automatically detects if we're responding to a callback and edits the message,
   * otherwise sends a new message.
   */
  async sendOrEditMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    const messageId = ctx.callbackQuery?.message?.message_id;
    const chatId = this.getChatId(ctx);

    if (messageId) {
      await this.tryEditMessage(ctx, chatId, messageId, options);
    } else {
      await this.sendReply(ctx, options);
    }
  }

  /**
   * Send new message (always creates new message)
   */
  async sendNewMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    this.getChatId(ctx); // Validates chat exists
    await this.sendReply(ctx, options);
  }

  /**
   * Edit existing message
   * Falls back to sendOrEditMessage if no message ID found
   */
  async editMessage(ctx: BotContext, options: MessageOptions): Promise<void> {
    const messageId = ctx.callbackQuery?.message?.message_id;
    const chatId = this.getChatId(ctx);

    if (!messageId) {
      this.logger.warn('No message ID found, sending new message instead');
      await this.sendOrEditMessage(ctx, options);

      return;
    }

    try {
      await this.editMessageText(ctx, chatId, messageId, options);
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
   * Format date using user's locale
   * @param ctx - Bot context to get locale from
   * @param date - Date to format (handles undefined gracefully)
   * @returns Formatted date string (e.g., "Dec 17, 2025" for en-US, "17 дек. 2025 г." for ru-RU)
   */
  formatDate(ctx: BotContext, date: Date | undefined): string {
    if (!date) {
      return ctx.t('common.unknown');
    }

    return new Intl.DateTimeFormat(this.getLocale(ctx), {
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

    return new Intl.DateTimeFormat(this.getLocale(ctx), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Get chat ID from context, throws if not found
   */
  private getChatId(ctx: BotContext): number {
    const chatId = ctx.chat?.id;

    if (!chatId) {
      throw new Error(this.i18n.t('common.errors.chat_id_not_found'));
    }

    return chatId;
  }

  /**
   * Get user's locale from context
   */
  private getLocale(ctx: BotContext): string {
    const sessionLang = ctx.session?.language;
    const fromLang = ctx.from?.language_code;
    const baseLang = sessionLang ?? fromLang ?? defaultLanguage;

    return localeMap[baseLang] ?? localeMap[defaultLanguage];
  }

  /**
   * Send a reply message
   */
  private async sendReply(ctx: BotContext, options: MessageOptions): Promise<void> {
    const chatId = ctx.chat?.id;
    this.logger.debug('Sending new message', { chatId });

    await ctx.reply(options.text, {
      parse_mode: options.parseMode ?? defaultParseMode,
      reply_markup: options.replyMarkup,
      disable_notification: options.disableNotification,
    });
  }

  /**
   * Edit message text with error handling
   */
  private async editMessageText(
    ctx: BotContext,
    chatId: number,
    messageId: number,
    options: MessageOptions,
  ): Promise<void> {
    this.logger.debug('Editing message', { messageId, chatId });

    await ctx.api.editMessageText(chatId, messageId, options.text, {
      parse_mode: options.parseMode ?? defaultParseMode,
      reply_markup: options.replyMarkup,
    });
  }

  /**
   * Try to edit message, fall back to sending new one on specific errors
   */
  private async tryEditMessage(
    ctx: BotContext,
    chatId: number,
    messageId: number,
    options: MessageOptions,
  ): Promise<void> {
    try {
      await this.editMessageText(ctx, chatId, messageId, options);
    } catch (error) {
      if (this.isMessageNotModifiedError(error)) {
        this.logger.debug('Message not modified, skipping edit');

        return;
      }

      if (this.isMessageNotFoundError(error)) {
        this.logger.debug('Message not found, sending new message', { messageId });
        await this.sendReply(ctx, options);

        return;
      }

      this.logger.error('Failed to send/edit message', { error, messageId, chatId });
      throw error;
    }
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
}
