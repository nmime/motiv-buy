/**
 * Order Routing Handler
 *
 * Handles routing for order-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { OrderActionHandler } from '../order-action.handler';
import { MiscMenuHandler } from '../menu';
import { HelpHandler } from '../help';
import { MessageService } from '../../service/message.service';

type OrderParamsHandler = (ctx: BotContext, params: string[]) => Promise<void>;

@Injectable()
export class OrderRoutingHandler {
  private orderActionHandlers!: Map<string, OrderParamsHandler>;

  constructor(
    private readonly orderHandler: OrderActionHandler,
    private readonly menuHandler2: MiscMenuHandler,
    private readonly helpHandler: HelpHandler,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.orderActionHandlers = new Map([
      ['list', this.withAuthParams((ctx) => this.orderHandler.handleOrdersList(ctx))],
      [
        'create',
        this.withAuthParams(async (ctx, params) => {
          if (params.length >= 2 && params[0] === 'target') {
            // order:create:target:${targetId} - create order for existing target (skip type selection)
            await this.orderHandler.handleCreateOrderForTarget(ctx, params[1]);
          } else if (params.length > 0 && params[0] === 'start') {
            await this.orderHandler.handleCreateOrderStart(ctx);
          } else if (params.length > 0 && params[0] === 'back') {
            await this.menuHandler2.handleOrdersMenu(ctx);
          } else {
            await this.orderHandler.handleCreateOrderStart(ctx);
          }
        }),
      ],
      [
        'details',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        }),
      ],
      [
        'view',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        }),
      ],
      ['deleted', this.withAuthParams((ctx, params) => this.orderHandler.handleDeletedOrders(ctx, params))],
      ['config', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderConfig(ctx, params))],
      ['edit', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderEdit(ctx, params))],
      ['toggle', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderToggle(ctx, params))],
      ['delete', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderDelete(ctx, params))],
      ['download', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderDownload(ctx, params))],
      [
        'help',
        async (ctx, _params) => {
          await this.helpHandler.handleHelpMenu(ctx);
        },
      ],
      ['bot', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderBotManagement(ctx, params))],
      ['audience', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderAudienceTargeting(ctx, params))],
      ['gender', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderGenderSelection(ctx, params))],
      ['topic', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderTopicSelection(ctx, params))],
      ['location', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderLocationSelection(ctx, params))],
      [
        'refresh',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stats_refreshed'),
          });
        },
      ],
      ['stats', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderStats(ctx, params))],
      ['duplicate', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderDuplicate(ctx, params))],
      ['integration', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderIntegration(ctx, params))],
      ['transfer', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderTransfer(ctx, params))],
      [
        'stop',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stopped'),
          });
        },
      ],
      ['view_channel', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderChannelView(ctx, params))],
      ['type', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderTypeSelection(ctx, params))],
      ['confirm', this.withAuthParams((ctx, params) => this.orderHandler.handleOrderConfirm(ctx, params))],
    ]);
  }

  /**
   * Route order actions
   */
  async routeOrderAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.orderActionHandlers.get(action || 'list');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.menuHandler2.handleOrdersMenu(ctx);
    } else {
      await this.sendAuthRequired(ctx);
    }
  }

  private withAuthParams(
    handler: (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>,
  ): (ctx: BotContext, params: string[]) => Promise<void> {
    return async (ctx: BotContext, params: string[]) => {
      if (!isAuthenticated(ctx)) {
        await this.sendAuthRequired(ctx);

        return;
      }

      await handler(ctx, params);
    };
  }

  private async sendAuthRequired(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('common.errors.authentication_required'),
    });
  }
}
