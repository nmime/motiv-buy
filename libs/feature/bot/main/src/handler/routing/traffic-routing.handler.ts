/**
 * Traffic Routing Handler
 *
 * Handles routing for traffic-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
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
   * Route shortened traffic actions (for delete confirmations within 64-byte callback limit)
   * Format: traf:src:del:Y:<id> or traf:src:del:N:<id> (source delete confirm/cancel)
   * Format: traf:tgt:del:Y:<id> or traf:tgt:del:N:<id> (target delete confirm/cancel)
   */
  async routeTrafficShortAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.sendAuthRequired(ctx);

      return;
    }

    // action = 'src' or 'tgt', params = ['del', 'Y'/'N', '<id>']
    const [operation, confirmFlag, entityId] = params;

    if (operation !== 'del' || !entityId) {
      return;
    }

    const isConfirm = confirmFlag === 'Y';

    const shortActionHandlers: Record<string, () => Promise<void>> = {
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

    const handler = shortActionHandlers[action];

    if (handler) {
      await handler();
    }
  }

  private async handleSourceAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [subAction, ...rest] = params;

    // Handle delete confirmation flow
    if (subAction === 'delete' && rest[0] === 'confirm') {
      await this.handleSourceDeleteConfirmation(ctx, rest);

      return;
    }

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
}
