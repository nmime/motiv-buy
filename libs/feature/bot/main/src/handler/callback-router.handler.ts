/**
 * Callback Router Handler
 *
 * Routes callback queries to appropriate action handlers.
 * Provides centralized routing logic for all menu and action callbacks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext, isAuthenticated } from '@app/feature-bot-shared';
import { CurrencyCode } from '@app/database';
import { toError } from '@app/common-shared';
import { MenuActionHandler } from './menu-action.handler';
import { ProfileActionHandler } from './profile-action.handler';
import { BalanceActionHandler } from './balance-action.handler';
import { StatisticsActionHandler } from './statistics-action.handler';
import { OrderActionHandler } from './order-action.handler';
import { SettingsActionHandler } from './settings-action.handler';
import { SupportHandler } from './support';
import { HelpHandler } from './help';
import { TrafficHandler } from './traffic';
import { MiscMenuHandler } from './menu';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { MessageService } from '../service/message.service';

type ActionHandler = (ctx: BotContext, _action: string, _params: string[]) => Promise<void>;

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);
  private primaryActionHandlers!: Map<string, ActionHandler>;
  private menuActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private profileActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private balanceActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private statsActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private orderActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private settingsActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;

  constructor(
    private readonly orm: MikroORM,
    private readonly menuHandler: MenuActionHandler,
    private readonly profileHandler: ProfileActionHandler,
    private readonly balanceHandler: BalanceActionHandler,
    private readonly statisticsHandler: StatisticsActionHandler,
    private readonly orderHandler: OrderActionHandler,
    private readonly settingsHandler: SettingsActionHandler,
    private readonly supportHandler: SupportHandler,
    private readonly helpHandler: HelpHandler,
    private readonly trafficHandler: TrafficHandler,
    private readonly menuHandler2: MiscMenuHandler,
    private readonly rateLimitMiddleware: RateLimitMiddleware,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlerMaps();
  }

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em() {
    return this.orm.em.fork();
  }

  /**
   * Create back button with translated text
   */
  private createBackButton(ctx: BotContext, returnTo: string): InlineKeyboard {
    return this.menuHandler.createBackButton(returnTo, ctx.t('common.back'));
  }

  /**
   * Safely answer callback query (skips for simulated callbacks from commands)
   * Simulated callbacks have IDs starting with 'cmd_'
   */
  private async safeAnswerCallback(ctx: BotContext, text?: string): Promise<void> {
    const callbackId = ctx.callbackQuery?.id;

    // Skip if no callback query or if it's a simulated callback from a command
    if (!callbackId || callbackId.startsWith('cmd_')) {
      return;
    }

    try {
      await ctx.answerCallbackQuery(text);
    } catch {
      // Silently ignore errors (e.g., callback already answered or expired)
    }
  }

  /**
   * Wraps an authenticated handler, checking the type guard before calling
   */
  private withAuth(handler: (ctx: AuthenticatedBotContext) => Promise<void>): (ctx: BotContext) => Promise<void> {
    return async (ctx: BotContext) => {
      if (!isAuthenticated(ctx)) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('common.errors.authentication_required'),
        });

        return;
      }

      await handler(ctx);
    };
  }

  /**
   * Wraps an authenticated handler with params, checking the type guard before calling
   */
  private withAuthParams(
    handler: (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>,
  ): (ctx: BotContext, params: string[]) => Promise<void> {
    return async (ctx: BotContext, params: string[]) => {
      if (!isAuthenticated(ctx)) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('common.errors.authentication_required'),
        });

        return;
      }

      await handler(ctx, params);
    };
  }

  private initializeHandlerMaps(): void {
    this.primaryActionHandlers = new Map([
      ['menu', this.routeMenuAction.bind(this)],
      ['profile', this.routeProfileAction.bind(this)],
      ['balance', this.routeBalanceAction.bind(this)],
      ['stats', this.routeStatisticsAction.bind(this)],
      ['orders', this.routeOrderAction.bind(this)],
      ['order', this.routeOrderAction.bind(this)],
      ['settings', this.routeSettingsAction.bind(this)],
      ['referral', this.routeReferralAction.bind(this)],
      ['payment', this.routePaymentAction.bind(this)],
      ['deposit', this.routeDepositAction.bind(this)],
      ['withdraw', this.routeWithdrawalAction.bind(this)],
      ['withdrawal', this.routeWithdrawalAction.bind(this)],
      ['traffic', this.routeTrafficAction.bind(this)],
      // Moderation routing is handled at app layer (apps/bot) to avoid circular dependencies
      // See apps/bot/src/handler/moderation-callback.handler.ts
      ['support', this.routeSupportAction.bind(this)],
      ['help', this.routeHelpAction.bind(this)],
      ['campaign', this.routeCampaignAction.bind(this)],
      ['admin', this.routeAdminAction.bind(this)],
      ['auth', this.routeAuthAction.bind(this)],
      ['export', this.routeExportAction.bind(this)],
      ['reset', this.routeResetAction.bind(this)],
      ['status', this.routeStatusAction.bind(this)],
      ['command', this.routeCommandAction.bind(this)],
      ['noop', this.handleNoopAction.bind(this)],
      ['pagination', this.handleNoopAction.bind(this)],
    ]);

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
      ['details', this.withAuthParams((ctx) => this.profileHandler.handleProfileDetails(ctx))],
      ['stats', this.withAuthParams((ctx, params) => this.statisticsHandler.handleProfileStatsMenu(ctx, params))],
      ['stats:overview', this.withAuthParams((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['stats:activity', this.withAuthParams((ctx) => this.statisticsHandler.handleDetailedStatistics(ctx))],
      ['stats:earnings', this.withAuthParams((ctx) => this.statisticsHandler.handleEarningsStatistics(ctx))],
      ['stats:performance', this.withAuthParams((ctx) => this.statisticsHandler.handleTrafficStatistics(ctx))],
    ]);

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

    this.statsActionHandlers = new Map([
      ['overview', this.withAuth((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['detailed', this.withAuth((ctx) => this.statisticsHandler.handleDetailedStatistics(ctx))],
      ['traffic', this.withAuth((ctx) => this.statisticsHandler.handleTrafficStatistics(ctx))],
      ['earnings', this.withAuth((ctx) => this.statisticsHandler.handleEarningsStatistics(ctx))],
    ]);

    this.orderActionHandlers = new Map([
      ['list', this.withAuthParams((ctx) => this.menuHandler2.handleOrdersMenu(ctx))],
      [
        'active',
        this.withAuthParams(async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleActiveOrders(ctx, page);
        }),
      ],
      [
        'completed',
        this.withAuthParams(async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleCompletedOrders(ctx, page);
        }),
      ],
      [
        'create',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0 && params[0] === 'start') {
            await this.orderHandler.handleCreateOrderStart(ctx);
          } else if (params.length > 0 && params[0] === 'back') {
            await this.menuHandler2.handleOrdersMenu(ctx);
          } else {
            await this.orderHandler.handleCreateOrderStart(ctx);
          }
        }),
      ],
      ['search', this.withAuthParams((ctx) => this.orderHandler.handleOrderSearch(ctx))],
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
    ]);

    this.settingsActionHandlers = new Map([
      [
        'language',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          } else {
            await this.settingsHandler.handleLanguageSettings(ctx);
          }
        }),
      ],
      [
        'lang',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          }
        }),
      ],
      ['notifications', this.withAuthParams((ctx) => this.settingsHandler.handleNotificationSettings(ctx))],
      [
        'notify',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleNotificationToggle(ctx, params[0]);
          }
        }),
      ],
      ['preferences', this.withAuthParams((ctx) => this.settingsHandler.handlePreferencesSettings(ctx))],
      [
        'privacy',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0 && params[0]) {
            await this.settingsHandler.handlePrivacyToggle(ctx, params[0]);
          } else {
            await this.settingsHandler.handlePrivacySettings(ctx);
          }
        }),
      ],
      ['theme', this.withAuthParams((ctx) => this.settingsHandler.handleThemeSettings(ctx))],
      ['export', this.withAuthParams((ctx) => this.menuHandler2.handleExportMenu(ctx))],
      ['reset', this.withAuthParams((ctx) => this.menuHandler2.handleResetMenu(ctx))],
    ]);
  }

  /**
   * Route callback query to appropriate handler
   */
  async routeCallback(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
      return;
    }

    const { data } = ctx.callbackQuery;

    try {
      // Check rate limit
      const isAllowed = await this.rateLimitMiddleware.checkRateLimit(ctx, 'callback');

      if (!isAllowed) {
        await this.safeAnswerCallback(ctx, ctx.t('common.errors.rate_limit'));

        return;
      }

      // Parse callback data - split directly by ':' to get all parts
      // Format: primaryAction:secondaryAction:param1:param2:...
      const [primaryAction, secondaryAction, ...params] = data.split(':');

      this.logger.debug('Routing callback', {
        userId: ctx.from?.id,
        data,
        primaryAction,
        secondaryAction,
        params,
      });

      // Route to appropriate handler based on primary action using map
      const handler = this.primaryActionHandlers.get(primaryAction);

      if (handler) {
        await handler(ctx, secondaryAction, params);
      } else {
        this.logger.warn('Unknown primary action', { primaryAction, data });
        await this.safeAnswerCallback(ctx, ctx.t('common.errors.unknown_action'));
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('common.errors.unknown_action_help'),
        });
      }

      // Answer callback query to remove loading state
      await this.safeAnswerCallback(ctx);
    } catch (error) {
      this.logger.error('Error routing callback', {
        error: error instanceof Error ? error.message : String(error),
        data,
        userId: ctx.from?.id,
      });

      await this.safeAnswerCallback(ctx, ctx.t('common.error'));
      await this.menuHandler.handleMenuError(ctx, toError(error));
    }
  }

  /**
   * Route menu actions
   */
  private async routeMenuAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    // Default to 'main' if action is undefined or empty
    const menuAction = action || 'main';
    const handler = this.menuActionHandlers.get(menuAction);

    if (handler) {
      await handler(ctx);
    } else {
      this.logger.warn('Unknown menu action', { action: menuAction });
      // Fall back to main menu for unknown actions
      await this.handleMainMenu(ctx);
    }
  }

  /**
   * Route profile actions
   */
  private async routeProfileAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.profileActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.profileHandler.handleProfileView(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route balance actions
   */
  private async routeBalanceAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.balanceActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.balanceHandler.handleBalanceView(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route statistics actions
   */
  private async routeStatisticsAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const handler = this.statsActionHandlers.get(action || 'overview');

    if (handler) {
      await handler(ctx);
    } else if (isAuthenticated(ctx)) {
      await this.statisticsHandler.handleStatisticsOverview(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route order actions
   */
  private async routeOrderAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.orderActionHandlers.get(action || 'list');

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.menuHandler2.handleOrdersMenu(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route settings actions
   */
  private async routeSettingsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.settingsActionHandlers.get(action);

    if (handler) {
      await handler(ctx, params);
    } else if (isAuthenticated(ctx)) {
      await this.settingsHandler.handleSettingsView(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route moderation actions
   * Note: Moderation handler moved to app layer (apps/bot/src/handler/moderation-action.handler.ts)
   * to avoid circular dependency between bot-main and traffic-main.
   * This routing is now handled at the app level.
   *
   * Format: moderation:approve:traffic_source:requestId
   * or: moderation:decline:traffic_order:requestId
   */
  /*
  private async routeModerationAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    // Verify admin access (action should be 'approve' or 'decline')
    // params[0] should be entity type, params[1] should be requestId
    if (params.length < 2) {
      await ctx.answerCallbackQuery('❌ Invalid moderation request');

      return;
    }

    const [entityTypeStr, requestId] = params;

    // Map string to ModerationEntityType
    const entityTypeMap: Record<string, ModerationEntityType> = {
      traffic_source: ModerationEntityType.TrafficSource,
      traffic_order: ModerationEntityType.TrafficOrder,
    };

    const entityType = entityTypeMap[entityTypeStr] || null;

    if (!entityType) {
      await ctx.answerCallbackQuery('❌ Invalid entity type');

      return;
    }

    // Route to appropriate handler
    if (action === 'approve') {
      await this.moderationHandler.handleApprove(ctx, entityType, requestId);
    } else if (action === 'decline') {
      await this.moderationHandler.handleDecline(ctx, entityType, requestId);
    } else {
      await ctx.answerCallbackQuery('❌ Unknown moderation action');
    }
  }
  */

  /**
   * Route referral actions
   */
  private async routeReferralAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (isAuthenticated(ctx)) {
      await this.menuHandler2.handleReferralsMenu(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route payment actions
   */
  private async routePaymentAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (isAuthenticated(ctx)) {
      await this.menuHandler2.handlePaymentsMenu(ctx);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });
    }
  }

  /**
   * Route deposit actions
   */
  private async routeDepositAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    const depositActionHandlers: Record<string, (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>> = {
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
  private async routeWithdrawalAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    const withdrawalActionHandlers: Record<string, (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>> =
      {
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

  /**
   * Route traffic actions
   */
  private async routeTrafficAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const trafficActionHandlers: Record<string, (ctx: BotContext, params: string[]) => Promise<void>> = {
      sources: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('common.errors.authentication_required'),
          });

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
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('common.errors.authentication_required'),
          });

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
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('common.errors.authentication_required'),
          });

          return;
        }

        const [subAction, sourceId] = params;
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
      },
      target: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('common.errors.authentication_required'),
          });

          return;
        }

        const [subAction, targetId] = params;
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
      },
      analytics: async (ctx) => {
        if (!isAuthenticated(ctx)) {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('common.errors.authentication_required'),
          });

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
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('common.errors.authentication_required'),
        });

        return;
      }

      await this.trafficHandler.handleSellTrafficMenu(ctx);
    }
  }

  /**
   * Route support actions
   */
  private async routeSupportAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const supportHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      contact: (ctx) => this.supportHandler.handleSupportContact(ctx),
      report: (ctx) => this.supportHandler.handleSupportReport(ctx),
      suggest: (ctx) => this.supportHandler.handleSupportSuggest(ctx),
    };

    const handler = supportHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.supportHandler.handleSupportMenu(ctx);
    }
  }

  /**
   * Handle noop actions (pagination indicators, etc)
   */
  private async handleNoopAction(_ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    // Do nothing - these are UI-only elements
  }

  /**
   * Route help actions
   */
  private async routeHelpAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const helpHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      faq: (ctx) => this.supportHandler.handleFAQ(ctx),
      createOrder: (ctx) => this.helpHandler.handleHelpCreateOrder(ctx),
      topup: (ctx) => this.helpHandler.handleHelpTopup(ctx),
      withdraw: (ctx) => this.helpHandler.handleHelpWithdraw(ctx),
      stats: (ctx) => this.helpHandler.handleHelpStats(ctx),
      traffic: (ctx) => this.helpHandler.handleHelpTraffic(ctx),
    };

    const handler = helpHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.helpHandler.handleHelpMenu(ctx);
    }
  }

  /**
   * Route campaign actions
   */
  private async routeCampaignAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    await this.menuHandler2.handleCampaignMenu(ctx);
  }

  /**
   * Route admin actions
   */
  private async routeAdminAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    await this.menuHandler2.handleAdminMenu(ctx);
  }

  /**
   * Route auth actions
   */
  private async routeAuthAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('auth.feature_info'),
    });
  }

  /**
   * Route export actions
   */
  private async routeExportAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    await this.menuHandler2.handleExportMenu(ctx);
  }

  /**
   * Route reset actions
   */
  private async routeResetAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.authentication_required'),
      });

      return;
    }

    await this.menuHandler2.handleResetMenu(ctx);
  }

  /**
   * Route status actions
   */
  private async routeStatusAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.menuHandler2.handleStatusDisplay(ctx);
  }

  /**
   * Route command actions
   */
  private async routeCommandAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.menuHandler2.handleCommandsHelp(ctx);
  }

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const message = ctx.t('menu.main_menu.select_action');

    // Centralized menu layout:
    // Row 1: Sell Traffic | Buy Traffic
    // Row 2: Profile | Balance
    // Row 3: Support
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

  /**
   * Route text messages to appropriate conversation handler
   * Processes user text input based on current conversation state
   */
  async handleTextMessage(ctx: BotContext): Promise<void> {
    const conversationState = typeof ctx.session?.conversationState === 'string' ? ctx.session.conversationState : '';
    const formData = ctx.session?.formData;
    const messageText = ctx.message?.text;

    if (!messageText || !conversationState || !formData) {
      return;
    }

    // Check if context is authenticated - use isAuthenticated helper
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    // Now ctx is typed as AuthenticatedBotContext
    this.logger.debug('Handling text message', {
      conversationState,
      formData,
      messageText,
    });

    const conversationHandlers: Record<string, () => Promise<void>> = {
      trafficSourceCreate: async () => {
        await this.trafficHandler.handleTrafficSourceCreateInput(ctx, messageText);
      },
      trafficSourceEdit: async () => {
        await this.trafficHandler.handleTrafficSourceEditInput(ctx, messageText);
      },
      trafficTargetCreate: async () => {
        await this.trafficHandler.handleTrafficTargetCreateInput(ctx, messageText);
      },
      trafficTargetEdit: async () => {
        await this.trafficHandler.handleTrafficTargetEditInput(ctx, messageText);
      },
    };

    const handler = conversationHandlers[conversationState];
    if (handler) {
      await handler();
    }
  }
}
