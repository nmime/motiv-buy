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

  // Map entity types to their approval handlers for O(1) lookup
  private readonly approveHandlers: Record<
    ModerationEntityType,
    (requestId: string, userId: string) => Promise<void>
  > = {
    [ModerationEntityType.TrafficSource]: (requestId, userId) => this.moderationService.approveSource(requestId, userId),
    [ModerationEntityType.TrafficOrder]: (requestId, userId) => this.moderationService.approveOrder(requestId, userId),
  };

  // Map entity types to their decline handlers for O(1) lookup
  private readonly declineHandlers: Record<
    ModerationEntityType,
    (requestId: string, userId: string, reviewNote?: string) => Promise<void>
  > = {
    [ModerationEntityType.TrafficSource]: (requestId, userId, reviewNote) =>
      this.moderationService.declineSource(requestId, userId, reviewNote),
    [ModerationEntityType.TrafficOrder]: (requestId, userId, reviewNote) =>
      this.moderationService.declineOrder(requestId, userId, reviewNote),
  };

  // Map entity types to display names
  private readonly entityDisplayNames: Record<ModerationEntityType, string> = {
    [ModerationEntityType.TrafficSource]: 'Source',
    [ModerationEntityType.TrafficOrder]: 'Order',
  };

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

      // Approve using handler map (O(1) lookup)
      const approveHandler = this.approveHandlers[entityType];

      if (!approveHandler) {
        throw new Error(`Unknown entity type: ${entityType}`);
      }

      await approveHandler(requestId, userId);

      const entityName = this.entityDisplayNames[entityType];

      this.logger.log(`${entityName} approved by ${username}: ${requestId}`);

      // Update Telegram message to show approval
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateApproved(chatId, messageId, entityType, username);
      }

      await ctx.answerCallbackQuery(`✅ ${entityName} approved!`);
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

      // Decline using handler map (O(1) lookup)
      const declineHandler = this.declineHandlers[entityType];

      if (!declineHandler) {
        throw new Error(`Unknown entity type: ${entityType}`);
      }

      await declineHandler(requestId, userId, reviewNote);

      const entityName = this.entityDisplayNames[entityType];

      this.logger.log(`${entityName} declined by ${username}: ${requestId}`);

      // Update Telegram message to show decline
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateDeclined(chatId, messageId, entityType, username, reviewNote);
      }

      await ctx.answerCallbackQuery(`❌ ${entityName} declined!`);
    } catch (error) {
      this.logger.error(`Failed to decline moderation request: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery('❌ Failed to decline. Please try again.');
    }
  }
}
