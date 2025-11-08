/* eslint-disable @nx/enforce-module-boundaries */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { TrafficSourceEntity, TrafficOrderEntity, ModerationRequestEntity, ModerationEntityType } from '@app/database';
import { InlineKeyboard } from 'grammy';
import { getErrorMessage } from '@app/common-shared';

/**
 * Telegram Moderation Notifier
 * Sends moderation requests to Telegram channel for admin approval
 */
@Injectable()
export class TelegramModerationNotifier {
  private readonly logger = new Logger(TelegramModerationNotifier.name);
  private readonly moderationChannelId: string;

  constructor(
    private readonly bot: Bot<BotContext>,
    private readonly configService: ConfigService,
  ) {
    this.moderationChannelId = this.configService.get<string>('TELEGRAM_MODERATION_CHANNEL_ID') ?? '';

    if (!this.moderationChannelId) {
      this.logger.warn('TELEGRAM_MODERATION_CHANNEL_ID not configured. Moderation notifications disabled.');
    }
  }

  /**
   * Send traffic source moderation request to channel
   */
  async notifySourceCreated(
    source: TrafficSourceEntity,
    moderationRequest: ModerationRequestEntity,
  ): Promise<{
    chatId: string;
    messageId: number;
  } | null> {
    if (!this.moderationChannelId) {
      this.logger.warn('Moderation channel not configured. Skipping notification.');

      return null;
    }

    try {
      const message = this.formatSourceMessage(source);
      const keyboard = this.createModerationKeyboard(moderationRequest.id, ModerationEntityType.TrafficSource);

      const sentMessage = await this.bot.api.sendMessage(this.moderationChannelId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      this.logger.log(`Source moderation notification sent: ${source.id}`);

      return {
        chatId: sentMessage.chat.id.toString(),
        messageId: sentMessage.message_id,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to send source moderation notification: ${getErrorMessage(error)}`, {
        sourceId: source.id,
        error,
      });

      return null;
    }
  }

  /**
   * Send traffic order moderation request to channel
   */
  async notifyOrderCreated(
    order: TrafficOrderEntity,
    moderationRequest: ModerationRequestEntity,
  ): Promise<{
    chatId: string;
    messageId: number;
  } | null> {
    if (!this.moderationChannelId) {
      this.logger.warn('Moderation channel not configured. Skipping notification.');

      return null;
    }

    try {
      const message = await this.formatOrderMessage(order);
      const keyboard = this.createModerationKeyboard(moderationRequest.id, ModerationEntityType.TrafficOrder);

      const sentMessage = await this.bot.api.sendMessage(this.moderationChannelId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      this.logger.log(`Order moderation notification sent: ${order.id}`);

      return {
        chatId: sentMessage.chat.id.toString(),
        messageId: sentMessage.message_id,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to send order moderation notification: ${getErrorMessage(error)}`, {
        orderId: order.id,
        error,
      });

      return null;
    }
  }

  /**
   * Update message after approval
   */
  async updateApproved(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
  ): Promise<void> {
    try {
      const statusMessage = `\n\n✅ <b>Approved</b> by @${reviewerUsername}`;
      const entityName = entityType === ModerationEntityType.TrafficSource ? 'Source' : 'Order';

      await this.bot.api.editMessageText(chatId, messageId, `${entityName} approved${statusMessage}`, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Moderation message updated: approved by ${reviewerUsername}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to update approval message: ${getErrorMessage(error)}`, { chatId, messageId, error });
    }
  }

  /**
   * Update message after decline
   */
  async updateDeclined(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
    reviewNote?: string,
  ): Promise<void> {
    try {
      const note = reviewNote ? `\n<i>Note: ${reviewNote}</i>` : '';
      const statusMessage = `\n\n❌ <b>Declined</b> by @${reviewerUsername}${note}`;
      const entityName = entityType === ModerationEntityType.TrafficSource ? 'Source' : 'Order';

      await this.bot.api.editMessageText(chatId, messageId, `${entityName} declined${statusMessage}`, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Moderation message updated: declined by ${reviewerUsername}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to update decline message: ${getErrorMessage(error)}`, { chatId, messageId, error });
    }
  }

  /**
   * Format traffic source message for moderation
   */
  private formatSourceMessage(source: TrafficSourceEntity): string {
    const lines = [
      '🤖 <b>New Traffic Source - Awaiting Moderation</b>',
      '',
      `📛 <b>Name:</b> ${source.name}`,
      `📝 <b>Description:</b> ${source.description ?? 'N/A'}`,
      `🔧 <b>Type:</b> ${source.type}`,
      `🆔 <b>Telegram ID:</b> ${source.telegramId ?? 'N/A'}`,
      `👤 <b>Username:</b> @${source.botUsername ?? 'N/A'}`,
      `🔑 <b>Source ID:</b> <code>${source.id}</code>`,
      '',
      '⏰ Please review and approve/decline this traffic source.',
    ];

    return lines.join('\n');
  }

  /**
   * Format traffic order message for moderation
   */
  private async formatOrderMessage(order: TrafficOrderEntity): Promise<string> {
    // Load required relations in parallel to avoid N+1 queries
    // Note: These are required relations (nullable: false), so we use .load() without ?.
    // The fallback values (?? 'Unknown') handle display if relations fail to load
    const [creator, trafficSource, trafficTarget] = await Promise.all([
      order.creator.load(),
      order.trafficSource.load(),
      order.trafficTarget.load(),
    ]);

    const lines = [
      '📋 <b>New Traffic Order - Awaiting Moderation</b>',
      '',
      `🎯 <b>Type:</b> ${order.type}`,
      `📊 <b>Target Count:</b> ${order.targetCount}`,
      `💰 <b>Price per Action:</b> ${order.pricePerAction}`,
      `💵 <b>Total Budget:</b> ${order.totalBudget}`,
      `🔗 <b>Target URL:</b> ${order.targetUrl ?? 'N/A'}`,
      `📝 <b>Description:</b> ${order.description ?? 'N/A'}`,
      '',
      `👤 <b>Creator:</b> ${creator?.username ?? 'Unknown'} (ID: ${creator?.id ?? 'N/A'})`,
      `🤖 <b>Source:</b> ${trafficSource?.name ?? 'Unknown'}`,
      `🎯 <b>Target:</b> ${trafficTarget?.id ?? 'Unknown'}`,
      '',
      `🔑 <b>Order ID:</b> <code>${order.id}</code>`,
      '',
      '⏰ Please review and approve/decline this order.',
    ];

    return lines.join('\n');
  }

  /**
   * Create inline keyboard with approve/decline buttons
   */
  private createModerationKeyboard(moderationRequestId: string, entityType: ModerationEntityType): InlineKeyboard {
    const keyboard = new InlineKeyboard()
      .text('✅ Approve', `moderation:approve:${entityType}:${moderationRequestId}`)
      .text('❌ Decline', `moderation:decline:${entityType}:${moderationRequestId}`);

    return keyboard;
  }
}
