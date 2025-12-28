/**
 * Moderation Callback Handler
 *
 * App-layer handler for moderation callbacks (approve/decline).
 * Uses ModerationService from traffic-main for business logic.
 *
 * Callback format (shortened to fit Telegram's 64-byte limit):
 * - mod:a:src:requestId (approve traffic source)
 * - mod:d:ord:requestId (decline traffic order)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { BotContext, TelegramModerationNotifier } from '@app/feature-bot-shared';
import { ModerationEntityType, UserEntity } from '@app/database';
import { ModerationService } from '@app/feature-traffic-main';
import { getErrorMessage } from '@app/common-shared';

type ModerationAction = 'approve' | 'decline';

@Injectable()
export class ModerationCallbackHandler {
  private readonly logger = new Logger(ModerationCallbackHandler.name);

  // Map shortened string to ModerationEntityType for O(1) lookup
  // src = traffic_source, ord = traffic_order
  private readonly entityTypeMap: Record<string, ModerationEntityType> = {
    src: ModerationEntityType.TrafficSource,
    ord: ModerationEntityType.TrafficOrder,
  };

  // Map shortened action to full action
  private readonly actionMap: Record<string, ModerationAction> = {
    a: 'approve',
    d: 'decline',
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
    private readonly orm: MikroORM,
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
    return callbackData.startsWith('mod:');
  }

  /**
   * Route moderation callback to appropriate handler
   * Format: mod:a:src:requestId or mod:d:ord:requestId
   */
  async handleCallback(ctx: BotContext): Promise<boolean> {
    const data = ctx.callbackQuery?.data;

    if (!data || !this.canHandle(data)) {
      return false;
    }

    const [, actionShort, entityTypeShort, requestId] = data.split(':');

    // Validate and map action
    const action = this.actionMap[actionShort];

    if (!action) {
      this.logger.warn('Unknown moderation action', { actionShort, data });
      await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));

      return true;
    }

    // Validate entity type
    const entityType = this.entityTypeMap[entityTypeShort];

    if (!entityType) {
      this.logger.warn('Unknown entity type', { entityTypeShort, data });
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
      const telegramId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!telegramId) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      // Look up user by Telegram ID to get database UUID
      const em = this.orm.em.fork();
      const user = await em.findOne(UserEntity, { telegramId });

      if (!user) {
        this.logger.warn('User not found for moderation action', { telegramId });
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      const approveHandler = this.approveHandlers[entityType];
      await approveHandler(requestId, user.id);

      const entityName = this.entityDisplayNames[entityType];
      this.logger.log(`${entityName} approved by ${username}: ${requestId}`);

      // Update Telegram message with original content preserved
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;
      const originalText =
        ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : undefined;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateApproved(chatId, messageId, entityType, username, originalText);
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
      const telegramId = ctx.from?.id.toString();
      const username = ctx.from?.username ?? 'Unknown';

      if (!telegramId) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      // Look up user by Telegram ID to get database UUID
      const em = this.orm.em.fork();
      const user = await em.findOne(UserEntity, { telegramId });

      if (!user) {
        this.logger.warn('User not found for moderation action', { telegramId });
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      const reviewNote = undefined;
      const declineHandler = this.declineHandlers[entityType];
      await declineHandler(requestId, user.id, reviewNote);

      const entityName = this.entityDisplayNames[entityType];
      this.logger.log(`${entityName} declined by ${username}: ${requestId}`);

      // Update Telegram message with original content preserved
      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;
      const originalText =
        ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : undefined;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateDeclined(
          chatId,
          messageId,
          entityType,
          username,
          reviewNote,
          originalText,
        );
      }

      await ctx.answerCallbackQuery(ctx.t('traffic.moderation.declined', { entity: entityName }));
    } catch (error) {
      this.logger.error(`Failed to decline: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery(ctx.t('common.errors.operation_failed'));
    }
  }
}
