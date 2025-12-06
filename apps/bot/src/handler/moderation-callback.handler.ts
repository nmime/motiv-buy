/**
 * Moderation Callback Handler
 *
 * App-layer handler for moderation callbacks (approve/decline).
 * Uses ModerationService from traffic-main for business logic.
 *
 * Callback format: moderation:approve:traffic_source:requestId
 * or: moderation:decline:traffic_order:requestId
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext, TelegramModerationNotifier } from '@app/feature-bot-shared';
import { ModerationEntityType } from '@app/database';
import { ModerationService } from '@app/feature-traffic-main';
import { getErrorMessage } from '@app/common-shared';

type ModerationAction = 'approve' | 'decline';

@Injectable()
export class ModerationCallbackHandler {
  private readonly logger = new Logger(ModerationCallbackHandler.name);

  // Map string to ModerationEntityType for O(1) lookup
  private readonly entityTypeMap: Record<string, ModerationEntityType> = {
    traffic_source: ModerationEntityType.TrafficSource,
    traffic_order: ModerationEntityType.TrafficOrder,
  };

  // Map entity types to display names
  private readonly entityDisplayNames: Record<ModerationEntityType, string> = {
    [ModerationEntityType.TrafficSource]: 'Source',
    [ModerationEntityType.TrafficOrder]: 'Order',
  };

  // Map entity types to approval handlers
  private readonly approveHandlers: Record<ModerationEntityType, (requestId: string, userId: string) => Promise<void>>;

  // Map entity types to decline handlers
  private readonly declineHandlers: Record<
    ModerationEntityType,
    (requestId: string, userId: string, reviewNote?: string) => Promise<void>
  >;

  constructor(
    private readonly moderationService: ModerationService,
    private readonly telegramModerationNotifier: TelegramModerationNotifier,
  ) {
    this.approveHandlers = {
      [ModerationEntityType.TrafficSource]: (requestId, userId) =>
        this.moderationService.approveSource(requestId, userId),
      [ModerationEntityType.TrafficOrder]: (requestId, userId) =>
        this.moderationService.approveOrder(requestId, userId),
    };

    this.declineHandlers = {
      [ModerationEntityType.TrafficSource]: (requestId, userId, reviewNote) =>
        this.moderationService.declineSource(requestId, userId, reviewNote),
      [ModerationEntityType.TrafficOrder]: (requestId, userId, reviewNote) =>
        this.moderationService.declineOrder(requestId, userId, reviewNote),
    };
  }

  /**
   * Check if this handler should process the callback
   */
  canHandle(callbackData: string): boolean {
    return callbackData.startsWith('moderation:');
  }

  /**
   * Route moderation callback to appropriate handler
   * Format: moderation:action:entityType:requestId
   */
  async handleCallback(ctx: BotContext): Promise<boolean> {
    const data = ctx.callbackQuery?.data;

    if (!data || !this.canHandle(data)) {
      return false;
    }

    const [, action, entityTypeStr, requestId] = data.split(':');

    // Validate action
    if (action !== 'approve' && action !== 'decline') {
      this.logger.warn('Unknown moderation action', { action, data });
      await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));

      return true;
    }

    // Validate entity type
    const entityType = this.entityTypeMap[entityTypeStr];

    if (!entityType) {
      this.logger.warn('Unknown entity type', { entityTypeStr, data });
      await ctx.answerCallbackQuery(ctx.t('common.errors.invalid_input'));

      return true;
    }

    // Validate request ID
    if (!requestId) {
      this.logger.warn('Missing request ID', { data });
      await ctx.answerCallbackQuery(ctx.t('common.errors.invalid_input'));

      return true;
    }

    // Route to appropriate action
    const actionHandlers: Record<ModerationAction, () => Promise<void>> = {
      approve: () => this.handleApprove(ctx, entityType, requestId),
      decline: () => this.handleDecline(ctx, entityType, requestId),
    };

    await actionHandlers[action]();

    return true;
  }

  /**
   * Handle approve action
   */
  private async handleApprove(ctx: BotContext, entityType: ModerationEntityType, requestId: string): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!userId) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      const approveHandler = this.approveHandlers[entityType];
      await approveHandler(requestId, userId);

      const entityName = this.entityDisplayNames[entityType];
      this.logger.log(`${entityName} approved by ${username}: ${requestId}`);

      // Update Telegram message
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateApproved(chatId, messageId, entityType, username);
      }

      await ctx.answerCallbackQuery(ctx.t('traffic.moderation.approved', { entity: entityName }));
    } catch (error) {
      this.logger.error(`Failed to approve: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery(ctx.t('common.errors.operation_failed'));
    }
  }

  /**
   * Handle decline action
   */
  private async handleDecline(ctx: BotContext, entityType: ModerationEntityType, requestId: string): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!userId) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      const reviewNote = undefined;
      const declineHandler = this.declineHandlers[entityType];
      await declineHandler(requestId, userId, reviewNote);

      const entityName = this.entityDisplayNames[entityType];
      this.logger.log(`${entityName} declined by ${username}: ${requestId}`);

      // Update Telegram message
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateDeclined(chatId, messageId, entityType, username, reviewNote);
      }

      await ctx.answerCallbackQuery(ctx.t('traffic.moderation.declined', { entity: entityName }));
    } catch (error) {
      this.logger.error(`Failed to decline: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery(ctx.t('common.errors.operation_failed'));
    }
  }
}
