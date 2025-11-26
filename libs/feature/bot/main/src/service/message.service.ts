/**
 * Message Service
 *
 * Provides unified interface for sending and editing messages.
 * Automatically handles message editing vs sending based on context.
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
}
