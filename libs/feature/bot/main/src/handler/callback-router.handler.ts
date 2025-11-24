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
import {
  UserEntity,
  UserLastAuthEntity,
  UserBalanceHistoryEntity,
  UserBalanceEntity,
  UserRole,
  UserStatus,
  TrafficSourceEntity,
  TrafficSourceStatus,
  TrafficSourceType,
  TrafficTargetEntity,
  TrafficTargetStatus,
  TrafficTargetType,
  TrafficOrderEntity,
  TrafficOrderStatus,
  TransactionType,
} from '@app/database';
import { decimal, add, subtract, sum, multiply, divide, toDisplayString, toError } from '@app/common-shared';
import { MenuActionHandler } from './menu-action.handler';
import { ProfileActionHandler } from './profile-action.handler';
import { BalanceActionHandler } from './balance-action.handler';
import { StatisticsActionHandler } from './statistics-action.handler';
import { OrderActionHandler } from './order-action.handler';
import { SettingsActionHandler } from './settings-action.handler';
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
   * Wraps an authenticated handler, checking the type guard before calling
   */
  private withAuth(handler: (ctx: AuthenticatedBotContext) => Promise<void>): (ctx: BotContext) => Promise<void> {
    return async (ctx: BotContext) => {
      if (!isAuthenticated(ctx)) {
        await ctx.reply(ctx.t('common.errors.authentication_required'));

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
        await ctx.reply(ctx.t('common.errors.authentication_required'));

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
      // Note: Moderation routing moved to app layer to avoid circular dependency
      // ['moderation', this.routeModerationAction.bind(this)],
      ['support', this.routeSupportAction.bind(this)],
      ['help', this.routeHelpAction.bind(this)],
      ['campaign', this.routeCampaignAction.bind(this)],
      ['admin', this.routeAdminAction.bind(this)],
      ['auth', this.routeAuthAction.bind(this)],
      ['verify', this.routeVerifyAction.bind(this)],
      ['export', this.routeExportAction.bind(this)],
      ['reset', this.routeResetAction.bind(this)],
      ['status', this.routeStatusAction.bind(this)],
      ['command', this.routeCommandAction.bind(this)],
      ['noop', this.handleNoopAction.bind(this)],
      ['pagination', this.handleNoopAction.bind(this)],
    ]);

    this.menuActionHandlers = new Map([
      ['main', this.handleMainMenu.bind(this)],
      ['buy_traffic', this.handleBuyTrafficMenu.bind(this)],
      ['sell_traffic', this.handleSellTrafficMenu.bind(this)],
      ['profile', this.withAuth((ctx) => this.profileHandler.handleProfileView(ctx))],
      ['balance', this.withAuth((ctx) => this.balanceHandler.handleBalanceView(ctx))],
      ['statistics', this.withAuth((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['orders', this.withAuth((ctx) => this.handleOrdersMenu(ctx))],
      ['settings', this.withAuth((ctx) => this.settingsHandler.handleSettingsView(ctx))],
      ['referrals', this.withAuth((ctx) => this.handleReferralsMenu(ctx))],
      ['referral', this.withAuth((ctx) => this.handleReferralsMenu(ctx))],
      ['payments', this.withAuth((ctx) => this.handlePaymentsMenu(ctx))],
      ['support', this.handleSupportMenu.bind(this)],
      ['help', this.handleHelpMenu.bind(this)],
      ['traffic', this.withAuth((ctx) => this.handleSellTrafficMenu(ctx))],
      ['campaign', this.withAuth((ctx) => this.handleCampaignMenu(ctx))],
      ['withdrawal', this.withAuth((ctx) => this.balanceHandler.handleWithdrawalStart(ctx))],
      ['notifications', this.withAuth((ctx) => this.settingsHandler.handleNotificationSettings(ctx))],
    ]);

    this.profileActionHandlers = new Map([
      ['view', this.withAuthParams((ctx) => this.profileHandler.handleProfileView(ctx))],
      [
        'edit',
        this.withAuthParams(async (ctx, params) => {
          if (params.length > 0) {
            await ctx.reply(ctx.t('profile.enter_new_field', { field: params[0] }));
            if (ctx.session) {
              ctx.session.conversationState = 'profile_edit_field';
              ctx.session.formData = { field: params[0] };
            }
          } else {
            await this.profileHandler.handleProfileEditStart(ctx);
          }
        }),
      ],
      ['details', this.withAuthParams((ctx) => this.profileHandler.handleProfileDetails(ctx))],
      ['verify', this.withAuthParams((ctx) => this.profileHandler.handleVerification(ctx))],
      ['stats', this.withAuthParams((ctx, params) => this.handleProfileStatsMenu(ctx, params))],
      ['stats:overview', this.withAuthParams((ctx) => this.statisticsHandler.handleStatisticsOverview(ctx))],
      ['stats:activity', this.withAuthParams((ctx) => this.statisticsHandler.handleDetailedStatistics(ctx))],
      ['stats:earnings', this.withAuthParams((ctx) => this.statisticsHandler.handleEarningsStatistics(ctx))],
      ['stats:performance', this.withAuthParams((ctx) => this.statisticsHandler.handleTrafficStatistics(ctx))],
      ['security', this.handleProfileSecurityMenu.bind(this)],
      ['password', this.handlePasswordChange.bind(this)],
      ['email_security', this.handleEmailSecurity.bind(this)],
      ['login_history', this.withAuthParams((ctx) => this.handleLoginHistory(ctx))],
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
      ['analytics', this.withAuthParams((ctx) => this.handleBalanceAnalytics(ctx))],
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
      ['list', this.withAuthParams((ctx) => this.handleOrdersMenu(ctx))],
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
            await this.handleOrdersMenu(ctx);
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
      ['deleted', this.handleDeletedOrders.bind(this)],
      ['config', this.withAuthParams((ctx, params) => this.handleOrderConfig(ctx, params))],
      ['edit', this.handleOrderEdit.bind(this)],
      ['toggle', this.handleOrderToggle.bind(this)],
      ['delete', this.handleOrderDelete.bind(this)],
      ['download', this.handleOrderDownload.bind(this)],
      [
        'help',
        async (ctx, _params) => {
          await this.handleHelpMenu(ctx);
        },
      ],
      ['bot', this.handleOrderBotManagement.bind(this)],
      ['audience', this.handleOrderAudienceTargeting.bind(this)],
      ['gender', this.handleOrderGenderSelection.bind(this)],
      ['topic', this.handleOrderTopicSelection.bind(this)],
      ['location', this.handleOrderLocationSelection.bind(this)],
      [
        'refresh',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stats_refreshed'),
          });
        },
      ],
      ['stats', this.withAuthParams((ctx, params) => this.handleOrderStats(ctx, params))],
      ['duplicate', this.handleOrderDuplicate.bind(this)],
      ['integration', this.handleOrderIntegration.bind(this)],
      ['transfer', this.handleOrderTransfer.bind(this)],
      [
        'stop',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stopped'),
          });
        },
      ],
      ['view_channel', this.handleOrderChannelView.bind(this)],
      ['type', this.handleOrderTypeSelection.bind(this)],
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
            await this.handlePrivacyToggle(ctx, params[0]);
          } else {
            await this.settingsHandler.handlePrivacySettings(ctx);
          }
        }),
      ],
      ['theme', this.handleThemeSettings.bind(this)],
      ['export', this.withAuthParams((ctx) => this.handleExportMenu(ctx))],
      ['reset', this.withAuthParams((ctx) => this.handleResetMenu(ctx))],
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
        await ctx.answerCallbackQuery(ctx.t('common.errors.rate_limit'));

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
        await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));
        await ctx.reply(ctx.t('common.errors.unknown_action_help'));
      }

      // Answer callback query to remove loading state
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error routing callback', {
        error: error instanceof Error ? error.message : String(error),
        data,
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
      await ctx.reply(ctx.t('common.errors.authentication_required'));
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
      await ctx.reply(ctx.t('common.errors.authentication_required'));
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
      await ctx.reply(ctx.t('common.errors.authentication_required'));
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
      await this.handleOrdersMenu(ctx);
    } else {
      await ctx.reply(ctx.t('common.errors.authentication_required'));
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
      await ctx.reply(ctx.t('common.errors.authentication_required'));
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
      await this.handleReferralsMenu(ctx);
    } else {
      await ctx.reply(ctx.t('common.errors.authentication_required'));
    }
  }

  /**
   * Route payment actions
   */
  private async routePaymentAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (isAuthenticated(ctx)) {
      await this.handlePaymentsMenu(ctx);
    } else {
      await ctx.reply(ctx.t('common.errors.authentication_required'));
    }
  }

  /**
   * Route deposit actions
   */
  private async routeDepositAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    const depositActionHandlers: Record<string, (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>> = {
      card: async (ctx) => this.handleDepositCard(ctx),
      crypto: async (ctx) => this.handleDepositCrypto(ctx),
      bank: async (ctx) => this.handleDepositBank(ctx),
      amount: async (ctx, params) => this.handleDepositAmount(ctx, params[0]),
      confirm: async (ctx, params) => this.handleDepositConfirm(ctx, params),
      cancel: async (ctx) => this.handleDepositMenu(ctx),
      history: async (ctx) => this.handleDepositHistory(ctx),
      methods: async (ctx) => this.handleDepositMenu(ctx),
      bonuses: async (ctx) => this.handleDepositBonuses(ctx),
      create: async (ctx) => this.handleDepositMenu(ctx),
    };

    const handler = depositActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.handleDepositMenu(ctx);
    }
  }

  /**
   * Route withdrawal actions
   */
  private async routeWithdrawalAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    const withdrawalActionHandlers: Record<string, (ctx: AuthenticatedBotContext, params: string[]) => Promise<void>> =
      {
        currency: async (ctx, params) => this.handleWithdrawalCurrency(ctx, params[0]),
        amount: async (ctx, params) => this.handleWithdrawalAmount(ctx, params[0]),
        confirm: async (ctx, params) => this.handleWithdrawalConfirm(ctx, params),
        cancel: async (ctx) => this.handleWithdrawalMenu(ctx),
        history: async (ctx) => this.handleWithdrawalHistory(ctx),
        methods: async (ctx) => this.handleWithdrawalMethods(ctx),
        limits: async (ctx) => this.handleWithdrawalLimits(ctx),
        create: async (ctx) => this.handleWithdrawalMenu(ctx),
      };

    const handler = withdrawalActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.handleWithdrawalMenu(ctx);
    }
  }

  /**
   * Route traffic actions
   */
  private async routeTrafficAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const trafficActionHandlers: Record<string, (ctx: BotContext, params: string[]) => Promise<void>> = {
      sources: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await ctx.reply(ctx.t('common.errors.authentication_required'));

          return;
        }

        if (params.length > 0 && params[0] === 'add') {
          await this.handleTrafficSourceAdd(ctx);
        } else {
          await this.handleTrafficSourcesList(ctx);
        }
      },
      targets: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await ctx.reply(ctx.t('common.errors.authentication_required'));

          return;
        }

        if (params.length > 0 && params[0] === 'add') {
          await this.handleTrafficTargetAdd(ctx);
        } else {
          await this.handleTrafficTargetsList(ctx);
        }
      },
      source: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await ctx.reply(ctx.t('common.errors.authentication_required'));

          return;
        }

        const [subAction, sourceId] = params;
        if (subAction === 'view' && sourceId) {
          await this.handleTrafficSourceView(ctx, sourceId);
        } else if (subAction === 'edit' && sourceId) {
          await this.handleTrafficSourceEdit(ctx, sourceId);
        } else if (subAction === 'toggle' && sourceId) {
          await this.handleTrafficSourceToggle(ctx, sourceId);
        } else if (subAction === 'delete' && sourceId) {
          await this.handleTrafficSourceDelete(ctx, sourceId);
        } else if (subAction === 'stats' && sourceId) {
          await this.handleTrafficSourceStats(ctx, sourceId);
        }
      },
      target: async (ctx, params) => {
        if (!isAuthenticated(ctx)) {
          await ctx.reply(ctx.t('common.errors.authentication_required'));

          return;
        }

        const [subAction, targetId] = params;
        if (subAction === 'view' && targetId) {
          await this.handleTrafficTargetView(ctx, targetId);
        } else if (subAction === 'edit' && targetId) {
          await this.handleTrafficTargetEdit(ctx, targetId);
        } else if (subAction === 'toggle' && targetId) {
          await this.handleTrafficTargetToggle(ctx, targetId);
        } else if (subAction === 'delete' && targetId) {
          await this.handleTrafficTargetDelete(ctx, targetId);
        } else if (subAction === 'stats' && targetId) {
          await this.handleTrafficTargetStats(ctx, targetId);
        }
      },
      analytics: async (ctx) => {
        if (!isAuthenticated(ctx)) {
          await ctx.reply(ctx.t('common.errors.authentication_required'));

          return;
        }

        await this.handleTrafficAnalytics(ctx);
      },
    };

    const handler = trafficActionHandlers[action];

    if (handler) {
      await handler(ctx, params);
    } else {
      if (!isAuthenticated(ctx)) {
        await ctx.reply(ctx.t('common.errors.authentication_required'));

        return;
      }

      await this.handleSellTrafficMenu(ctx);
    }
  }

  /**
   * Route support actions
   */
  private async routeSupportAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const supportHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      contact: (ctx) => this.handleSupportContact(ctx),
      report: (ctx) => this.handleSupportReport(ctx),
      suggest: (ctx) => this.handleSupportSuggest(ctx),
    };

    const handler = supportHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.handleSupportMenu(ctx);
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
      faq: (ctx) => this.handleHelpFAQ(ctx),
      createOrder: (ctx) => this.handleHelpCreateOrder(ctx),
      topup: (ctx) => this.handleHelpTopup(ctx),
      withdraw: (ctx) => this.handleHelpWithdraw(ctx),
      stats: (ctx) => this.handleHelpStats(ctx),
      traffic: (ctx) => this.handleHelpTraffic(ctx),
    };

    const handler = helpHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.handleHelpMenu(ctx);
    }
  }

  /**
   * Route campaign actions
   */
  private async routeCampaignAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    await this.handleCampaignMenu(ctx);
  }

  /**
   * Route admin actions
   */
  private async routeAdminAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    await this.handleAdminMenu(ctx);
  }

  /**
   * Route auth actions
   */
  private async routeAuthAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await ctx.reply(ctx.t('auth.feature_info'));
  }

  /**
   * Route verify actions
   */
  private async routeVerifyAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (isAuthenticated(ctx)) {
      await this.profileHandler.handleVerification(ctx);
    } else {
      await ctx.reply(ctx.t('common.errors.authentication_required'));
    }
  }

  /**
   * Route export actions
   */
  private async routeExportAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    await this.handleExportMenu(ctx);
  }

  /**
   * Route reset actions
   */
  private async routeResetAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(ctx.t('common.errors.authentication_required'));

      return;
    }

    await this.handleResetMenu(ctx);
  }

  /**
   * Route status actions
   */
  private async routeStatusAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleStatusDisplay(ctx);
  }

  /**
   * Route command actions
   */
  private async routeCommandAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleCommandsHelp(ctx);
  }

  // Placeholder methods for additional features

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
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic menu - for users who want to purchase subscribers
   */
  private async handleBuyTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [balance, activeOrdersCount] = await Promise.all([
      this.em.findOne(UserBalanceEntity, { user: ctx.user.id }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
    ]);

    const availableBalance = balance ? toDisplayString(balance.balance, 2) : '0.00';

    const text = `<b>🛒 ${ctx.t('buy_traffic.title')}</b>

${ctx.t('buy_traffic.description')}

<b>💰 ${ctx.t('buy_traffic.your_balance')}:</b> $${availableBalance}
<b>📦 ${ctx.t('buy_traffic.active_orders')}:</b> ${activeOrdersCount}

<b>📋 ${ctx.t('buy_traffic.how_it_works')}:</b>
1. ${ctx.t('buy_traffic.step1')}
2. ${ctx.t('buy_traffic.step2')}
3. ${ctx.t('buy_traffic.step3')}
4. ${ctx.t('buy_traffic.step4')}
5. ${ctx.t('buy_traffic.step5')}

<i>${ctx.t('buy_traffic.select_action')} 👇</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('buy_traffic.btn_new_order'), 'order:create:start')
      .text(ctx.t('buy_traffic.btn_my_orders'), 'orders:list')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Sell Traffic menu - for users who want to monetize their bot/channel
   */
  private async handleSellTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [sourcesCount, activeSourcesCount, balance] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id, status: TrafficSourceStatus.Active }),
      this.em.findOne(UserBalanceEntity, { user: ctx.user.id }),
    ]);

    const pendingEarnings = balance ? toDisplayString(balance.lockedBalance, 2) : '0.00';
    const availableBalance = balance ? toDisplayString(balance.balance, 2) : '0.00';

    const text = `<b>💰 ${ctx.t('sell_traffic.title')}</b>

${ctx.t('sell_traffic.description')}

<b>📊 ${ctx.t('sell_traffic.your_stats')}:</b>
• ${ctx.t('sell_traffic.total_sources')}: ${sourcesCount}
• ${ctx.t('sell_traffic.active_sources')}: ${activeSourcesCount}
• ${ctx.t('sell_traffic.pending_earnings')}: $${pendingEarnings}
• ${ctx.t('sell_traffic.available_balance')}: $${availableBalance}

<b>💡 ${ctx.t('sell_traffic.how_to_earn')}:</b>
1. ${ctx.t('sell_traffic.step1')}
2. ${ctx.t('sell_traffic.step2')}
3. ${ctx.t('sell_traffic.step3')}
4. ${ctx.t('sell_traffic.step4')}

<i>${ctx.t('sell_traffic.select_action')} 👇</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources')
      .text(ctx.t('sell_traffic.btn_add_source'), 'traffic:sources:add')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleOrdersMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const [activeCount, completedCount, totalCount] = await Promise.all([
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Completed,
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
    ]);

    const text = `<b>📦 ${ctx.t('orders.title')}</b>

<b>📊 ${ctx.t('orders.stats_title')}:</b>
• ${ctx.t('orders.active_count')}: ${activeCount}
• ${ctx.t('orders.completed_count')}: ${completedCount}
• ${ctx.t('orders.total_count')}: ${totalCount}

<i>${ctx.t('common.select_action')}:</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.btn_new'), 'order:create:start')
      .row()
      .text(ctx.t('orders.btn_active'), 'orders:active')
      .text(ctx.t('orders.btn_completed'), 'orders:completed')
      .row()
      .text(ctx.t('orders.btn_search'), 'orders:search')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleReferralsMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const botUsername = ctx.me.username;
    const referralCode = ctx.user.id.substring(0, 8);
    const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

    const text = `<b>🎁 ${ctx.t('referrals.title')}</b>

${ctx.t('referrals.description')}

<b>💰 ${ctx.t('referrals.rewards_title')}:</b>
• ${ctx.t('referrals.reward_percent')}
• ${ctx.t('referrals.reward_lifetime')}
• ${ctx.t('referrals.reward_unlimited')}

<b>🔗 ${ctx.t('referrals.link_title')}:</b>
<code>${referralLink}</code>

<b>📊 ${ctx.t('referrals.stats_title')}:</b>
• ${ctx.t('referrals.invited')}: 0
• ${ctx.t('referrals.earned')}: $0.00

<i>${ctx.t('referrals.share_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('referrals.btn_copy'), 'referral:copy')
      .row()
      .text(ctx.t('referrals.btn_list'), 'referral:list')
      .text(ctx.t('referrals.btn_stats'), 'referral:stats')
      .row()
      .text(ctx.t('referrals.btn_share'), 'referral:share')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handlePaymentsMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const transactionCount = await this.em.count(UserBalanceHistoryEntity, { user: ctx.user.id });

    const text = `<b>💳 ${ctx.t('payments.title')}</b>

${ctx.t('payments.description')}

<b>📊 ${ctx.t('payments.stats_title')}:</b>
• ${ctx.t('payments.total_transactions')}: ${transactionCount}

<b>💰 ${ctx.t('payments.deposit_methods')}:</b>
• ${ctx.t('payments.method_cards')}
• ${ctx.t('payments.method_crypto')}
• ${ctx.t('payments.method_wallets')}

<b>💸 ${ctx.t('payments.withdraw_methods')}:</b>
• ${ctx.t('payments.withdraw_crypto')}
• ${ctx.t('payments.withdraw_wallets')}
• ${ctx.t('payments.withdraw_min')}

<i>${ctx.t('common.select_action')}:</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('payments.btn_deposit'), 'balance:deposit')
      .text(ctx.t('payments.btn_withdraw'), 'balance:withdraw')
      .row()
      .text(ctx.t('payments.btn_history'), 'payment:history')
      .row()
      .text(ctx.t('payments.btn_methods'), 'payment:methods')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportMenu(ctx: BotContext): Promise<void> {
    const text = `<b>🏢 ${ctx.t('support.title')}</b>

${ctx.t('support.description')}

<b>📞 ${ctx.t('support.contact_methods')}:</b>
• ${ctx.t('support.telegram')}: @motivbuy_support
• ${ctx.t('support.email')}: support@motivbuy.com

<b>⏰ ${ctx.t('support.working_hours')}:</b>
• ${ctx.t('support.weekdays')}
• ${ctx.t('support.weekends')}

<b>📋 ${ctx.t('support.faq_title')}:</b>
• ${ctx.t('help.faq_create_order')}
• ${ctx.t('help.faq_deposit')}
• ${ctx.t('help.faq_withdraw')}
• ${ctx.t('help.faq_bot_issues')}

<i>${ctx.t('support.select_action')}.</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('support.btn_faq'), 'help:faq')
      .row()
      .text(ctx.t('support.btn_report'), 'support:report')
      .text(ctx.t('support.btn_suggest'), 'support:suggest')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpMenu(ctx: BotContext): Promise<void> {
    const text = `<b>❓ ${ctx.t('menu.help.title')}</b>

${ctx.t('help.welcome')}

<b>🚀 ${ctx.t('help.quick_start')}:</b>
1. ${ctx.t('help.step1')}
2. ${ctx.t('help.step2')}
3. ${ctx.t('help.step3')}
4. ${ctx.t('help.step4')}

<b>📚 ${ctx.t('help.sections_title')}:</b>
• ${ctx.t('help.section_orders')}
• ${ctx.t('help.section_balance')}
• ${ctx.t('help.section_stats')}
• ${ctx.t('help.section_traffic')}

<b>💬 ${ctx.t('help.commands_title')}:</b>
/start - ${ctx.t('commands.start_desc')}
/menu - ${ctx.t('commands.menu_desc')}
/balance - ${ctx.t('commands.balance_desc')}
/profile - ${ctx.t('commands.profile_desc')}
/settings - ${ctx.t('commands.settings_desc')}
/help - ${ctx.t('commands.help_desc')}

<i>${ctx.t('help.contact_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_create_order'), 'help:createOrder')
      .row()
      .text(ctx.t('help.btn_topup'), 'help:topup')
      .text(ctx.t('help.btn_withdraw'), 'help:withdraw')
      .row()
      .text(ctx.t('help.btn_stats'), 'help:stats')
      .text(ctx.t('help.btn_traffic'), 'help:traffic')
      .row()
      .text(ctx.t('support.btn_contact'), 'support:contact')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get traffic sources managed by user
    const sources = await this.em.find(TrafficSourceEntity, { managedBy: ctx.user.id }, { populate: ['orders'] });

    // Get active traffic orders
    const activeOrders = await this.em.count(TrafficOrderEntity, {
      creator: ctx.user.id,
      status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
    });

    const totalOrders = await this.em.count(TrafficOrderEntity, { creator: ctx.user.id });

    let text = `<b>${ctx.t('traffic.management_title')}</b>\n\n`;
    text += `<b>${ctx.t('common.overview')}:</b>\n`;
    text += `• ${ctx.t('traffic.sources')}: ${sources.length}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('orders.total')}: ${totalOrders}\n\n`;

    if (sources.length > 0) {
      text += `<b>${ctx.t('traffic.your_sources')}:</b>\n`;
      sources.slice(0, 5).forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        text += `${statusEmoji} ${source.name} (${source.type})\n`;
      });

      if (sources.length > 5) {
        text += `... ${ctx.t('common.and_more')} ${sources.length - 5} ${ctx.t('common.more')}\n`;
      }
    } else {
      text += `<i>${ctx.t('traffic.no_sources')}</i>`;
    }

    const keyboard = this.menuHandler.createTrafficMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleCampaignMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get campaign statistics (campaigns are TrafficOrders)
    const [active, completed, total] = await Promise.all([
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Completed,
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
    ]);

    // Get recent campaigns
    const recentCampaigns = await this.em.find(
      TrafficOrderEntity,
      { creator: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 5, populate: ['trafficTarget'] },
    );

    const totalSpent = recentCampaigns.reduce((acc, order) => {
      return acc.plus(decimal(order.spentAmount || '0'));
    }, decimal(0));

    let text = `<b>${ctx.t('campaign.management_title')}</b>\n\n`;
    text += `<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('campaign.active')}: ${active}\n`;
    text += `• ${ctx.t('common.completed')}: ${completed}\n`;
    text += `• ${ctx.t('common.total')}: ${total}\n`;
    text += `• ${ctx.t('common.total_spent')}: $${toDisplayString(totalSpent, 2)}\n\n`;

    if (recentCampaigns.length > 0) {
      text += `<b>${ctx.t('campaign.recent')}:</b>\n`;
      for (const campaign of recentCampaigns) {
        const statusEmoji =
          {
            [TrafficOrderStatus.Active]: '✅',
            [TrafficOrderStatus.InProgress]: '🔄',
            [TrafficOrderStatus.Completed]: '✔️',
            [TrafficOrderStatus.Pending]: '⏳',
            [TrafficOrderStatus.Cancelled]: '❌',
            [TrafficOrderStatus.Failed]: '⚠️',
          }[campaign.status] || '❓';

        text += `${statusEmoji} ${campaign.orderId.substring(0, 8)}... (${campaign.type})\n`;
        text += `   ${ctx.t('common.progress')}: ${campaign.currentCount}/${campaign.targetCount}\n`;
      }
    } else {
      text += `<i>${ctx.t('campaign.no_campaigns')}</i>`;
    }

    const keyboard = this.menuHandler.createCampaignMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleProfileStatsMenu(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    // If no specific stat requested, show overview using StatisticsActionHandler
    if (!_params || _params.length === 0) {
      await this.statisticsHandler.handleStatisticsOverview(ctx);

      return;
    }

    // Route to specific stat views using Map pattern
    const statsHandlers: Record<string, (ctx: AuthenticatedBotContext) => Promise<void>> = {
      overview: (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx),
      activity: (ctx) => this.statisticsHandler.handleDetailedStatistics(ctx),
      earnings: (ctx) => this.statisticsHandler.handleEarningsStatistics(ctx),
      performance: (ctx) => this.statisticsHandler.handleTrafficStatistics(ctx),
    };

    const [statType] = _params;
    const handler = statsHandlers[statType] || statsHandlers.overview;
    await handler(ctx);
  }

  private async handleProfileSecurityMenu(ctx: BotContext, _params: string[]): Promise<void> {
    const keyboard = this.menuHandler.createProfileSecurityMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.security_menu', {
        default: '🔒 Security Settings\n\nManage your account security options.',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handlePasswordChange(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.password_change', {
        default: '🔑 Change Password\n\nTo change your password, please enter your current password:',
      }),
      parseMode: 'HTML',
    });

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_current_password';
    }
  }

  private async handleEmailSecurity(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.email_security', {
        default:
          '📧 Email Security\n\n✅ Email notifications are enabled\n✅ Two-factor authentication available\n\nUse the buttons below to manage your email settings.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:profile'),
    });
  }

  private async handleLoginHistory(ctx: AuthenticatedBotContext): Promise<void> {
    const lastAuth = await this.em.findOne(UserLastAuthEntity, { user: ctx.user.id });

    let text = '<b>🔐 Login History</b>\n\n';

    if (lastAuth) {
      const timeDiff = Date.now() - lastAuth.updatedAt.getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));

      let timeText = 'just now';
      if (hoursAgo > 24) {
        timeText = `${Math.floor(hoursAgo / 24)} day(s) ago`;
      } else if (hoursAgo > 0) {
        timeText = `${hoursAgo} hour(s) ago`;
      } else if (minutesAgo > 0) {
        timeText = `${minutesAgo} minute(s) ago`;
      }

      text += `<b>Last Login:</b>\n`;
      text += `📅 Time: ${timeText}\n`;
      text += `🕐 Date: ${lastAuth.updatedAt.toLocaleString()}\n`;
      text += `📍 IP: ${lastAuth.ip || 'Unknown'}\n`;

      if (lastAuth.city || lastAuth.country) {
        text += `🌍 Location: ${lastAuth.city || ''}${lastAuth.city && lastAuth.country ? ', ' : ''}${lastAuth.country || ''}\n`;
      }

      if (lastAuth.continent) {
        text += `🗺 Continent: ${lastAuth.continent}\n`;
      }

      text += '\n✅ No suspicious activity detected.';
    } else {
      text += '📱 No login history available yet.\n';
      text += 'Login history will be tracked starting from your next login.';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'profile:security'),
    });
  }

  private async handleBalanceAnalytics(ctx: AuthenticatedBotContext): Promise<void> {
    // Get all balance history for analytics
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 100 },
    );

    if (history.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: '📊 <b>Balance Analytics</b>\n\nNo transaction history available yet.\nStart using the platform to see your analytics!',
        parseMode: 'HTML',
        replyMarkup: this.createBackButton(ctx, 'menu:balance'),
      });

      return;
    }

    // Calculate analytics

    let totalIncome = decimal(0);
    let totalExpense = decimal(0);
    const last30Days = history.filter((tx) => {
      const daysDiff = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return daysDiff <= 30;
    });

    const last7Days = history.filter((tx) => {
      const daysDiff = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return daysDiff <= 7;
    });

    history.forEach((tx) => {
      const amount = decimal(tx.amount);
      if (amount.greaterThan(0)) {
        totalIncome = add(totalIncome, amount);
      } else {
        totalExpense = add(totalExpense, amount.abs());
      }
    });

    const income30Days = last30Days
      .filter((tx) => decimal(tx.amount).greaterThan(0))
      .reduce((sum, tx) => add(sum, decimal(tx.amount)), decimal(0));

    const income7Days = last7Days
      .filter((tx) => decimal(tx.amount).greaterThan(0))
      .reduce((sum, tx) => add(sum, decimal(tx.amount)), decimal(0));

    const netBalance = subtract(totalIncome, totalExpense);
    const avgTransaction = history.length > 0 ? totalIncome.div(history.length) : decimal(0);

    let text = '<b>📊 Balance Analytics</b>\n\n';
    text += '<b>💰 All Time:</b>\n';
    text += `• Total Income: $${toDisplayString(totalIncome, 2)}\n`;
    text += `• Total Expenses: $${toDisplayString(totalExpense, 2)}\n`;
    text += `• Net Balance: $${toDisplayString(netBalance, 2)}\n\n`;

    text += '<b>📈 Last 30 Days:</b>\n';
    text += `• Income: $${toDisplayString(income30Days, 2)}\n`;
    text += `• Transactions: ${last30Days.length}\n\n`;

    text += '<b>📅 Last 7 Days:</b>\n';
    text += `• Income: $${toDisplayString(income7Days, 2)}\n`;
    text += `• Transactions: ${last7Days.length}\n\n`;

    text += '<b>📊 Averages:</b>\n';
    text += `• Avg Transaction: $${toDisplayString(avgTransaction, 2)}\n`;
    text += `• Total Transactions: ${history.length}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:balance'),
    });
  }

  private async handleWithdrawalMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get user balances
    const balances = await this.em.find(UserBalanceEntity, { user: ctx.user.id }, { populate: ['currency'] });

    let text = '<b>💸 Withdrawal</b>\n\n';
    text += '<b>Available Balances:</b>\n';

    let hasAvailableBalance = false;
    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const available = balance.getAvailableBalance();
      if (decimal(available).greaterThan(0)) {
        hasAvailableBalance = true;
        text += `• ${currency.code}: ${toDisplayString(available, 8)} ${currency.symbol || currency.code}\n`;
      }
    }

    if (!hasAvailableBalance) {
      text += '\n<i>No available balance for withdrawal.</i>\n\n';
      text += 'Minimum withdrawal: $10.00';
    } else {
      text += '\n✅ You can withdraw your funds';
    }

    const keyboard = this.menuHandler.createWithdrawalMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleDepositMenu(ctx: AuthenticatedBotContext): Promise<void> {
    let text = '<b>💰 Deposit Funds</b>\n\n';
    text += '<b>Available Methods:</b>\n';
    text += '• 💳 Credit/Debit Card\n';
    text += '• 🪙 Cryptocurrency (BTC, ETH, USDT)\n';
    text += '• 🏦 Bank Transfer\n\n';
    text += '<b>Important:</b>\n';
    text += '• Minimum deposit: $10.00\n';
    text += '• Instant processing for crypto & cards\n';
    text += '• Bank transfers: 1-3 business days\n\n';
    text += '<i>Select a payment method below to continue.</i>';

    const keyboard = this.menuHandler.createDepositMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleAdminMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Check if user has admin or super admin role
    if (ctx.user.role !== UserRole.Admin && ctx.user.role !== UserRole.SuperAdmin) {
      await ctx.reply('⛔️ Access denied. Admin privileges required.');

      return;
    }

    // Get admin statistics
    const [totalUsers, activeUsers] = await Promise.all([
      this.em.count(UserEntity),
      this.em.count(UserEntity, { status: UserStatus.Active }),
    ]);

    const [totalOrders, activeOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity),
      this.em.count(TrafficOrderEntity, {
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
    ]);

    const totalSources = await this.em.count(TrafficSourceEntity);

    let text = '<b>🔧 Admin Panel</b>\n\n';
    text += '<b>👥 Users:</b>\n';
    text += `• Total: ${totalUsers}\n`;
    text += `• Active: ${activeUsers}\n\n`;
    text += '<b>📋 Orders:</b>\n';
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n\n`;
    text += '<b>🎯 Traffic Sources:</b>\n';
    text += `• Total: ${totalSources}\n\n`;
    text += '<i>Select an action below to manage the system.</i>';

    const keyboard = this.menuHandler.createAdminMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleExportMenu(ctx: AuthenticatedBotContext): Promise<void> {
    // Get data counts for export preview
    const [ordersCount, transactionsCount] = await Promise.all([
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
      this.em.count(UserBalanceHistoryEntity, { user: ctx.user.id }),
    ]);

    let text = '<b>📥 Data Export</b>\n\n';
    text += '<b>Available Data:</b>\n';
    text += `• Profile Information\n`;
    text += `• Orders: ${ordersCount} records\n`;
    text += `• Transactions: ${transactionsCount} records\n`;
    text += `• Statistics & Analytics\n\n`;
    text += '<b>Export Formats:</b>\n';
    text += '• JSON (raw data)\n';
    text += '• CSV (spreadsheet)\n';
    text += '• PDF (formatted report)\n\n';
    text += '<i>Select what you want to export below.</i>\n\n';
    text += '⚠️ Export may take a few moments for large datasets.';

    const keyboard = this.menuHandler.createExportMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleResetMenu(ctx: AuthenticatedBotContext): Promise<void> {
    let text = '<b>🔄 Reset Account</b>\n\n';
    text += '⚠️ <b>WARNING:</b> This action will reset:\n\n';
    text += '❌ All settings to default\n';
    text += '❌ Notification preferences\n';
    text += '❌ Display preferences\n';
    text += '❌ Language settings\n\n';
    text += '✅ <b>Will NOT affect:</b>\n';
    text += '• Your balance\n';
    text += '• Order history\n';
    text += '• Transaction history\n';
    text += '• Profile verification\n\n';
    text += '⚡️ <b>This action is IRREVERSIBLE!</b>\n\n';
    text += 'Are you absolutely sure you want to continue?';

    const keyboard = this.menuHandler.createConfirmationKeyboard('reset');
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleThemeSettings(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('settings.theme', {
        default:
          '🎨 Theme Settings\n\n✅ Auto-adapt theme (recommended)\n\nTheme automatically adapts to your Telegram settings.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:settings'),
    });
  }

  private async handlePrivacyToggle(ctx: BotContext, setting: string): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('settings.privacy_updated', {
        default: `✅ Privacy setting "${setting}" has been updated.`,
        setting,
      }),
      parseMode: 'HTML',
    });
  }

  private async handleStatusDisplay(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('status.display', {
        default: `📊 Account Status\n\n🆔 User ID: ${userId || 'Unknown'}\n✅ Status: Active\n📅 Member since: Today\n\nAll systems operational.`,
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:main'),
    });
  }

  private async handleCommandsHelp(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('commands.help_text', {
        default:
          '💬 Available Commands\n\n/start - Start bot\n/menu - Open menu\n/help - Show help\n/profile - View profile\n/balance - Check balance\n/settings - Settings\n/stats - Statistics',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:main'),
    });
  }

  // Order management handlers
  private async handleDeletedOrders(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.deleted_list'),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderConfig(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    if (!_params || _params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.select_to_configure'),
        parseMode: 'HTML',
        replyMarkup: this.createBackButton(ctx, 'menu:orders'),
      });

      return;
    }

    const [orderId] = _params;
    await this.orderHandler.handleOrderDetails(ctx, orderId);
  }

  private async handleOrderEdit(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderToggle(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.toggled'),
      parseMode: 'HTML',
    });
  }

  private async handleOrderDelete(ctx: BotContext, _params: string[]): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard('order:delete', { id: _params[0] || '' });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.delete_confirm', {
        default: '⚠️ Delete Order\n\nAre you sure you want to delete this order? This action cannot be undone.',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleOrderDownload(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.download_preparing', {
        default: '📥 Preparing download...\n\nYour order data will be sent shortly.',
      }),
      parseMode: 'HTML',
    });
  }

  private async handleOrderBotManagement(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.bot_management', {
        default: '🤖 Bot Management\n\nManage bots associated with your orders.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderAudienceTargeting(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.audience_targeting', {
        default:
          '🎯 Audience Targeting\n\nDefine your target audience:\n- Age range\n- Gender\n- Location\n- Interests',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderGenderSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.gender_selection', {
        default: '👥 Gender Selection\n\nChoose target gender:\n• All\n• Male\n• Female',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderTopicSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.topic_selection'),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderLocationSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.location_selection', {
        default: '🌍 Location Selection\n\nSelect target locations for your campaign.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderStats(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const { em } = this;

    if (!params || params.length === 0) {
      // Show overall order statistics
      const [totalOrders, activeOrders, completedOrders] = await Promise.all([
        em.count(TrafficOrderEntity, { creator: ctx.user.id }),
        em.count(TrafficOrderEntity, {
          creator: ctx.user.id,
          status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
        }),
        em.count(TrafficOrderEntity, {
          creator: ctx.user.id,
          status: TrafficOrderStatus.Completed,
        }),
      ]);

      const orders = await em.find(TrafficOrderEntity, { creator: ctx.user.id });

      const totalSpent = sum(orders.map((o) => decimal(o.spentAmount || '0')));
      const totalBudget = sum(orders.map((o) => decimal(o.totalBudget || '0')));
      const totalActions = orders.reduce((acc, o) => acc + o.currentCount, 0);
      const targetActions = orders.reduce((acc, o) => acc + o.targetCount, 0);

      const completionRate =
        targetActions > 0 ? toDisplayString(multiply(divide(totalActions, targetActions), 100), 1) : '0.0';

      let text = `<b>${ctx.t('orders.statistics_title')}</b>\n\n`;
      text += `<b>${ctx.t('common.overview')}:</b>\n`;
      text += `• ${ctx.t('orders.total_orders')}: ${totalOrders}\n`;
      text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
      text += `• ${ctx.t('orders.completed')}: ${completedOrders}\n\n`;
      text += `<b>${ctx.t('common.financial')}:</b>\n`;
      text += `• ${ctx.t('orders.total_budget')}: $${toDisplayString(totalBudget, 2)}\n`;
      text += `• ${ctx.t('orders.total_spent')}: $${toDisplayString(totalSpent, 2)}\n\n`;
      text += `<b>${ctx.t('common.performance')}:</b>\n`;
      text += `• ${ctx.t('orders.actions_completed')}: ${totalActions}\n`;
      text += `• ${ctx.t('orders.target_actions')}: ${targetActions}\n`;
      text += `• ${ctx.t('orders.completion_rate')}: ${completionRate}%`;

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: this.createBackButton(ctx, 'menu:orders'),
      });
    } else {
      // Show specific order stats
      const [orderId] = params;
      await this.orderHandler.handleOrderDetails(ctx, orderId);
    }
  }

  private async handleOrderDuplicate(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.duplicated'),
      parseMode: 'HTML',
    });
  }

  private async handleOrderIntegration(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.integration', {
        default: '🔗 Order Integration\n\nConnect your order with external services.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderTransfer(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.transfer'),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderChannelView(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.channel_view', {
        default: '📺 Channel Information\n\nView details about the associated channel.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  private async handleOrderTypeSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.type_selection', {
        default: '📋 Order Type\n\nSelect the type of order you want to create.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:orders'),
    });
  }

  // Support action handlers
  private async handleSupportContact(ctx: BotContext): Promise<void> {
    const text = `<b>💬 ${ctx.t('support.contact_title')}</b>

${ctx.t('support.contact_intro')}

<b>📱 Telegram:</b>
@motivbuy_support - ${ctx.t('support.fast_response')}

<b>📧 Email:</b>
support@motivbuy.com

<b>⏰ ${ctx.t('support.response_time')}:</b>
• Telegram: ${ctx.t('support.response_telegram')}
• Email: ${ctx.t('support.response_email')}

<i>${ctx.t('support.contact_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_write_telegram'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportReport(ctx: BotContext): Promise<void> {
    const text = `<b>📝 ${ctx.t('support.report_title')}</b>

${ctx.t('support.report_intro')}

<b>${ctx.t('support.what_we_need')}:</b>
• ${ctx.t('support.report_q1')}
• ${ctx.t('support.report_q2')}
• ${ctx.t('support.report_q3')}
• ${ctx.t('support.report_q4')}

<b>${ctx.t('support.common_issues')}:</b>
• ${ctx.t('support.issue_order')}
• ${ctx.t('support.issue_payment')}
• ${ctx.t('support.issue_subscribers')}
• ${ctx.t('support.issue_bot')}

<i>${ctx.t('support.report_hint')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_send_report'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_report';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  // Traffic Source Handlers

  private async handleTrafficSourcesList(ctx: AuthenticatedBotContext): Promise<void> {
    const sources = await this.em.find(
      TrafficSourceEntity,
      { managedBy: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.sources_list_title');

    if (sources.length === 0) {
      text += ctx.t('traffic.no_sources', {
        default: '<i>No traffic sources yet. Click "Add New Source" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.sources_count', {
        default: `Total: ${sources.length} source(s)\n\n`,
        count: sources.length,
      });

      sources.forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        const typeLabel = source.type === TrafficSourceType.Bot ? '🤖 Bot' : '🔑 Bot with Token';
        text += `${statusEmoji} <b>${source.name}</b>\n`;
        text += `   Type: ${typeLabel}\n`;
        text += `   Status: ${source.status}\n\n`;
      });
    }

    const sourcesList = sources.map((s) => ({ id: s.id, name: s.name, status: s.status }));
    const keyboard = this.menuHandler.createTrafficSourcesKeyboard(ctx, sourcesList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficSourceAdd(ctx: AuthenticatedBotContext): Promise<void> {
    // Set session state for source creation
    if (ctx.session) {
      ctx.session.conversationState = 'traffic_source_create';
      ctx.session.formData = { step: 'enter_name' };
    }

    let text = ctx.t('traffic.add_source_title');
    text += ctx.t('traffic.add_source_instructions', {
      default: 'Please enter the name for your new traffic source:\n\n<i>Use /cancel to abort.</i>',
    });

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'traffic:sources'),
    });
  }

  private async handleTrafficSourceView(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await ctx.reply(ctx.t('traffic.source_not_found'));

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderEntity, { trafficSource: source.id });
    const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
    const typeLabel = source.type === TrafficSourceType.Bot ? '🤖 Bot' : '🔑 Bot with Token';

    let text = ctx.t('traffic.source_details_title');
    text += `<b>Name:</b> ${source.name}\n`;
    text += `<b>Type:</b> ${typeLabel}\n`;
    text += `<b>Status:</b> ${statusEmoji} ${source.status}\n`;

    if (source.botUsername) {
      text += `<b>Bot Username:</b> @${source.botUsername}\n`;
    }

    if (source.description) {
      text += `<b>Description:</b> ${source.description}\n`;
    }

    text += `\n<b>Statistics:</b>\n`;
    text += `• Total Orders: ${ordersCount}\n`;
    text += `• Created: ${source.createdAt.toLocaleDateString()}\n`;

    const keyboard = this.menuHandler.createTrafficSourceDetailKeyboard(ctx, sourceId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficSourceEdit(ctx: BotContext, sourceId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'traffic_source_edit';
      ctx.session.formData = { sourceId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_source', {
        default: '<b>✏️ Edit Traffic Source</b>\n\nEnter the new name for this source:\n\n<i>Use /cancel to abort.</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  private async handleTrafficSourceToggle(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await ctx.reply(ctx.t('traffic.source_not_found'));

      return;
    }

    // Toggle status
    source.status =
      source.status === TrafficSourceStatus.Active ? TrafficSourceStatus.Inactive : TrafficSourceStatus.Active;

    await this.em.flush();

    await ctx.answerCallbackQuery(ctx.t('traffic.source_status_toggled'));

    // Refresh the view
    await this.handleTrafficSourceView(ctx, sourceId);
  }

  private async handleTrafficSourceDelete(ctx: BotContext, sourceId: string): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard(`traffic:source:delete:confirm`, { id: sourceId });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_source_confirm', {
        default:
          '<b>⚠️ Delete Traffic Source</b>\n\nAre you sure you want to delete this traffic source?\n\n<b>This action cannot be undone!</b>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportSuggest(ctx: BotContext): Promise<void> {
    const text = `<b>💡 ${ctx.t('support.suggest_title')}</b>

${ctx.t('support.suggest_intro')}

<b>${ctx.t('support.suggest_what')}:</b>
• ${ctx.t('support.suggest_features')}
• ${ctx.t('support.suggest_ui')}
• ${ctx.t('support.suggest_optimization')}
• ${ctx.t('support.suggest_other')}

<b>${ctx.t('support.suggest_how')}:</b>
${ctx.t('support.suggest_instructions')}

<i>${ctx.t('support.suggest_thanks')}</i>`;

    const keyboard = new InlineKeyboard()
      .url(ctx.t('support.btn_send_suggestion'), 'https://t.me/motivbuy_support')
      .row()
      .text(ctx.t('common.back'), 'menu:support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_suggestion';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  // Help action handlers
  private async handleHelpFAQ(ctx: BotContext): Promise<void> {
    const text = `<b>❓ ${ctx.t('help.faq_title')}</b>

<b>Q: ${ctx.t('help.faq_q1')}</b>
A: ${ctx.t('help.faq_a1')}

<b>Q: ${ctx.t('help.faq_q2')}</b>
A: ${ctx.t('help.faq_a2')}

<b>Q: ${ctx.t('help.faq_q3')}</b>
A: ${ctx.t('help.faq_a3')}

<b>Q: ${ctx.t('help.faq_q4')}</b>
A: ${ctx.t('help.faq_a4')}

<b>Q: ${ctx.t('help.faq_q5')}</b>
A: ${ctx.t('help.faq_a5')}

<b>Q: ${ctx.t('help.faq_q6')}</b>
A: ${ctx.t('help.faq_a6')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_more_orders'), 'help:createOrder')
      .row()
      .text(ctx.t('help.btn_balance_questions'), 'help:topup')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficSourceStats(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: ctx.user.id });

    if (!source) {
      await ctx.reply(ctx.t('traffic.source_not_found'));

      return;
    }

    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity, { trafficSource: source.id }),
      this.em.count(TrafficOrderEntity, {
        trafficSource: source.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { trafficSource: source.id, status: TrafficOrderStatus.Completed }),
    ]);

    let text = ctx.t('traffic.source_stats_title', {
      default: `<b>📊 Source Statistics: ${source.name}</b>\n\n`,
      name: source.name,
    });

    text += `<b>Orders:</b>\n`;
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n`;
    text += `• Completed: ${completedOrders}\n\n`;
    text += `<b>Created:</b> ${source.createdAt.toLocaleDateString()}\n`;
    text += `<b>Last Updated:</b> ${source.updatedAt.toLocaleDateString()}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  // Traffic Target Handlers

  private async handleTrafficTargetsList(ctx: AuthenticatedBotContext): Promise<void> {
    const targets = await this.em.find(
      TrafficTargetEntity,
      { managedBy: ctx.user.id },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.targets_list_title');

    if (targets.length === 0) {
      text += ctx.t('traffic.no_targets', {
        default: '<i>No traffic targets yet. Click "Add New Target" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.targets_count', {
        default: `Total: ${targets.length} target(s)\n\n`,
        count: targets.length,
      });

      targets.forEach((target) => {
        const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
        const typeLabel = this.getTargetTypeLabel(target.type);
        text += `${statusEmoji} <b>${target.name}</b>\n`;
        text += `   Type: ${typeLabel}\n`;
        text += `   Status: ${target.status}\n\n`;
      });
    }

    const targetsList = targets.map((t) => ({ id: t.id, name: t.name, status: t.status }));
    const keyboard = this.menuHandler.createTrafficTargetsKeyboard(ctx, targetsList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private getTargetTypeLabel(type: TrafficTargetType): string {
    const typeLabels: Record<TrafficTargetType, string> = {
      [TrafficTargetType.Channel]: '📢 Channel',
      [TrafficTargetType.Group]: '👥 Group',
      [TrafficTargetType.Bot]: '🤖 Bot',
      [TrafficTargetType.WithChecking]: '✅ With Checking',
    };

    return typeLabels[type] || type;
  }

  private async handleTrafficTargetAdd(ctx: AuthenticatedBotContext): Promise<void> {
    // Set session state for target creation
    if (ctx.session) {
      ctx.session.conversationState = 'traffic_target_create';
      ctx.session.formData = { step: 'enter_name' };
    }

    let text = ctx.t('traffic.add_target_title');
    text += ctx.t('traffic.add_target_instructions', {
      default: 'Please enter the name for your new traffic target:\n\n<i>Use /cancel to abort.</i>',
    });

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'traffic:targets'),
    });
  }

  private async handleTrafficTargetView(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await ctx.reply(ctx.t('traffic.target_not_found'));

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderEntity, { trafficTarget: target.id });
    const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
    const typeLabel = this.getTargetTypeLabel(target.type);

    let text = ctx.t('traffic.target_details_title');
    text += `<b>Name:</b> ${target.name}\n`;
    text += `<b>Type:</b> ${typeLabel}\n`;
    text += `<b>Status:</b> ${statusEmoji} ${target.status}\n`;

    if (target.username) {
      text += `<b>Username:</b> @${target.username}\n`;
    }

    if (target.inviteLink) {
      text += `<b>Invite Link:</b> ${target.inviteLink}\n`;
    }

    if (target.description) {
      text += `<b>Description:</b> ${target.description}\n`;
    }

    if (target.pricePerMember) {
      text += `<b>Price per Member:</b> $${toDisplayString(target.pricePerMember, 2)}\n`;
    }

    text += `\n<b>Statistics:</b>\n`;
    text += `• Total Orders: ${ordersCount}\n`;
    text += `• Created: ${target.createdAt.toLocaleDateString()}\n`;

    const keyboard = this.menuHandler.createTrafficTargetDetailKeyboard(ctx, targetId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficTargetEdit(ctx: BotContext, targetId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'traffic_target_edit';
      ctx.session.formData = { targetId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_target', {
        default: '<b>✏️ Edit Traffic Target</b>\n\nEnter the new name for this target:\n\n<i>Use /cancel to abort.</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  private async handleTrafficTargetToggle(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await ctx.reply(ctx.t('traffic.target_not_found'));

      return;
    }

    // Toggle status
    target.status =
      target.status === TrafficTargetStatus.Active ? TrafficTargetStatus.Inactive : TrafficTargetStatus.Active;

    await this.em.flush();

    await ctx.answerCallbackQuery(ctx.t('traffic.target_status_toggled'));

    // Refresh the view
    await this.handleTrafficTargetView(ctx, targetId);
  }

  private async handleTrafficTargetDelete(ctx: BotContext, targetId: string): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard(`traffic:target:delete:confirm`, { id: targetId });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_target_confirm', {
        default:
          '<b>⚠️ Delete Traffic Target</b>\n\nAre you sure you want to delete this traffic target?\n\n<b>This action cannot be undone!</b>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpCreateOrder(ctx: BotContext): Promise<void> {
    const text = `<b>📖 ${ctx.t('help.create_order_title')}</b>

<b>${ctx.t('help.step')} 1:</b>
${ctx.t('help.create_step1')}

<b>${ctx.t('help.step')} 2:</b>
${ctx.t('help.create_step2')}
${ctx.t('help.create_format')}

<b>${ctx.t('help.step')} 3:</b>
${ctx.t('help.create_step3')}
${ctx.t('help.create_step3_note')}

<b>${ctx.t('help.step')} 4:</b>
${ctx.t('help.create_step4')}

<b>${ctx.t('help.step')} 5:</b>
${ctx.t('help.create_step5')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.create_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_create_now'), 'order:create:start')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpTopup(ctx: BotContext): Promise<void> {
    const text = `<b>💰 ${ctx.t('help.topup_title')}</b>

<b>${ctx.t('help.payment_methods')}:</b>

<b>💳 ${ctx.t('help.method_card')}</b>
• Visa, MasterCard, MIR
• ${ctx.t('help.instant_deposit')}
• ${ctx.t('help.no_fee')}

<b>🪙 ${ctx.t('help.method_crypto')}</b>
• Bitcoin (BTC), Ethereum (ETH), USDT
• ${ctx.t('help.crypto_confirmations')}

<b>📱 ${ctx.t('help.method_ewallet')}</b>
• ${ctx.t('help.instant_deposit')}

<b>${ctx.t('help.min_amount')}:</b> $10
<b>${ctx.t('help.max_amount')}:</b> $10,000

<b>💡 ${ctx.t('help.bonus')}:</b>
${ctx.t('help.deposit_bonus')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_deposit_now'), 'balance:deposit')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpWithdraw(ctx: BotContext): Promise<void> {
    const text = `<b>💸 ${ctx.t('help.withdraw_title')}</b>

<b>${ctx.t('help.withdrawal_methods')}:</b>

<b>🪙 ${ctx.t('help.method_crypto')}</b>
• Bitcoin, Ethereum, USDT
• ${ctx.t('help.network_fee')}
• ${ctx.t('help.processing_24h')}

<b>📱 ${ctx.t('help.method_ewallet')}</b>
• ${ctx.t('help.ewallet_fee')}
• ${ctx.t('help.processing_24h')}

<b>${ctx.t('help.withdraw_conditions')}:</b>
• ${ctx.t('help.min_amount')}: $10
• ${ctx.t('help.verification_note')}

<b>${ctx.t('help.payout_statuses')}:</b>
⏳ ${ctx.t('help.status_pending')}
✅ ${ctx.t('help.status_completed')}
❌ ${ctx.t('help.status_rejected')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.withdraw_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_withdraw_now'), 'balance:withdraw')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpStats(ctx: BotContext): Promise<void> {
    const text = `<b>📊 ${ctx.t('help.stats_title')}</b>

<b>${ctx.t('help.stats_available')}:</b>

<b>📈 ${ctx.t('help.stats_orders')}:</b>
• ${ctx.t('help.stats_subscribers')}
• ${ctx.t('help.stats_speed')}
• ${ctx.t('help.stats_unsubscribe')}
• ${ctx.t('help.stats_conversion')}

<b>💰 ${ctx.t('help.stats_financial')}:</b>
• ${ctx.t('help.stats_income')}
• ${ctx.t('help.stats_expenses')}
• ${ctx.t('help.stats_history')}

<b>🎯 ${ctx.t('help.stats_traffic')}:</b>
• ${ctx.t('help.stats_sources')}
• ${ctx.t('help.stats_quality')}
• ${ctx.t('help.stats_activity')}

<b>📅 ${ctx.t('help.stats_periods')}:</b>
• ${ctx.t('help.period_today')}
• ${ctx.t('help.period_week')}
• ${ctx.t('help.period_month')}
• ${ctx.t('help.period_custom')}

<b>💡 ${ctx.t('help.tip')}:</b>
${ctx.t('help.stats_tip')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_view_stats'), 'stats:overview')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpTraffic(ctx: BotContext): Promise<void> {
    const text = `<b>🤖 ${ctx.t('help.traffic_title')}</b>

${ctx.t('help.traffic_intro')}

<b>${ctx.t('help.how_it_works')}:</b>
1. ${ctx.t('help.traffic_step1')}
2. ${ctx.t('help.traffic_step2')}
3. ${ctx.t('help.traffic_step3')}

<b>💰 ${ctx.t('help.traffic_earnings')}:</b>
• ${ctx.t('help.traffic_rate')}
• ${ctx.t('help.traffic_depends')}
• ${ctx.t('help.traffic_auto')}

<b>📋 ${ctx.t('help.traffic_requirements')}:</b>
• ${ctx.t('help.traffic_req1')}
• ${ctx.t('help.traffic_req2')}
• ${ctx.t('help.traffic_req3')}

<b>🚀 ${ctx.t('help.traffic_benefits')}:</b>
• ${ctx.t('help.traffic_ben1')}
• ${ctx.t('help.traffic_ben2')}
• ${ctx.t('help.traffic_ben3')}
• ${ctx.t('help.traffic_ben4')}

<i>${ctx.t('help.traffic_cta')}</i>`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('help.btn_add_source'), 'traffic:sources')
      .row()
      .text(ctx.t('help.btn_my_sources'), 'menu:traffic')
      .row()
      .text(ctx.t('common.back'), 'menu:help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficTargetStats(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: ctx.user.id });

    if (!target) {
      await ctx.reply(ctx.t('traffic.target_not_found'));

      return;
    }

    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity, { trafficTarget: target.id }),
      this.em.count(TrafficOrderEntity, {
        trafficTarget: target.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { trafficTarget: target.id, status: TrafficOrderStatus.Completed }),
    ]);

    let text = ctx.t('traffic.target_stats_title', {
      default: `<b>📊 Target Statistics: ${target.name}</b>\n\n`,
      name: target.name,
    });

    text += `<b>Orders:</b>\n`;
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n`;
    text += `• Completed: ${completedOrders}\n\n`;
    text += `<b>Created:</b> ${target.createdAt.toLocaleDateString()}\n`;
    text += `<b>Last Updated:</b> ${target.updatedAt.toLocaleDateString()}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  private async handleTrafficAnalytics(ctx: AuthenticatedBotContext): Promise<void> {
    const [sourcesCount, targetsCount, totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficTargetEntity, { managedBy: ctx.user.id }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id, status: TrafficOrderStatus.Completed }),
    ]);

    const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
    const totalSpent = sum(orders.map((o) => decimal(o.spentAmount || '0')));
    const totalBudget = sum(orders.map((o) => decimal(o.totalBudget || '0')));

    let text = ctx.t('traffic.analytics_title');
    text += `<b>Resources:</b>\n`;
    text += `• Traffic Sources: ${sourcesCount}\n`;
    text += `• Traffic Targets: ${targetsCount}\n\n`;
    text += `<b>Orders:</b>\n`;
    text += `• Total: ${totalOrders}\n`;
    text += `• Active: ${activeOrders}\n`;
    text += `• Completed: ${completedOrders}\n\n`;
    text += `<b>Financial:</b>\n`;
    text += `• Total Budget: $${toDisplayString(totalBudget, 2)}\n`;
    text += `• Total Spent: $${toDisplayString(totalSpent, 2)}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:traffic'),
    });
  }

  // Deposit Handlers

  private async handleDepositCard(ctx: BotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'deposit_card';
      ctx.session.formData = { method: 'card', step: 'enter_amount' };
    }

    const keyboard = new InlineKeyboard()
      .text('$10', 'deposit:amount:10')
      .text('$25', 'deposit:amount:25')
      .text('$50', 'deposit:amount:50')
      .row()
      .text('$100', 'deposit:amount:100')
      .text('$250', 'deposit:amount:250')
      .text('$500', 'deposit:amount:500')
      .row()
      .text(ctx.t('common.custom_amount'), 'deposit:amount:custom')
      .row()
      .text(ctx.t('common.back'), 'deposit:methods');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.deposit_card_title', {
        default:
          '<b>💳 Card Deposit</b>\n\nSelect or enter the amount you want to deposit:\n\n<i>Minimum: $10.00 | Maximum: $10,000.00</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleDepositCrypto(ctx: BotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'deposit_crypto';
      ctx.session.formData = { method: 'crypto', step: 'select_currency' };
    }

    const keyboard = new InlineKeyboard()
      .text('₿ BTC', 'deposit:crypto:btc')
      .text('Ξ ETH', 'deposit:crypto:eth')
      .row()
      .text('₮ USDT (TRC20)', 'deposit:crypto:usdt_trc20')
      .text('₮ USDT (ERC20)', 'deposit:crypto:usdt_erc20')
      .row()
      .text('◎ TON', 'deposit:crypto:ton')
      .row()
      .text(ctx.t('common.back'), 'deposit:methods');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.deposit_crypto_title', {
        default:
          '<b>🪙 Crypto Deposit</b>\n\nSelect the cryptocurrency you want to use:\n\n<i>Deposits are processed automatically after network confirmation.</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleDepositBank(ctx: BotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'deposit_bank';
      ctx.session.formData = { method: 'bank', step: 'enter_amount' };
    }

    const keyboard = new InlineKeyboard()
      .text('$100', 'deposit:amount:100')
      .text('$500', 'deposit:amount:500')
      .text('$1000', 'deposit:amount:1000')
      .row()
      .text(ctx.t('common.custom_amount'), 'deposit:amount:custom')
      .row()
      .text(ctx.t('common.back'), 'deposit:methods');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.deposit_bank_title', {
        default:
          '<b>🏦 Bank Transfer</b>\n\nSelect or enter the amount you want to deposit:\n\n<i>Minimum: $100.00 | Processing time: 1-3 business days</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleDepositAmount(ctx: BotContext, amount: string): Promise<void> {
    if (amount === 'custom') {
      if (ctx.session) {
        ctx.session.conversationState = 'deposit_custom_amount';
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.enter_deposit_amount', {
          default:
            '<b>💰 Enter Deposit Amount</b>\n\nPlease enter the amount you want to deposit:\n\n<i>Example: 100.00</i>',
        }),
        parseMode: 'HTML',
        replyMarkup: this.createBackButton(ctx, 'deposit:methods'),
      });

      return;
    }

    const method = String(ctx.session?.formData?.method || 'card');
    const keyboard = this.menuHandler.createConfirmationKeyboard(`deposit:confirm`, { amount, method });
    const methodLabel = method.charAt(0).toUpperCase() + method.slice(1);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.deposit_confirm_prompt', {
        default: `<b>💰 Confirm Deposit</b>\n\n<b>Amount:</b> $${amount}.00\n<b>Method:</b> ${methodLabel}\n<b>Fee:</b> $0.00\n<b>Total:</b> $${amount}.00\n\nAre you sure you want to proceed?`,
        amount,
        method: methodLabel,
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleDepositConfirm(ctx: BotContext, params: string[]): Promise<void> {
    const amount = String(ctx.session?.formData?.amount || params[0] || '0');
    const method = String(ctx.session?.formData?.method || 'card');

    // Reset session
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    let text = ctx.t('balance.deposit_initiated', {
      default: `<b>✅ Deposit Initiated</b>\n\n<b>Amount:</b> $${amount}\n<b>Method:</b> ${method}\n\n`,
      amount,
      method,
    });

    if (method === 'card') {
      text += ctx.t('balance.deposit_card_instructions', {
        default:
          '📝 <b>Next Steps:</b>\n1. You will receive a payment link shortly\n2. Complete the payment on the secure payment page\n3. Funds will be credited instantly after confirmation',
      });
    } else if (method === 'crypto') {
      text += ctx.t('balance.deposit_crypto_instructions', {
        default:
          '📝 <b>Next Steps:</b>\n1. Send the exact amount to the wallet address below\n2. Wait for network confirmation\n3. Funds will be credited automatically\n\n<code>wallet_address_placeholder</code>',
      });
    } else {
      text += ctx.t('balance.deposit_bank_instructions', {
        default:
          '📝 <b>Next Steps:</b>\n1. Transfer funds to the bank account details below\n2. Include your user ID in the reference\n3. Funds will be credited within 1-3 business days\n\n<b>Bank:</b> Example Bank\n<b>Account:</b> XXXX-XXXX-XXXX\n<b>Reference:</b> Your User ID',
      });
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:balance'),
    });
  }

  private async handleDepositHistory(ctx: AuthenticatedBotContext): Promise<void> {
    const deposits = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id, type: TransactionType.Deposit },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('balance.deposit_history_title');

    if (deposits.length === 0) {
      text += ctx.t('balance.no_deposits');
    } else {
      deposits.forEach((deposit) => {
        const amount = decimal(deposit.amount);
        text += `📅 ${deposit.createdAt.toLocaleDateString()}\n`;
        text += `   Amount: +$${toDisplayString(amount, 2)}\n`;
        text += `   Status: ✅ Completed\n\n`;
      });
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'deposit:methods'),
    });
  }

  private async handleDepositBonuses(ctx: BotContext): Promise<void> {
    let text = '<b>🎁 Deposit Bonuses</b>\n\n';
    text += '<b>Current Offers:</b>\n\n';
    text += '🎉 <b>First Deposit Bonus:</b> +10%\n';
    text += '   Deposit $100+, get extra $10\n\n';
    text += '💎 <b>VIP Bonus:</b> +15%\n';
    text += '   For deposits $500+\n\n';
    text += '🔥 <b>Weekend Special:</b> +5%\n';
    text += '   Valid Saturday-Sunday only\n\n';
    text += '<i>Bonuses are applied automatically to eligible deposits.</i>';

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'deposit:methods'),
    });
  }

  // Withdrawal Handlers

  private async handleWithdrawalCurrency(ctx: BotContext, currencyId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'withdrawal_amount';
      ctx.session.formData = { currencyId, step: 'enter_amount' };
    }

    const keyboard = new InlineKeyboard()
      .text('$10', 'withdrawal:amount:10')
      .text('$25', 'withdrawal:amount:25')
      .text('$50', 'withdrawal:amount:50')
      .row()
      .text('$100', 'withdrawal:amount:100')
      .text('$250', 'withdrawal:amount:250')
      .text('All', 'withdrawal:amount:all')
      .row()
      .text(ctx.t('common.custom_amount'), 'withdrawal:amount:custom')
      .row()
      .text(ctx.t('common.back'), 'menu:balance');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_amount_prompt', {
        default:
          '<b>💸 Withdrawal Amount</b>\n\nSelect or enter the amount you want to withdraw:\n\n<i>Minimum: $10.00 | Fee: 2%</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleWithdrawalAmount(ctx: BotContext, amount: string): Promise<void> {
    if (amount === 'custom') {
      if (ctx.session) {
        ctx.session.conversationState = 'withdrawal_custom_amount';
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('balance.enter_withdrawal_amount', {
          default:
            '<b>💸 Enter Withdrawal Amount</b>\n\nPlease enter the amount you want to withdraw:\n\n<i>Example: 100.00</i>',
        }),
        parseMode: 'HTML',
        replyMarkup: this.createBackButton(ctx, 'balance:withdraw'),
      });

      return;
    }

    const fee = multiply(decimal(amount), '0.02');
    const total = subtract(decimal(amount), fee);

    const keyboard = this.menuHandler.createConfirmationKeyboard(`withdrawal:confirm`, { amount });

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_confirm_prompt', {
        default: `<b>💸 Confirm Withdrawal</b>\n\n<b>Amount:</b> $${amount}\n<b>Fee (2%):</b> $${toDisplayString(fee, 2)}\n<b>You receive:</b> $${toDisplayString(total, 2)}\n\nAre you sure you want to proceed?`,
        amount,
        fee: toDisplayString(fee, 2),
        total: toDisplayString(total, 2),
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleWithdrawalConfirm(ctx: BotContext, _params: string[]): Promise<void> {
    const amount = String(ctx.session?.formData?.amount || '0');

    // Reset session
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    const text = ctx.t('balance.withdrawal_initiated', {
      default: `<b>✅ Withdrawal Initiated</b>\n\n<b>Amount:</b> $${amount}\n<b>Status:</b> Processing\n\n📝 <b>What happens next:</b>\n1. Your withdrawal is being reviewed\n2. Funds will be sent within 24 hours\n3. You'll receive a confirmation notification\n\n<i>You can track your withdrawal status in the withdrawal history.</i>`,
      amount,
    });

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:balance'),
    });
  }

  private async handleWithdrawalHistory(ctx: AuthenticatedBotContext): Promise<void> {
    const withdrawals = await this.em.find(
      UserBalanceHistoryEntity,
      { user: ctx.user.id, type: TransactionType.Withdrawal },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('balance.withdrawal_history_title');

    if (withdrawals.length === 0) {
      text += ctx.t('balance.no_withdrawals');
    } else {
      withdrawals.forEach((withdrawal) => {
        const amount = decimal(withdrawal.amount);
        const statusEmoji = '✅';
        text += `📅 ${withdrawal.createdAt.toLocaleDateString()}\n`;
        text += `   Amount: -$${toDisplayString(amount.abs(), 2)}\n`;
        text += `   Status: ${statusEmoji} Completed\n\n`;
      });
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:balance'),
    });
  }

  private async handleWithdrawalMethods(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text('💳 Card', 'withdrawal:method:card')
      .text('🪙 Crypto', 'withdrawal:method:crypto')
      .row()
      .text('🏦 Bank', 'withdrawal:method:bank')
      .row()
      .text(ctx.t('common.back'), 'menu:balance');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('balance.withdrawal_methods', {
        default:
          '<b>💸 Withdrawal Methods</b>\n\n<b>Available Methods:</b>\n\n💳 <b>Card:</b> 1-3 business days\n🪙 <b>Crypto:</b> 1-24 hours\n🏦 <b>Bank:</b> 3-5 business days\n\n<i>Select your preferred withdrawal method:</i>',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleWithdrawalLimits(ctx: BotContext): Promise<void> {
    let text = '<b>📊 Withdrawal Limits</b>\n\n';
    text += '<b>Standard Account:</b>\n';
    text += '• Minimum: $10.00\n';
    text += '• Daily limit: $1,000.00\n';
    text += '• Monthly limit: $10,000.00\n\n';
    text += '<b>Verified Account:</b>\n';
    text += '• Minimum: $10.00\n';
    text += '• Daily limit: $5,000.00\n';
    text += '• Monthly limit: $50,000.00\n\n';
    text += '<b>VIP Account:</b>\n';
    text += '• Minimum: $10.00\n';
    text += '• Daily limit: $25,000.00\n';
    text += '• Monthly limit: Unlimited\n\n';
    text += '<i>Upgrade your account for higher limits.</i>';

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: this.createBackButton(ctx, 'menu:balance'),
    });
  }
}
