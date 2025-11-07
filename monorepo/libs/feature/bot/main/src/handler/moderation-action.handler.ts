/**
 * Moderation Action Handler
 *
 * Handles moderation approval/decline actions for traffic sources and orders.
 * Only accessible by admin users.
 *
 * Architecture Note:
 * Uses IModerationService interface from traffic-shared to avoid circular dependency.
 * NestJS will inject the concrete ModerationService implementation from traffic-main.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { ModerationEntityType } from '@app/database';
import { IModerationService } from '@app/feature-traffic-shared';
import { TelegramModerationNotifier } from '../service';
import { getErrorMessage } from '@app/common-shared';

@Injectable()
export class ModerationActionHandler {
  private readonly logger = new Logger(ModerationActionHandler.name);

  constructor(
    private readonly moderationService: IModerationService,
    private readonly telegramModerationNotifier: TelegramModerationNotifier,
  ) {}

  /**
   * Handle approve action for traffic source or order
   * Callback data format: moderation:approve:traffic_source:requestId
   * or: moderation:approve:traffic_order:requestId
   */
  async handleApprove(ctx: BotContext, entityType: ModerationEntityType, requestId: string): Promise<void> {
    try {
      // Get user from context (assuming admin check already done in router)
      const userId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!userId) {
        await ctx.answerCallbackQuery('❌ User not authenticated');
        return;
      }

      // Approve based on entity type
      if (entityType === ModerationEntityType.TrafficSource) {
        await this.moderationService.approveSource(requestId, userId);
        this.logger.log(`Source approved by ${username}: ${requestId}`);
      } else if (entityType === ModerationEntityType.TrafficOrder) {
        await this.moderationService.approveOrder(requestId, userId);
        this.logger.log(`Order approved by ${username}: ${requestId}`);
      }

      // Update Telegram message to show approval
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateApproved(chatId, messageId, entityType, username);
      }

      await ctx.answerCallbackQuery(`✅ ${entityType === ModerationEntityType.TrafficSource ? 'Source' : 'Order'} approved!`);
    } catch (error) {
      this.logger.error(`Failed to approve moderation request: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery('❌ Failed to approve. Please try again.');
    }
  }

  /**
   * Handle decline action for traffic source or order
   * Callback data format: moderation:decline:traffic_source:requestId
   * or: moderation:decline:traffic_order:requestId
   */
  async handleDecline(ctx: BotContext, entityType: ModerationEntityType, requestId: string): Promise<void> {
    try {
      // Get user from context
      const userId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!userId) {
        await ctx.answerCallbackQuery('❌ User not authenticated');
        return;
      }

      // Optional: Could add a review note in the future
      const reviewNote = undefined;

      // Decline based on entity type
      if (entityType === ModerationEntityType.TrafficSource) {
        await this.moderationService.declineSource(requestId, userId, reviewNote);
        this.logger.log(`Source declined by ${username}: ${requestId}`);
      } else if (entityType === ModerationEntityType.TrafficOrder) {
        await this.moderationService.declineOrder(requestId, userId, reviewNote);
        this.logger.log(`Order declined by ${username}: ${requestId}`);
      }

      // Update Telegram message to show decline
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateDeclined(chatId, messageId, entityType, username, reviewNote);
      }

      await ctx.answerCallbackQuery(`❌ ${entityType === ModerationEntityType.TrafficSource ? 'Source' : 'Order'} declined!`);
    } catch (error) {
      this.logger.error(`Failed to decline moderation request: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery('❌ Failed to decline. Please try again.');
    }
  }
}
