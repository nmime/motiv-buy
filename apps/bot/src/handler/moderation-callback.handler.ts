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
import {
  ModerationEntityType,
  ModerationRequestEntity,
  TrafficOrderEntity,
  TrafficSourceEntity,
  TrafficTargetEntity,
  UserEntity,
} from '@app/database';
import { ModerationService } from '@app/feature-traffic-main';
import { getErrorMessage } from '@app/common-shared';

type ModerationAction = 'approve' | 'decline';

@Injectable()
export class ModerationCallbackHandler {
  private readonly logger = new Logger(ModerationCallbackHandler.name);

  // Map shortened string to ModerationEntityType for O(1) lookup
  // src = traffic_source, tgt = traffic_target, ord = traffic_order
  private readonly entityTypeMap: Record<string, ModerationEntityType> = {
    src: ModerationEntityType.TrafficSource,
    tgt: ModerationEntityType.TrafficTarget,
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
    [ModerationEntityType.TrafficTarget]: 'Target',
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
      [ModerationEntityType.TrafficTarget]: (requestId, userId) =>
        this.moderationService.approveTarget(requestId, userId),
      [ModerationEntityType.TrafficOrder]: (requestId, userId) =>
        this.moderationService.approveOrder(requestId, userId),
    };

    this.declineHandlers = {
      [ModerationEntityType.TrafficSource]: (requestId, userId, reviewNote) =>
        this.moderationService.declineSource(requestId, userId, reviewNote),
      [ModerationEntityType.TrafficTarget]: (requestId, userId, reviewNote) =>
        this.moderationService.declineTarget(requestId, userId, reviewNote),
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

      const em = this.orm.em.fork();
      const user = await em.findOne(UserEntity, { telegramId });

      if (!user) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      await this.approveHandlers[entityType](requestId, user.id);

      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;
      const entity = await this.fetchEntity(em, requestId, entityType);
      const originalText = entity ? this.formatEntityMessage(entity, entityType) : undefined;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateApproved(chatId, messageId, entityType, username, originalText);
      }

      await ctx.answerCallbackQuery(
        ctx.t('traffic.moderation.approved', { entity: this.entityDisplayNames[entityType] }),
      );
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

      const em = this.orm.em.fork();
      const user = await em.findOne(UserEntity, { telegramId });

      if (!user) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.unauthorized'));

