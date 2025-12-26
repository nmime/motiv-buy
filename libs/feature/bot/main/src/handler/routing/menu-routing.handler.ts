/**
 * Menu Routing Handler
 *
 * Handles routing for menu, profile, and statistics-related callback queries.
 * Extracted from CallbackRouterHandler to reduce file size.
 */

import { Injectable } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { ProfileActionHandler } from '../profile-action.handler';
import { BalanceActionHandler } from '../balance-action.handler';
import { StatisticsActionHandler } from '../statistics-action.handler';
import { SettingsActionHandler } from '../settings-action.handler';
import { SupportHandler } from '../support';
import { HelpHandler } from '../help';
import { TrafficHandler } from '../traffic';
import { MiscMenuHandler } from '../menu';
import { MessageService } from '../../service/message.service';

type MenuHandler = (ctx: BotContext) => Promise<void>;
type ProfileParamsHandler = (ctx: BotContext, params: string[]) => Promise<void>;

@Injectable()
export class MenuRoutingHandler {
  private menuActionHandlers!: Map<string, MenuHandler>;
  private profileActionHandlers!: Map<string, ProfileParamsHandler>;
  private statsActionHandlers!: Map<string, MenuHandler>;

  constructor(
    private readonly profileHandler: ProfileActionHandler,
    private readonly balanceHandler: BalanceActionHandler,
    private readonly statisticsHandler: StatisticsActionHandler,
    private readonly settingsHandler: SettingsActionHandler,
    private readonly supportHandler: SupportHandler,
    private readonly helpHandler: HelpHandler,
    private readonly trafficHandler: TrafficHandler,
    private readonly menuHandler2: MiscMenuHandler,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.menuActionHandlers = new Map([
      ['main', this.handleMainMenu.bind(this)],
      ['buy_traffic', this.withAuth((ctx) => this.trafficHandler.handleBuyTrafficMenu(ctx))],
      ['sell_traffic', this.withAuth((ctx) => this.trafficHandler.handleSellTrafficMenu(ctx))],
      ['profile', this.withAuth((ctx) => this.profileHandler.handleProfileView(ctx))],
      ['balance', this.withAuth((ctx) => this.balanceHandler.handleBalanceView(ctx))],
      ['statistics', this.withAuth((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['orders', this.withAuth((ctx) => this.menuHandler2.handleOrdersMenu(ctx))],
      ['settings', this.withAuth((ctx) => this.settingsHandler.handleSettingsView(ctx))],
      ['referrals', this.withAuth((ctx) => this.menuHandler2.handleReferralsMenu(ctx))],
      ['referral', this.withAuth((ctx) => this.menuHandler2.handleReferralsMenu(ctx))],
      ['payments', this.withAuth((ctx) => this.menuHandler2.handlePaymentsMenu(ctx))],
      ['support', this.supportHandler.handleSupportMenu.bind(this.supportHandler)],
      ['help', this.helpHandler.handleHelpMenu.bind(this.helpHandler)],
      ['traffic', this.withAuth((ctx) => this.trafficHandler.handleTrafficMenu(ctx))],
      ['campaign', this.withAuth((ctx) => this.menuHandler2.handleCampaignMenu(ctx))],
      ['withdrawal', this.withAuth((ctx) => this.balanceHandler.handleWithdrawalStart(ctx))],
      ['notifications', this.withAuth((ctx) => this.settingsHandler.handleNotificationSettings(ctx))],
    ]);

    this.profileActionHandlers = new Map([
      ['view', this.withAuthParams((ctx) => this.profileHandler.handleProfileView(ctx))],
      ['stats', this.withAuthParams((ctx, params) => this.statisticsHandler.handleProfileStatsMenu(ctx, params))],
      ['stats:overview', this.withAuthParams((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['stats:activity', this.withAuthParams((ctx) => this.statisticsHandler.handleDetailedStatistics(ctx))],
      ['stats:earnings', this.withAuthParams((ctx) => this.statisticsHandler.handleEarningsStatistics(ctx))],
      ['stats:performance', this.withAuthParams((ctx) => this.statisticsHandler.handleTrafficStatistics(ctx))],
    ]);

    this.statsActionHandlers = new Map([
      ['overview', this.withAuth((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['detailed', this.withAuth((ctx) => this.statisticsHandler.handleDetailedStatistics(ctx))],
      ['traffic', this.withAuth((ctx) => this.statisticsHandler.handleTrafficStatistics(ctx))],
      ['earnings', this.withAuth((ctx) => this.statisticsHandler.handleEarningsStatistics(ctx))],
    ]);
  }

  /**
   * Route menu actions
   */
  async routeMenuAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const menuAction = action || 'main';
    const handler = this.menuActionHandlers.get(menuAction);

    if (handler) {
      await handler(ctx);
    } else {
      await this.handleMainMenu(ctx);
    }
  }

  /**
   * Route profile actions
   */
  async routeProfileAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.profileActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.profileHandler.handleProfileView(ctx);
    } else {
      await this.sendAuthRequired(ctx);
    }
  }

  /**
   * Route statistics actions
   */
  async routeStatisticsAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const handler = this.statsActionHandlers.get(action || 'overview');

    if (handler) {
      await handler(ctx);
    } else if (isAuthenticated(ctx)) {
      await this.statisticsHandler.handleStatisticsOverview(ctx);
    } else {
      await this.sendAuthRequired(ctx);
    }
  }

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const message = ctx.t('menu.main_menu.select_action');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('menu.main_menu.btn_sell_traffic'), 'menu:sell_traffic')
      .text(ctx.t('menu.main_menu.btn_buy_traffic'), 'menu:buy_traffic')
      .row()
      .text(ctx.t('menu.main_menu.btn_profile'), 'profile:view')
      .text(ctx.t('menu.main_menu.btn_balance'), 'balance:view')
      .row()
      .text(ctx.t('menu.main_menu.btn_support'), 'menu:support');

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      replyMarkup: keyboard,
    });
  }

  private withAuth(handler: (ctx: AuthenticatedBotContext) => Promise<void>): (ctx: BotContext) => Promise<void> {
    return async (ctx: BotContext) => {
      if (!isAuthenticated(ctx)) {
        await this.sendAuthRequired(ctx);

        return;
      }

      await handler(ctx);
    };
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
