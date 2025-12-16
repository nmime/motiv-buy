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
    // Callback format: traffic:source:delete:confirm:confirm:id=sourceId (user clicked confirm)
    // Callback format: traffic:source:delete:confirm:cancel:id=sourceId (user clicked cancel)
    if (subAction === 'delete' && rest[0] === 'confirm') {
      const confirmAction = rest[1]; // 'confirm' or 'cancel'
      const idParam = rest.find((p) => p.startsWith('id='));
      const sourceId = idParam ? idParam.replace('id=', '') : '';

      if (confirmAction === 'confirm' && sourceId) {
        await this.trafficHandler.handleTrafficSourceDeleteConfirm(ctx, sourceId);
      } else if (confirmAction === 'cancel' && sourceId) {
        await this.trafficHandler.handleTrafficSourceView(ctx, sourceId);
      }

      return;
    }

    const sourceId = rest[0];
    if (subAction === 'view' && sourceId) {
      await this.trafficHandler.handleTrafficSourceView(ctx, sourceId);
    } else if (subAction === 'edit' && sourceId) {
      await this.trafficHandler.handleTrafficSourceEdit(ctx, sourceId);
    } else if (subAction === 'toggle' && sourceId) {
      await this.trafficHandler.handleTrafficSourceToggle(ctx, sourceId);
    } else if (subAction === 'delete' && sourceId) {
      await this.trafficHandler.handleTrafficSourceDelete(ctx, sourceId);
    } else if (subAction === 'stats' && sourceId) {
      await this.trafficHandler.handleTrafficSourceStats(ctx, sourceId);
    } else if (subAction === 'type' && sourceId) {
      await this.trafficHandler.handleTrafficSourceTypeSelect(ctx, sourceId as 'bot' | 'bot_with_token');
    }
  }

  private async handleTargetAction(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const [subAction, ...rest] = params;

    // Handle delete confirmation flow
    // Callback format: traffic:target:delete:confirm:confirm:id=targetId (user clicked confirm)
    // Callback format: traffic:target:delete:confirm:cancel:id=targetId (user clicked cancel)
    if (subAction === 'delete' && rest[0] === 'confirm') {
      const confirmAction = rest[1]; // 'confirm' or 'cancel'
      const idParam = rest.find((p) => p.startsWith('id='));
      const targetId = idParam ? idParam.replace('id=', '') : '';

      if (confirmAction === 'confirm' && targetId) {
        await this.trafficHandler.handleTrafficTargetDeleteConfirm(ctx, targetId);
      } else if (confirmAction === 'cancel' && targetId) {
        await this.trafficHandler.handleTrafficTargetView(ctx, targetId);
      }

      return;
    }

    const targetId = rest[0];
    if (subAction === 'view' && targetId) {
      await this.trafficHandler.handleTrafficTargetView(ctx, targetId);
    } else if (subAction === 'edit' && targetId) {
      await this.trafficHandler.handleTrafficTargetEdit(ctx, targetId);
    } else if (subAction === 'toggle' && targetId) {
      await this.trafficHandler.handleTrafficTargetToggle(ctx, targetId);
    } else if (subAction === 'delete' && targetId) {
      await this.trafficHandler.handleTrafficTargetDelete(ctx, targetId);
    } else if (subAction === 'stats' && targetId) {
      await this.trafficHandler.handleTrafficTargetStats(ctx, targetId);
    }
  }

  private async sendAuthRequired(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('common.errors.authentication_required'),
    });
  }
}
