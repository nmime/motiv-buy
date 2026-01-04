/**
 * Callback Router Handler
 *
 * Routes callback queries to appropriate action handlers.
 * Provides centralized routing logic for all menu and action callbacks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { AuthenticatedBotContext, BotContext, isAuthenticated } from '@app/feature-bot-shared';
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
import {
  BalanceRoutingHandler,
  MenuRoutingHandler,
  OrderRoutingHandler,
  SettingsRoutingHandler,
  TrafficRoutingHandler,
} from './routing';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { MessageService } from '../service/message.service';

type ActionHandler = (ctx: BotContext, _action: string, _params: string[]) => Promise<void>;

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);
  private primaryActionHandlers!: Map<string, ActionHandler>;

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
    private readonly trafficRoutingHandler: TrafficRoutingHandler,
    private readonly balanceRoutingHandler: BalanceRoutingHandler,
    private readonly orderRoutingHandler: OrderRoutingHandler,
    private readonly settingsRoutingHandler: SettingsRoutingHandler,
    private readonly menuRoutingHandler: MenuRoutingHandler,
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
      ['menu', (ctx, action, params) => this.menuRoutingHandler.routeMenuAction(ctx, action, params)],
      ['profile', (ctx, action, params) => this.menuRoutingHandler.routeProfileAction(ctx, action, params)],
      ['balance', (ctx, action, params) => this.balanceRoutingHandler.routeBalanceAction(ctx, action, params)],
      ['stats', (ctx, action, params) => this.menuRoutingHandler.routeStatisticsAction(ctx, action, params)],
      ['orders', (ctx, action, params) => this.orderRoutingHandler.routeOrderAction(ctx, action, params)],
      ['order', (ctx, action, params) => this.orderRoutingHandler.routeOrderAction(ctx, action, params)],
      ['settings', (ctx, action, params) => this.settingsRoutingHandler.routeSettingsAction(ctx, action, params)],
      ['referral', this.routeReferralAction.bind(this)],
      ['payment', this.routePaymentAction.bind(this)],
      ['deposit', (ctx, action, params) => this.balanceRoutingHandler.routeDepositAction(ctx, action, params)],
      ['withdraw', (ctx, action, params) => this.balanceRoutingHandler.routeWithdrawalAction(ctx, action, params)],
      ['withdrawal', (ctx, action, params) => this.balanceRoutingHandler.routeWithdrawalAction(ctx, action, params)],
      ['traffic', (ctx, action, params) => this.trafficRoutingHandler.routeTrafficAction(ctx, action, params)],
      ['traf', (ctx, action, params) => this.trafficRoutingHandler.routeTrafficShortAction(ctx, action, params)], // Shortened traffic callbacks (64-byte limit workaround)
      ['buy', (ctx, action, params) => this.trafficRoutingHandler.routeBuyAction(ctx, action, params)], // Buy traffic targets
      // Moderation routing is handled at app layer (apps/bot) to avoid circular dependencies
      // See apps/bot/src/handler/moderation-callback.handler.ts
      ['support', this.routeSupportAction.bind(this)],
      ['help', this.routeHelpAction.bind(this)],
      ['faq', this.routeFAQAction.bind(this)],
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

    // Menu, profile, and stats action handlers moved to MenuRoutingHandler
    // Balance action handlers moved to BalanceRoutingHandler
    // Order action handlers moved to OrderRoutingHandler
    // Settings action handlers moved to SettingsRoutingHandler
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
   * Route FAQ category actions
   */
  private async routeFAQAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    // Handle category navigation: faq:cat:start, faq:cat:orders, etc.
    if (action === 'cat') {
      const category = params[0] || 'start';
      const categoryHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
        start: (ctx) => this.supportHandler.handleFAQStart(ctx),
        orders: (ctx) => this.supportHandler.handleFAQOrders(ctx),
        balance: (ctx) => this.supportHandler.handleFAQBalance(ctx),
        traffic: (ctx) => this.supportHandler.handleFAQTraffic(ctx),
        technical: (ctx) => this.supportHandler.handleFAQTechnical(ctx),
      };

      const handler = categoryHandlers[category];
      if (handler) {
        await handler(ctx);
      } else {
        await this.supportHandler.handleFAQ(ctx);
      }
    } else {
      await this.supportHandler.handleFAQ(ctx);
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
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.authentication_required') });

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
      buyTargetCreate: async () => {
        await this.trafficHandler.handleBuyTrafficTargetCreateInput(ctx, messageText);
      },
      orderCreate: async () => {
        await this.orderHandler.handleOrderCreateInput(ctx, messageText);
      },
      orderEdit: async () => {
        await this.orderHandler.handleOrderEditInput(ctx, messageText);
      },
      depositAmount: async () => {
        await this.balanceHandler.handleDepositAmount(ctx, messageText);
      },
    };

    const handler = conversationHandlers[conversationState];
    if (handler) {
      await handler();
    }
  }
}
