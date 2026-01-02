/**
 * Traffic Routing Handler
 *
 * Handles routing for traffic-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { TrafficHandler } from '../traffic';
import { MessageService } from '../../service/message.service';

type TrafficActionHandler = (ctx: BotContext, params: string[]) => Promise<void>;

@Injectable()
export class TrafficRoutingHandler {
  constructor(
    private readonly trafficHandler: TrafficHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Route traffic actions
   */
  async routeTrafficAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const trafficActionHandlers: Record<string, TrafficActionHandler> = {
      sources: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.sendAuthRequired(ctx);

          return;
        }

        if (params.length > 0 && params[0] === 'add') {
          await this.trafficHandler.handleTrafficSourceAdd(ctx);
        } else {
          await this.trafficHandler.handleTrafficSourcesList(ctx);
        }
      },
      targets: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.sendAuthRequired(ctx);

          return;
        }

        if (params.length > 0 && params[0] === 'add') {
          await this.trafficHandler.handleTrafficTargetAdd(ctx);
        } else {
          await this.trafficHandler.handleTrafficTargetsList(ctx);
        }
      },
      source: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.sendAuthRequired(ctx);

          return;
        }

        await this.handleSourceAction(ctx, params);
      },
      target: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.sendAuthRequired(ctx);

          return;
        }

        await this.handleTargetAction(ctx, params);
      },
      analytics: async (ctx) => {
        if (!isAuthenticated(ctx)) {
          await this.sendAuthRequired(ctx);

          return;
        }

        await this.trafficHandler.handleTrafficAnalytics(ctx);
      },
    };

    const handler = trafficActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      if (!isAuthenticated(ctx)) {
        await this.sendAuthRequired(ctx);

        return;
      }

      await this.trafficHandler.handleSellTrafficMenu(ctx);
    }
  }

  /**
   * Route shortened traffic actions (for 64-byte callback limit)
   * Format: traf:src:del:Y:<id> or traf:src:del:N:<id> (source delete confirm/cancel)
   * Format: traf:tgt:del:Y:<id> or traf:tgt:del:N:<id> (target delete confirm/cancel)
   * Format: traf:sc:<categoryType> (set category - sourceId from session)
   * Format: traf:cp:<page> (category page change - sourceId from session)
   * Format: traf:cv:<sourceId> (cancel/view source - go back from category selection)
   */
  async routeTrafficShortAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.sendAuthRequired(ctx);

      return;
    }

    // Handle category-related short actions
    // sourceId is stored in session.formData during category change flow
    const formData = ctx.session?.formData as { sourceId?: string } | undefined;
    const sessionSourceId = formData?.sourceId;

    const categoryHandlers: Record<string, () => Promise<void>> = {
      ct: async () => {
        // Toggle category: traf:ct:<categoryType>
        const [categoryType] = params;

        if (categoryType) {
          await this.trafficHandler.handleCategoryToggle(ctx, categoryType);
        }
      },
      cd: async () => {
        // Done/save categories: traf:cd
        await this.trafficHandler.handleCategorySave(ctx);
      },
      cp: async () => {
        // Category page: traf:cp:<page>
        const [pageStr] = params;
        const page = parseInt(pageStr, 10) || 0;

        if (sessionSourceId) {
          await this.trafficHandler.handleCategoryEditPageChange(ctx, sessionSourceId, page);
        }
      },
      cv: async () => {
        // Cancel/view source: traf:cv:<sourceId>
        const [sourceId] = params;

        if (sourceId) {
          await this.trafficHandler.handleTrafficSourceView(ctx, sourceId);
        }
      },
    };

    const categoryHandler = categoryHandlers[action];

    if (categoryHandler) {
      await categoryHandler();

      return;
    }

    // Handle regenerate API key confirmation: traf:rg:Y:<sourceId> or traf:rg:N:<sourceId>
    if (action === 'rg') {
      const [confirmFlag, sourceId] = params;

      if (sourceId) {
        if (confirmFlag === 'Y') {
          await this.trafficHandler.handleTrafficSourceRegenerateKey(ctx, sourceId);
        } else {
          await this.trafficHandler.handleTrafficSourceIntegration(ctx, sourceId);
        }
      }

      return;
    }

    // Handle earnings transfer: traf:earn:xfer:<sourceId>
    if (action === 'earn') {
      const [subAction, sourceId] = params;

      if (subAction === 'xfer' && sourceId) {
        await this.trafficHandler.handleSourceEarningsTransfer(ctx, sourceId);
      }

      return;
    }

    // Handle delete confirmation actions: traf:src:del:... or traf:tgt:del:...
    const [operation, confirmFlag, entityId] = params;

    if (operation !== 'del' || !entityId) {
      return;
    }

    const isConfirm = confirmFlag === 'Y';

    const deleteHandlers: Record<string, () => Promise<void>> = {
      src: async () => {
        if (isConfirm) {
          await this.trafficHandler.handleTrafficSourceDeleteConfirm(ctx, entityId);
        } else {
          await this.trafficHandler.handleTrafficSourceView(ctx, entityId);
        }
      },
      tgt: async () => {
        if (isConfirm) {
          await this.trafficHandler.handleTrafficTargetDeleteConfirm(ctx, entityId);
        } else {
          await this.trafficHandler.handleTrafficTargetView(ctx, entityId);
        }
      },
    };

    const deleteHandler = deleteHandlers[action];

    if (deleteHandler) {
      await deleteHandler();
    }
  }

  private async handleSourceAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [subAction, ...rest] = params;

    // Handle delete confirmation flow
    if (subAction === 'delete' && rest[0] === 'confirm') {
      await this.handleSourceDeleteConfirmation(ctx, rest);

      return;
    }

    // Handle category page navigation: traffic:source:catpage:<page>
    if (subAction === 'catpage') {
      const page = parseInt(rest[0], 10) || 0;
      await this.trafficHandler.handleCategoryPageChange(ctx, page);

      return;
    }

    // Handle category selection for new source: traffic:source:category:<categoryType>
    if (subAction === 'category') {
      const [categoryType] = rest;
      await this.trafficHandler.handleCategorySelect(ctx, categoryType);

      return;
    }

    // Handle change category start: traffic:source:chgcat:<sourceId>
    if (subAction === 'chgcat') {
      const [sourceId] = rest;
      await this.trafficHandler.handleCategoryChangeStart(ctx, sourceId);

      return;
    }

    // Note: setcat and catpg are now handled via short format (traf:ct, traf:cp)
    // in routeTrafficShortAction method

    const [sourceId] = rest;

    if (!sourceId) {
      return;
    }

    type SourceActionHandler = (ctx: AuthenticatedBotContext, id: string) => Promise<void>;

    const sourceActionHandlers: Record<string, SourceActionHandler> = {
      view: (c, id) => this.trafficHandler.handleTrafficSourceView(c, id),
      edit: (c, id) => this.trafficHandler.handleTrafficSourceEdit(c, id),
      toggle: (c, id) => this.trafficHandler.handleTrafficSourceToggle(c, id),
      delete: (c, id) => this.trafficHandler.handleTrafficSourceDelete(c, id),
      stats: (c, id) => this.trafficHandler.handleTrafficSourceStats(c, id),
      type: (c, id) => this.trafficHandler.handleTrafficSourceTypeSelect(c, id as 'bot' | 'bot_with_token'),
      integrate: (c, id) => this.trafficHandler.handleTrafficSourceIntegration(c, id),
      regen: (c, id) => this.trafficHandler.handleTrafficSourceRegenerateConfirm(c, id),
      earnings: (c, id) => this.trafficHandler.handleSourceEarnings(c, id),
    };

    const handler = sourceActionHandlers[subAction];

    if (handler) {
      await handler(ctx, sourceId);
    }
  }

  private async handleSourceDeleteConfirmation(ctx: AuthenticatedBotContext, rest: string[]): Promise<void> {
    const [, confirmAction] = rest;
    const idParam = rest.find((p) => p.startsWith('id='));
    const sourceId = idParam ? idParam.replace('id=', '') : '';

    if (!sourceId) {
      return;
    }

    const confirmationHandlers: Record<string, () => Promise<void>> = {
      confirm: () => this.trafficHandler.handleTrafficSourceDeleteConfirm(ctx, sourceId),
      cancel: () => this.trafficHandler.handleTrafficSourceView(ctx, sourceId),
    };

    const handler = confirmationHandlers[confirmAction];

    if (handler) {
      await handler();
    }
  }

  private async handleTargetAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [subAction, ...rest] = params;

    // Handle delete confirmation flow
    if (subAction === 'delete' && rest[0] === 'confirm') {
      await this.handleTargetDeleteConfirmation(ctx, rest);

      return;
    }

    const [targetId] = rest;

    if (!targetId) {
      return;
    }

    type TargetActionHandler = (ctx: AuthenticatedBotContext, id: string) => Promise<void>;

    const targetActionHandlers: Record<string, TargetActionHandler> = {
      view: (c, id) => this.trafficHandler.handleTrafficTargetView(c, id),
      edit: (c, id) => this.trafficHandler.handleTrafficTargetEdit(c, id),
      toggle: (c, id) => this.trafficHandler.handleTrafficTargetToggle(c, id),
      delete: (c, id) => this.trafficHandler.handleTrafficTargetDelete(c, id),
      stats: (c, id) => this.trafficHandler.handleTrafficTargetStats(c, id),
    };

    const handler = targetActionHandlers[subAction];

    if (handler) {
      await handler(ctx, targetId);
    }
  }

  private async handleTargetDeleteConfirmation(ctx: AuthenticatedBotContext, rest: string[]): Promise<void> {
    const [, confirmAction] = rest;
    const idParam = rest.find((p) => p.startsWith('id='));
    const targetId = idParam ? idParam.replace('id=', '') : '';

    if (!targetId) {
      return;
    }

    const confirmationHandlers: Record<string, () => Promise<void>> = {
      confirm: () => this.trafficHandler.handleTrafficTargetDeleteConfirm(ctx, targetId),
      cancel: () => this.trafficHandler.handleTrafficTargetView(ctx, targetId),
    };

    const handler = confirmationHandlers[confirmAction];

    if (handler) {
      await handler();
    }
  }

  private async sendAuthRequired(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('common.errors.authentication_required'),
    });
  }

  /**
   * Route buy traffic actions
   * Format: buy:target:action:params...
   */
  async routeBuyAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.sendAuthRequired(ctx);

      return;
    }

    const buyActionHandlers: Record<string, (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>> = {
      target: async (ctx, params) => {
        await this.handleBuyTargetAction(ctx, params);
      },
      tgt: async (ctx, params) => {
        // Handle shortened format: buy:tgt:del:Y:<id> or buy:tgt:del:N:<id>
        await this.handleBuyTargetShortAction(ctx, params);
      },
    };

    const handler = buyActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    }
  }

  /**
   * Handle buy target actions
   * Format: buy:target:subAction:params...
   */
  private async handleBuyTargetAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [subAction, ...rest] = params;
    const [targetIdOrType] = rest;

    type BuyTargetActionHandler = (ctx: AuthenticatedBotContext, id: string) => Promise<void>;

    const buyTargetActionHandlers: Record<string, BuyTargetActionHandler> = {
      add: async (ctx) => {
        await this.trafficHandler.handleBuyTrafficTargetAdd(ctx);
      },
      type: async (ctx, typeValue) => {
        const validTypes = ['channel', 'group', 'bot'];
        if (validTypes.includes(typeValue)) {
          await this.trafficHandler.handleBuyTrafficTargetTypeSelect(ctx, typeValue as 'channel' | 'group' | 'bot');
        }
      },
      mode: async (ctx, modeValue) => {
        const validModes = ['direct', 'moderated'];
        if (validModes.includes(modeValue)) {
          await this.trafficHandler.handleBuyTrafficTargetModeSelect(ctx, modeValue as 'direct' | 'moderated');
        }
      },
      view: async (ctx, id) => {
        await this.trafficHandler.handleBuyTrafficTargetView(ctx, id);
      },
      orders: async (ctx, id) => {
        await this.trafficHandler.handleBuyTrafficTargetOrders(ctx, id);
      },
      toggle: async (ctx, id) => {
        await this.trafficHandler.handleTrafficTargetToggle(ctx, id);
        // After toggle, show the buy traffic target view
        await this.trafficHandler.handleBuyTrafficTargetView(ctx, id);
      },
      remove: async (ctx, id) => {
        await this.trafficHandler.handleBuyTrafficTargetRemove(ctx, id);
      },
    };

    const handler = buyTargetActionHandlers[subAction];

    if (handler && targetIdOrType) {
      await handler(ctx, targetIdOrType);
    } else if (subAction === 'add') {
      await this.trafficHandler.handleBuyTrafficTargetAdd(ctx);
    }
  }

  /**
   * Handle shortened buy target actions (for 64-byte callback limit)
   * Format: buy:tgt:del:Y:<id> or buy:tgt:del:N:<id>
   */
  private async handleBuyTargetShortAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [operation, confirmFlag, entityId] = params;

    if (operation !== 'del' || !entityId) {
      return;
    }

    const isConfirm = confirmFlag === 'Y';

    if (isConfirm) {
      await this.trafficHandler.handleBuyTrafficTargetRemoveConfirm(ctx, entityId);
    } else {
      await this.trafficHandler.handleBuyTrafficTargetView(ctx, entityId);
    }
  }
}
