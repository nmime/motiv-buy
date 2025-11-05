/**
 * Callback Router Handler
 *
 * Routes callback queries to appropriate action handlers.
 * Provides centralized routing logic for all menu and action callbacks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { MenuActionHandler } from './menu-action.handler';
import { ProfileActionHandler } from './profile-action.handler';
import { BalanceActionHandler } from './balance-action.handler';
import { StatisticsActionHandler } from './statistics-action.handler';
import { OrderActionHandler } from './order-action.handler';
import { SettingsActionHandler } from './settings-action.handler';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { MessageService } from '../service/message.service';

type ActionHandler = (ctx: BotContext, action: string, params: string[]) => Promise<void>;

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);
  private primaryActionHandlers!: Map<string, ActionHandler>;
  private menuActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private profileActionHandlers!: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;
  private balanceActionHandlers!: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;
  private statsActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private orderActionHandlers!: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;
  private settingsActionHandlers!: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;

  constructor(
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
      ['profile', async (ctx) => this.profileHandler.handleProfileView(ctx)],
      ['balance', async (ctx) => this.balanceHandler.handleBalanceView(ctx)],
      ['statistics', async (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx)],
      ['orders', this.handleOrdersMenu.bind(this)],
      ['settings', async (ctx) => this.settingsHandler.handleSettingsView(ctx)],
      ['referrals', this.handleReferralsMenu.bind(this)],
      ['referral', this.handleReferralsMenu.bind(this)],
      ['payments', this.handlePaymentsMenu.bind(this)],
      ['support', this.handleSupportMenu.bind(this)],
      ['help', this.handleHelpMenu.bind(this)],
      [
        'traffic',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('menu.traffic_coming_soon'),
          });
        },
      ],
      [
        'campaign',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('menu.campaign_coming_soon'),
          });
        },
      ],
      ['withdrawal', async (ctx) => this.balanceHandler.handleWithdrawalStart(ctx)],
      ['notifications', async (ctx) => this.settingsHandler.handleNotificationSettings(ctx)],
    ]);

    this.profileActionHandlers = new Map([
      ['view', async (ctx) => this.profileHandler.handleProfileView(ctx)],
      [
        'edit',
        async (ctx, params) => {
          if (params.length > 0) {
            await ctx.reply(ctx.t('profile.enter_new_field', { field: params[0] }));
            if (ctx.session) {
              ctx.session.conversationState = 'profile_edit_field';
              ctx.session.formData = { field: params[0] };
            }
          } else {
            await this.profileHandler.handleProfileEditStart(ctx);
          }
        },
      ],
      ['details', async (ctx) => this.profileHandler.handleProfileDetails(ctx)],
      ['verify', async (ctx) => this.profileHandler.handleVerification(ctx)],
      [
        'stats',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('profile.stats_coming_soon'),
          });
        },
      ],
      [
        'security',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('profile.security_coming_soon'),
          });
        },
      ],
      [
        'password',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('profile.password_change_coming_soon'),
          });
        },
      ],
      [
        'email_security',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('profile.email_security_coming_soon'),
          });
        },
      ],
      [
        'login_history',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('profile.login_history_coming_soon'),
          });
        },
      ],
    ]);

    this.balanceActionHandlers = new Map([
      ['view', async (ctx) => this.balanceHandler.handleBalanceView(ctx)],
      ['current', async (ctx) => this.balanceHandler.handleBalanceView(ctx)],
      [
        'history',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.balanceHandler.handleTransactionHistory(ctx, page);
        },
      ],
      [
        'analytics',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('balance.analytics_coming_soon'),
          });
        },
      ],
      ['withdraw', async (ctx) => this.balanceHandler.handleWithdrawalStart(ctx)],
      ['deposit', async (ctx) => this.balanceHandler.handleDepositStart(ctx)],
      ['topup', async (ctx) => this.balanceHandler.handleDepositStart(ctx)],
    ]);

    this.statsActionHandlers = new Map([
      ['overview', async (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx)],
      ['detailed', async (ctx) => this.statisticsHandler.handleDetailedStatistics(ctx)],
      ['traffic', async (ctx) => this.statisticsHandler.handleTrafficStatistics(ctx)],
      ['earnings', async (ctx) => this.statisticsHandler.handleEarningsStatistics(ctx)],
    ]);

    this.orderActionHandlers = new Map([
      ['list', this.handleOrdersMenu.bind(this)],
      [
        'active',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleActiveOrders(ctx, page);
        },
      ],
      [
        'completed',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleCompletedOrders(ctx, page);
        },
      ],
      [
        'create',
        async (ctx, params) => {
          if (params.length > 0 && params[0] === 'start') {
            await this.orderHandler.handleCreateOrderStart(ctx);
          } else if (params.length > 0 && params[0] === 'back') {
            await this.handleOrdersMenu(ctx);
          } else {
            await this.orderHandler.handleCreateOrderStart(ctx);
          }
        },
      ],
      ['search', async (ctx) => this.orderHandler.handleOrderSearch(ctx)],
      [
        'details',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        },
      ],
      [
        'view',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        },
      ],
      [
        'deleted',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.deleted_coming_soon'),
          });
        },
      ],
      [
        'config',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.config_coming_soon'),
          });
        },
      ],
      [
        'edit',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.edit_coming_soon'),
          });
        },
      ],
      [
        'toggle',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.toggle_coming_soon'),
          });
        },
      ],
      [
        'delete',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.delete_coming_soon'),
          });
        },
      ],
      [
        'download',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.download_coming_soon'),
          });
        },
      ],
      [
        'help',
        async (ctx, params) => {
          await this.handleHelpMenu(ctx);
        },
      ],
      [
        'bot',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.bot_management_coming_soon'),
          });
        },
      ],
      [
        'audience',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.audience_targeting_coming_soon'),
          });
        },
      ],
      [
        'gender',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.gender_selection_coming_soon'),
          });
        },
      ],
      [
        'topic',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.topic_selection_coming_soon'),
          });
        },
      ],
      [
        'location',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.location_selection_coming_soon'),
          });
        },
      ],
      [
        'refresh',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stats_refreshed'),
          });
        },
      ],
      [
        'stats',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stats_coming_soon'),
          });
        },
      ],
      [
        'duplicate',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.duplicate_coming_soon'),
          });
        },
      ],
      [
        'integration',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.integration_coming_soon'),
          });
        },
      ],
      [
        'transfer',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.transfer_coming_soon'),
          });
        },
      ],
      [
        'stop',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stopped'),
          });
        },
      ],
      [
        'view_channel',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.channel_view_coming_soon'),
          });
        },
      ],
      [
        'type',
        async (ctx, params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.type_selection_coming_soon'),
          });
        },
      ],
    ]);

    this.settingsActionHandlers = new Map([
      [
        'language',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          } else {
            await this.settingsHandler.handleLanguageSettings(ctx);
          }
        },
      ],
      [
        'lang',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          }
        },
      ],
      ['notifications', async (ctx) => this.settingsHandler.handleNotificationSettings(ctx)],
      [
        'notify',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleNotificationToggle(ctx, params[0]);
          }
        },
      ],
      ['preferences', async (ctx) => this.settingsHandler.handlePreferencesSettings(ctx)],
      [
        'privacy',
        async (ctx, params) => {
          if (params.length > 0 && params[0]) {
            await this.messageService.sendOrEditMessage(ctx, {
              text: ctx.t('settings.privacy_toggle_coming_soon'),
            });
          } else {
            await this.settingsHandler.handlePrivacySettings(ctx);
          }
        },
      ],
      [
        'theme',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('settings.theme_coming_soon'),
          });
        },
      ],
      [
        'export',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('settings.export_coming_soon'),
          });
        },
      ],
      [
        'reset',
        async (ctx) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('settings.reset_coming_soon'),
          });
        },
      ],
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

      // Parse callback data
      const menuAction = this.menuHandler.parseCallbackData(data);
      const [primaryAction, secondaryAction, ...params] = menuAction.action.split(':');

      this.logger.debug('Routing callback', {
        userId: ctx.from?.id,
        action: menuAction.action,
        params: menuAction.params,
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
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Route menu actions
   */
  private async routeMenuAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.menuActionHandlers.get(action);

    if (handler) {
      await handler(ctx);
    } else {
      this.logger.warn('Unknown menu action', { action });
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.unknown_menu_action'),
      });
    }
  }

  /**
   * Route profile actions
   */
  private async routeProfileAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.profileActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.profileHandler.handleProfileView(ctx);
    }
  }

  /**
   * Route balance actions
   */
  private async routeBalanceAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.balanceActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.balanceHandler.handleBalanceView(ctx);
    }
  }

  /**
   * Route statistics actions
   */
  private async routeStatisticsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.statsActionHandlers.get(action || 'overview');

    if (handler) {
      await handler(ctx);
    } else {
      await this.statisticsHandler.handleStatisticsOverview(ctx);
    }
  }

  /**
   * Route order actions
   */
  private async routeOrderAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.orderActionHandlers.get(action || 'list');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.handleOrdersMenu(ctx);
    }
  }

  /**
   * Route settings actions
   */
  private async routeSettingsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.settingsActionHandlers.get(action);

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.settingsHandler.handleSettingsView(ctx);
    }
  }

  /**
   * Route referral actions
   */
  private async routeReferralAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('referral.coming_soon'),
    });
  }

  /**
   * Route payment actions
   */
  private async routePaymentAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('payment.coming_soon'),
    });
  }

  /**
   * Route deposit actions
   */
  private async routeDepositAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('deposit.coming_soon'),
    });
  }

  /**
   * Route withdrawal actions
   */
  private async routeWithdrawalAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('withdrawal.coming_soon'),
    });
  }

  /**
   * Route traffic actions
   */
  private async routeTrafficAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.coming_soon'),
    });
  }

  /**
   * Route support actions
   */
  private async routeSupportAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.handleSupportMenu(ctx);
  }

  /**
   * Handle noop actions (pagination indicators, etc)
   */
  private async handleNoopAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    // Do nothing - these are UI-only elements
  }

  /**
   * Route help actions
   */
  private async routeHelpAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.handleHelpMenu(ctx);
  }

  /**
   * Route campaign actions
   */
  private async routeCampaignAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('campaign.coming_soon'),
    });
  }

  /**
   * Route admin actions
   */
  private async routeAdminAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('admin.coming_soon'),
    });
  }

  /**
   * Route auth actions
   */
  private async routeAuthAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('auth.coming_soon'),
    });
  }

  /**
   * Route verify actions
   */
  private async routeVerifyAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('verify.coming_soon'),
    });
  }

  /**
   * Route export actions
   */
  private async routeExportAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('export.coming_soon'),
    });
  }

  /**
   * Route reset actions
   */
  private async routeResetAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('reset.coming_soon'),
    });
  }

  /**
   * Route status actions
   */
  private async routeStatusAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('status.coming_soon'),
    });
  }

  /**
   * Route command actions
   */
  private async routeCommandAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('command.coming_soon'),
    });
  }

  // Placeholder methods for additional features

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createMainMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.main'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleOrdersMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createOrdersMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.orders'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleReferralsMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createReferralsMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.referrals'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handlePaymentsMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createPaymentsMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.payments'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportMenu(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.support'),
      parseMode: 'HTML',
    });
  }

  private async handleHelpMenu(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.help'),
      parseMode: 'HTML',
    });
  }
}
