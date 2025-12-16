/**
 * Balance Routing Handler
 *
 * Handles routing for balance, deposit, and withdrawal-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { CurrencyCode } from '@app/database';
import { BalanceActionHandler } from '../balance-action.handler';
import { MessageService } from '../../service/message.service';

type BalanceParamsHandler = (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>;

@Injectable()
export class BalanceRoutingHandler {
  private balanceActionHandlers: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;

  constructor(
    private readonly balanceHandler: BalanceActionHandler,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.balanceActionHandlers = new Map([
      ['view', this.withAuthParams((ctx) => this.balanceHandler.handleBalanceView(ctx))],
      ['current', this.withAuthParams((ctx) => this.balanceHandler.handleBalanceView(ctx))],
      [
        'history',
        this.withAuthParams(async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.balanceHandler.handleTransactionHistory(ctx, page);
        }),
      ],
      ['analytics', this.withAuthParams((ctx) => this.balanceHandler.handleBalanceAnalytics(ctx))],
      ['withdraw', this.withAuthParams((ctx) => this.balanceHandler.handleWithdrawalStart(ctx))],
      ['deposit', this.withAuthParams((ctx) => this.balanceHandler.handleDepositStart(ctx))],
      ['topup', this.withAuthParams((ctx) => this.balanceHandler.handleDepositStart(ctx))],
    ]);
  }

  /**
   * Route balance actions
   */
  async routeBalanceAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.balanceActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.balanceHandler.handleBalanceView(ctx);
    } else {
      await this.sendAuthRequired(ctx);
    }
  }

  /**
   * Route deposit actions
   */
  async routeDepositAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.sendAuthRequired(ctx);

      return;
    }

    const depositActionHandlers: Record<string, BalanceParamsHandler> = {
      currency: async (ctx, p) => this.balanceHandler.handleDepositCurrency(ctx, p[0] as CurrencyCode),
      history: async (ctx) => this.balanceHandler.handleDepositHistory(ctx),
    };

    const handler = depositActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.balanceHandler.handleDepositStart(ctx);
    }
  }

  /**
   * Route withdrawal actions
   */
  async routeWithdrawalAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.sendAuthRequired(ctx);

      return;
    }

    const withdrawalActionHandlers: Record<string, BalanceParamsHandler> = {
      currency: async (ctx, params) => this.balanceHandler.handleWithdrawalCurrency(ctx, params[0]),
      amount: async (ctx, params) => this.balanceHandler.handleWithdrawalAmount(ctx, params[0]),
      confirm: async (ctx, params) => this.balanceHandler.handleWithdrawalConfirm(ctx, params),
      cancel: async (ctx) => this.balanceHandler.handleWithdrawalMenu(ctx),
      history: async (ctx) => this.balanceHandler.handleWithdrawalHistory(ctx),
      methods: async (ctx) => this.balanceHandler.handleWithdrawalMethods(ctx),
      limits: async (ctx) => this.balanceHandler.handleWithdrawalLimits(ctx),
      create: async (ctx) => this.balanceHandler.handleWithdrawalMenu(ctx),
    };

    const handler = withdrawalActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.balanceHandler.handleWithdrawalMenu(ctx);
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
