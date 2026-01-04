import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ModerationEntityType,
  ModerationRequestEntity,
  TrafficOrderEntity,
  TrafficSourceEntity,
  TrafficTargetEntity,
} from '@app/database';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { getErrorMessage } from '@app/common-shared';

/**
 * Telegram Moderation Notifier
 * Sends moderation requests to Telegram channel for admin approval
 *
 * Architecture Note:
 * Moved to bot-shared to allow traffic-main to use it without violating
 * the rule that main modules cannot import other main modules.
 * Bot instance is provided through setter injection to avoid circular dependencies.
 */
@Injectable()
export class TelegramModerationNotifier {
  private readonly logger = new Logger(TelegramModerationNotifier.name);
  private readonly moderationChannelId: string;
  private bot: Bot<Context> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.moderationChannelId = this.configService.get<string>('TELEGRAM_MODERATION_CHANNEL_ID') ?? '';

    if (!this.moderationChannelId) {
      this.logger.warn('TELEGRAM_MODERATION_CHANNEL_ID not configured. Moderation notifications disabled.');
    }
  }

  /**
   * Set bot instance (called by BotService after initialization)
   * Accepts any Bot type to allow flexibility with different context types
   */
  setBot<C extends Context>(bot: Bot<C>): void {
    // Cast to base Context type for internal storage since we only use bot.api methods
    this.bot = bot as unknown as Bot<Context>;
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
      if (!this.bot) {
        this.logger.error('Bot not initialized. Cannot send notification.');

        return null;
      }

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
      if (!this.bot) {
        this.logger.error('Bot not initialized. Cannot send notification.');

        return null;
      }

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
   * Send traffic target moderation request to channel
   */
  async notifyTargetCreated(
    target: TrafficTargetEntity,
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
      if (!this.bot) {
        this.logger.error('Bot not initialized. Cannot send notification.');

        return null;
      }

      const message = await this.formatTargetMessage(target);
      const keyboard = this.createModerationKeyboard(moderationRequest.id, ModerationEntityType.TrafficTarget);

      const sentMessage = await this.bot.api.sendMessage(this.moderationChannelId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      this.logger.log(`Target moderation notification sent: ${target.id}`);

      return {
        chatId: sentMessage.chat.id.toString(),
        messageId: sentMessage.message_id,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to send target moderation notification: ${getErrorMessage(error)}`, {
        targetId: target.id,
        error,
      });

      return null;
    }
  }

  /**
   * Update message after approval
   * Keeps original message content, replaces header with approval status, removes buttons
   */
  async updateApproved(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
    originalText?: string,
  ): Promise<void> {
    try {
      if (!this.bot) {
        this.logger.error('Bot not initialized. Cannot update message.');

        return;
      }

      const statusLine = `✅ <b>Approved</b> by @${reviewerUsername}`;
      let updatedText: string;

      if (originalText) {
        // Replace the header and remove the "Please review" line
        updatedText = originalText
          .replace(/🤖 <b>New Traffic Source - Awaiting Moderation<\/b>/, `🤖 <b>Traffic Source - ${statusLine}</b>`)
          .replace(/🎯 <b>New Traffic Target - Awaiting Moderation<\/b>/, `🎯 <b>Traffic Target - ${statusLine}</b>`)
          .replace(/📋 <b>New Traffic Order - Awaiting Moderation<\/b>/, `📋 <b>Traffic Order - ${statusLine}</b>`)
          .replace(/\n\n⏰ Please review and approve\/decline this (traffic source|traffic target|order)\./, '');
      } else {
        const entityNameMap: Record<ModerationEntityType, string> = {
          [ModerationEntityType.TrafficSource]: 'Source',
          [ModerationEntityType.TrafficTarget]: 'Target',
          [ModerationEntityType.TrafficOrder]: 'Order',
        };

        const entityName = entityNameMap[entityType];
        updatedText = `${entityName} approved\n\n${statusLine}`;
      }

      await this.bot.api.editMessageText(chatId, messageId, updatedText, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Moderation message updated: approved by ${reviewerUsername}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to update approval message: ${getErrorMessage(error)}`, { chatId, messageId, error });
    }
  }

  /**
   * Update message after decline
   * Keeps original message content, replaces header with decline status, removes buttons
   */
  async updateDeclined(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
    reviewNote?: string,
    originalText?: string,
  ): Promise<void> {
    try {
      if (!this.bot) {
        this.logger.error('Bot not initialized. Cannot update message.');

        return;
      }

      const note = reviewNote ? ` - ${reviewNote}` : '';
      const statusLine = `❌ <b>Declined</b> by @${reviewerUsername}${note}`;
      let updatedText: string;

      if (originalText) {
        // Replace the header and remove the "Please review" line
        updatedText = originalText
          .replace(/🤖 <b>New Traffic Source - Awaiting Moderation<\/b>/, `🤖 <b>Traffic Source - ${statusLine}</b>`)
          .replace(/🎯 <b>New Traffic Target - Awaiting Moderation<\/b>/, `🎯 <b>Traffic Target - ${statusLine}</b>`)
          .replace(/📋 <b>New Traffic Order - Awaiting Moderation<\/b>/, `📋 <b>Traffic Order - ${statusLine}</b>`)
          .replace(/\n\n⏰ Please review and approve\/decline this (traffic source|traffic target|order)\./, '');
      } else {
        const entityNameMap: Record<ModerationEntityType, string> = {
          [ModerationEntityType.TrafficSource]: 'Source',
          [ModerationEntityType.TrafficTarget]: 'Target',
          [ModerationEntityType.TrafficOrder]: 'Order',
        };

        const entityName = entityNameMap[entityType];
        updatedText = `${entityName} declined\n\n${statusLine}`;
      }

      await this.bot.api.editMessageText(chatId, messageId, updatedText, {
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
   * Format traffic target message for moderation
   */
  private async formatTargetMessage(target: TrafficTargetEntity): Promise<string> {
    const owner = await target.managedBy?.load();
    const usernameDisplay = target.username ? `@${target.username}` : 'N/A';

    const lines = [
      '🎯 <b>New Traffic Target - Awaiting Moderation</b>',
      '',
      `📛 <b>Name:</b> ${target.name}`,
      `📝 <b>Description:</b> ${target.description ?? 'N/A'}`,
      `🔧 <b>Type:</b> ${target.type}`,
      `🆔 <b>Telegram ID:</b> ${target.telegramId ?? 'N/A'}`,
      `👤 <b>Username:</b> ${usernameDisplay}`,
      `🔗 <b>Invite Link:</b> ${target.inviteLink ?? 'N/A'}`,
      '',
      `👤 <b>Owner:</b> ${owner?.username ?? 'Unknown'} (ID: ${owner?.id ?? 'N/A'})`,
      `🔑 <b>Target ID:</b> <code>${target.id}</code>`,
      '',
      '⏰ Please review and approve/decline this traffic target.',
    ];

    return lines.join('\n');
  }

  /**
   * Format traffic order message for moderation
   */
  private async formatOrderMessage(order: TrafficOrderEntity): Promise<string> {
    const creator = await order.creator.load();
    const orderSources = order.orderSources?.getItems() ?? [];
    const orderTargets = order.orderTargets?.getItems() ?? [];

    const sourcesInfo = this.formatSourcesList(orderSources);
    const targetsInfo = this.formatTargetsList(orderTargets);
    const sourcesDisplay = orderSources.length > 0 ? `\n  • ${sourcesInfo}` : sourcesInfo;
    const targetsDisplay = orderTargets.length > 0 ? `\n  • ${targetsInfo}` : targetsInfo;

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
      `🤖 <b>Sources:</b>${sourcesDisplay}`,
      `🎯 <b>Targets:</b>${targetsDisplay}`,
      '',
      `🔑 <b>Order ID:</b> <code>${order.id}</code>`,
      '',
      '⏰ Please review and approve/decline this order.',
    ];

    return lines.join('\n');
  }

  /**
   * Format sources list with names and usernames
   */
  private formatSourcesList(
    orderSources: Array<{ trafficSource: { id: string } & Partial<TrafficSourceEntity> }>,
  ): string {
    if (orderSources.length === 0) {
      return 'Not assigned';
    }

    return orderSources
      .map((os) => {
        const source = os.trafficSource;
        const name = 'name' in source ? source.name : source.id;
        const type = 'type' in source ? source.type : '?';
        const username = 'botUsername' in source && source.botUsername ? ` (@${source.botUsername})` : '';

        return `${name} [${type}]${username}`;
      })
      .join('\n  • ');
  }

  /**
   * Format targets list with names and usernames
   */
  private formatTargetsList(
    orderTargets: Array<{ trafficTarget: { id: string } & Partial<TrafficTargetEntity> }>,
  ): string {
    if (orderTargets.length === 0) {
      return 'Not assigned';
    }

    return orderTargets
      .map((ot) => {
        const target = ot.trafficTarget;
        const name = 'name' in target ? target.name : target.id;
        const type = 'type' in target ? target.type : '?';
        const username = 'username' in target && target.username ? ` (@${target.username})` : '';

        return `${name} [${type}]${username}`;
      })
      .join('\n  • ');
  }

  /**
   * Create inline keyboard with approve/decline buttons
   * Uses shortened callback format to stay within Telegram's 64-byte limit:
   * - mod:a:src:<id> for approve traffic_source
   * - mod:a:tgt:<id> for approve traffic_target
   * - mod:d:ord:<id> for decline traffic_order
   */
  private createModerationKeyboard(moderationRequestId: string, entityType: ModerationEntityType): InlineKeyboard {
    const typeShortMap: Record<ModerationEntityType, string> = {
      [ModerationEntityType.TrafficSource]: 'src',
      [ModerationEntityType.TrafficTarget]: 'tgt',
      [ModerationEntityType.TrafficOrder]: 'ord',
    };

    const typeShort = typeShortMap[entityType];

    const keyboard = new InlineKeyboard()
      .text('✅ Approve', `mod:a:${typeShort}:${moderationRequestId}`)
      .text('❌ Decline', `mod:d:${typeShort}:${moderationRequestId}`);

    return keyboard;
  }
}