        return;
      }

      await this.declineHandlers[entityType](requestId, user.id);

      const chatId = ctx.chat?.id.toString();
      const messageId = ctx.callbackQuery?.message?.message_id;
      const entity = await this.fetchEntity(em, requestId, entityType);
      const originalText = entity ? this.formatEntityMessage(entity, entityType) : undefined;

      if (chatId && messageId) {
        await this.telegramModerationNotifier.updateDeclined(
          chatId,
          messageId,
          entityType,
          username,
          undefined,
          originalText,
        );
      }

      await ctx.answerCallbackQuery(
        ctx.t('traffic.moderation.declined', { entity: this.entityDisplayNames[entityType] }),
      );
    } catch (error) {
      this.logger.error(`Failed to decline: ${getErrorMessage(error)}`, { requestId, entityType, error });
      await ctx.answerCallbackQuery(ctx.t('common.errors.operation_failed'));
    }
  }

  /**
   * Fetch entity (source, target or order) by moderation request ID
   */
  private async fetchEntity(
    em: ReturnType<typeof this.orm.em.fork>,
    requestId: string,
    entityType: ModerationEntityType,
  ): Promise<TrafficSourceEntity | TrafficTargetEntity | TrafficOrderEntity | null> {
    const request = await em.findOne(ModerationRequestEntity, { id: requestId });

    if (!request) {
      return null;
    }

    const entityFetchers: Record<
      ModerationEntityType,
      () => Promise<TrafficSourceEntity | TrafficTargetEntity | TrafficOrderEntity | null>
    > = {
      [ModerationEntityType.TrafficSource]: () => em.findOne(TrafficSourceEntity, { id: request.entityId }),
      [ModerationEntityType.TrafficTarget]: () =>
        em.findOne(TrafficTargetEntity, { id: request.entityId }, { populate: ['managedBy'] }),
      [ModerationEntityType.TrafficOrder]: () =>
        em.findOne(
          TrafficOrderEntity,
          { id: request.entityId },
          { populate: ['creator', 'orderSources', 'orderTargets'] },
        ),
    };

    return entityFetchers[entityType]();
  }

  /**
   * Format entity to HTML message (matches TelegramModerationNotifier format)
   */
  private formatEntityMessage(
    entity: TrafficSourceEntity | TrafficTargetEntity | TrafficOrderEntity,
    entityType: ModerationEntityType,
  ): string {
    const formatters: Record<ModerationEntityType, () => string> = {
      [ModerationEntityType.TrafficSource]: () => this.formatSourceMessage(entity as TrafficSourceEntity),
      [ModerationEntityType.TrafficTarget]: () => this.formatTargetMessage(entity as TrafficTargetEntity),
      [ModerationEntityType.TrafficOrder]: () => this.formatOrderMessage(entity as TrafficOrderEntity),
    };

    return formatters[entityType]();
  }

  /**
   * Format traffic source message
   */
  private formatSourceMessage(source: TrafficSourceEntity): string {
    const lines = [
      '\u{1F916} <b>New Traffic Source - Awaiting Moderation</b>',
      '',
      `\u{1F4DB} <b>Name:</b> ${source.name}`,
      `\u{1F4DD} <b>Description:</b> ${source.description ?? 'N/A'}`,
      `\u{1F527} <b>Type:</b> ${source.type}`,
      `\u{1F194} <b>Telegram ID:</b> ${source.telegramId ?? 'N/A'}`,
      `\u{1F464} <b>Username:</b> @${source.botUsername ?? 'N/A'}`,
      `\u{1F511} <b>Source ID:</b> <code>${source.id}</code>`,
      '',
      '\u{23F0} Please review and approve/decline this traffic source.',
    ];

    return lines.join('\n');
  }

  /**
   * Format traffic target message
   */
  private formatTargetMessage(target: TrafficTargetEntity): string {
    const owner = target.managedBy?.getEntity();
    const usernameDisplay = target.username ? `@${target.username}` : 'N/A';

    const lines = [
      '\u{1F3AF} <b>New Traffic Target - Awaiting Moderation</b>',
      '',
      `\u{1F4DB} <b>Name:</b> ${target.name}`,
      `\u{1F4DD} <b>Description:</b> ${target.description ?? 'N/A'}`,
      `\u{1F527} <b>Type:</b> ${target.type}`,
      `\u{1F194} <b>Telegram ID:</b> ${target.telegramId ?? 'N/A'}`,
      `\u{1F464} <b>Username:</b> ${usernameDisplay}`,
      `\u{1F517} <b>Invite Link:</b> ${target.inviteLink ?? 'N/A'}`,
      '',
      `\u{1F464} <b>Owner:</b> ${owner?.username ?? 'Unknown'} (ID: ${owner?.id ?? 'N/A'})`,
      `\u{1F511} <b>Target ID:</b> <code>${target.id}</code>`,
      '',
      '\u{23F0} Please review and approve/decline this traffic target.',
    ];

    return lines.join('\n');
  }

  /**
   * Format traffic order message
   */
  private formatOrderMessage(order: TrafficOrderEntity): string {
    const creator = order.creator?.getEntity();
    const orderSources = order.orderSources?.getItems() ?? [];
    const orderTargets = order.orderTargets?.getItems() ?? [];

    const sourcesInfo =
      orderSources.length > 0 ? orderSources.map((os) => os.trafficSource?.id ?? 'Unknown').join(', ') : 'Not assigned';

    const targetsInfo =
      orderTargets.length > 0 ? orderTargets.map((ot) => ot.trafficTarget?.id ?? 'Unknown').join(', ') : 'Not assigned';

    const lines = [
      '\u{1F4CB} <b>New Traffic Order - Awaiting Moderation</b>',
      '',
      `\u{1F3AF} <b>Type:</b> ${order.type}`,
      `\u{1F4CA} <b>Target Count:</b> ${order.targetCount}`,
      `\u{1F4B0} <b>Price per Action:</b> ${order.pricePerAction}`,
      `\u{1F4B5} <b>Total Budget:</b> ${order.totalBudget}`,
      `\u{1F517} <b>Target URL:</b> ${order.targetUrl ?? 'N/A'}`,
      `\u{1F4DD} <b>Description:</b> ${order.description ?? 'N/A'}`,
      '',
      `\u{1F464} <b>Creator:</b> ${creator?.username ?? 'Unknown'} (ID: ${creator?.id ?? 'N/A'})`,
      `\u{1F916} <b>Sources:</b> ${sourcesInfo}`,
      `\u{1F3AF} <b>Targets:</b> ${targetsInfo}`,
      '',
      `\u{1F511} <b>Order ID:</b> <code>${order.id}</code>`,
      '',
      '\u{23F0} Please review and approve/decline this order.',
    ];

    return lines.join('\n');
  }
}
