import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import {
  BotContext,
  MenuActionResult,
  MenuButton,
  MenuConfig,
  MenuNavigation,
  MenuType,
} from '@app/feature-bot-shared';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { StatisticService } from '@app/feature-statistic-main';
import { UserStatus } from '@app/database';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { MessageService } from '../service/message.service';
import { InlineKeyboard } from 'grammy';
import { PaymentConfigService } from '@app/feature-payment-shared';

/**
 * Menu Handler
 *
 * Handles menu interactions, navigation state management, and dynamic
 * menu content generation. Processes menu button presses and manages
 * navigation history with breadcrumbs.
 *
 * @class MenuHandler
 */
@Injectable()
export class MenuHandler {
  private readonly logger = new Logger(MenuHandler.name);
  private readonly maxBreadcrumbLength = 5;

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
    private readonly userService: UserService,
    private readonly statisticService: StatisticService,
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
    private readonly messageService: MessageService,
    private readonly paymentConfigService: PaymentConfigService,
  ) {}

  private get currencySymbol(): string {
    return this.paymentConfigService.getBaseCurrencySymbol();
  }

  /**
   * Handle menu navigation request
   *
   * @param ctx - Bot context
   * @param menuType - Target menu type
   * @param options - Navigation options
   * @returns Promise<void>
   */
  async navigateToMenu(
    ctx: BotContext,
    menuType: MenuType,
    options?: {
      updateHistory?: boolean;
      clearBreadcrumb?: boolean;
      customData?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      this.logger.debug(`Navigating to menu: ${menuType}`, {
        userId: ctx.from?.id,
        menuType,
        options,
      });

      if (!ctx.from?.id) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('auth.authentication_required') });

        return;
      }

      const userId = ctx.from.id.toString();

      // Update navigation state
      await this.updateNavigationState(userId, menuType, options);

      // Generate dynamic menu content
      const menuConfig = await this.generateDynamicMenu(ctx, menuType);

      // Create inline keyboard
      const keyboard = this.createInlineKeyboard(menuConfig.buttons);

      // Format menu text with personalization
      const menuText = await this.formatMenuText(ctx, menuConfig);

      // Send or edit message with menu
      await this.sendMenuMessage(ctx, menuText, keyboard, menuConfig);

      this.logger.debug(`Successfully navigated to menu: ${menuType}`, {
        userId,
        menuType,
      });
    } catch (err: unknown) {
      this.logger.error(`Error navigating to menu: ${menuType}`, {
        error: unknownToError(err),
        userId: ctx.from?.id,
        menuType,
      });

      await this.handleMenuError(ctx, err as Error, menuType);
    }
  }

  /**
   * Handle menu action (button press)
   *
   * @param ctx - Bot context with callback query
   * @param callbackData - Callback data from button press
   * @returns Promise<void>
   */
  async handleMenuAction(ctx: BotContext, callbackData: string): Promise<void> {
    try {
      this.logger.debug(`Handling menu action: ${callbackData}`, {
        userId: ctx.from?.id,
        callbackData,
      });

      if (!ctx.from?.id) {
        await this.messageService.sendNewMessage(ctx, { text: ctx.t('auth.authentication_required') });

        return;
      }

      const userId = ctx.from.id.toString();
      const [action, ...params] = callbackData.split(':');

      // Process menu action
      const actionResult = await this.processMenuAction(ctx, action, params);

      // Handle action result
      if (actionResult.success) {
        if (actionResult.nextMenu) {
          await this.navigateToMenu(ctx, actionResult.nextMenu);
        }

        if (actionResult.message) {
          await this.messageService.sendNewMessage(ctx, { text: actionResult.message });
        }

        if (actionResult.closeMenu) {
          // Close inline keyboard by editing message
          try {
            await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
          } catch {
            // Ignore edit errors for old messages
            this.logger.debug('Could not close menu - message too old or already edited');
          }
        }

        // Handle custom action data
        if (actionResult.data) {
          await this.handleActionData(ctx, actionResult.data);
        }
      } else {
        const keyboard = new InlineKeyboard().text(ctx.t('menu.buttons.main_menu'), 'menu:main');
        await this.messageService.sendNewMessage(ctx, {
          text: actionResult.message || ctx.t('menu.errors.action_failed'),
          replyMarkup: keyboard,
        });
      }

      // Update session with action activity
      await this.updateSessionActivity(userId, action, params);
    } catch (err: unknown) {
      this.logger.error(`Error handling menu action: ${callbackData}`, {
        error: unknownToError(err),
        userId: ctx.from?.id,
        callbackData,
      });

      await this.handleActionError(ctx, err as Error, callbackData);
    }
  }

  /**
   * Get user's menu navigation state
   *
   * @param userId - User identifier
   * @returns Promise<MenuNavigation | null>
   */
  async getMenuNavigation(userId: string): Promise<MenuNavigation | null> {
    try {
      const session = await this.sessionService.getSession(userId);
      if (!session?.data.navigationState) {
        return null;
      }

      const navState = session.data.navigationState;

      return {
        currentMenu: navState.currentLocation as MenuType,
        history: (navState.history as MenuType[]) || [],
        maxHistoryLength: this.maxBreadcrumbLength,
        canGoBack: (navState.history as MenuType[])?.length > 0,
      };
    } catch (err: unknown) {
      this.logger.error(`Error getting menu navigation for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      return null;
    }
  }

  /**
   * Navigate back to previous menu
   *
   * @param ctx - Bot context
   * @returns Promise<void>
   */
  async goBack(ctx: BotContext): Promise<void> {
    if (!ctx.from?.id) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('auth.authentication_required') });

      return;
    }

    const userId = ctx.from.id.toString();
    const navigation = await this.getMenuNavigation(userId);

    if (!navigation || !navigation.canGoBack || navigation.history.length === 0) {
      await this.navigateToMenu(ctx, MenuType.Main);

      return;
    }

    // Get previous menu from history
    const previousMenu = navigation.history[navigation.history.length - 1];

    // Remove the last item from history
    const updatedHistory = navigation.history.slice(0, -1);

    // Update session with new navigation state
    await this.sessionService.updateSession(userId, {
      navigationState: {
        currentLocation: previousMenu,
        history: updatedHistory,
        breadcrumb: updatedHistory.concat(previousMenu),
        metadata: {
          navigatedBackAt: new Date().toISOString(),
        },
      },
    });

    await this.navigateToMenu(ctx, previousMenu, { updateHistory: false });
  }

  /**
   * Clear navigation history
   *
   * @param userId - User identifier
   * @returns Promise<void>
   */
  async clearNavigationHistory(userId: string): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        navigationState: {
          currentLocation: MenuType.Main,
          history: [],
          breadcrumb: [],
          metadata: {
            clearedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.debug(`Navigation history cleared for user: ${userId}`);
    } catch (err: unknown) {
      this.logger.error(`Error clearing navigation history for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });
    }
  }

  // Private helper methods

  /**
   * Generate dynamic menu content based on user data and context
   */
  private async generateDynamicMenu(ctx: BotContext, menuType: MenuType): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();

    try {
      // Get base menu config
      const baseConfig = this.menuService.generateMenu(menuType, ctx);

      // Enhance with dynamic data using object lookup
      const menuEnhancers: Record<MenuType, (ctx: BotContext, config: MenuConfig) => Promise<MenuConfig>> = {
        [MenuType.Main]: (ctx, config) => this.enhanceMainMenu(ctx, config),
        [MenuType.Balance]: (ctx, config) => this.enhanceBalanceMenu(ctx, config),
        [MenuType.Profile]: (ctx, config) => this.enhanceProfileMenu(ctx, config),
        [MenuType.Statistics]: (ctx, config) => this.enhanceStatisticsMenu(ctx, config),
        [MenuType.Traffic]: (ctx, config) => this.enhanceTrafficMenu(ctx, config),
        [MenuType.Settings]: (ctx, config) => this.enhanceSettingsMenu(ctx, config),
        [MenuType.Help]: async (_ctx, config) => config,
        [MenuType.Campaign]: async (_ctx, config) => config,
        [MenuType.Withdrawal]: async (_ctx, config) => config,
        [MenuType.Referral]: async (_ctx, config) => config,
        [MenuType.Admin]: async (_ctx, config) => config,
        [MenuType.Notifications]: async (_ctx, config) => config,
        [MenuType.Verification]: async (_ctx, config) => config,
        [MenuType.Auth]: async (_ctx, config) => config,
        [MenuType.Error]: async (_ctx, config) => config,
      };

      const enhancer = menuEnhancers[menuType];

      return enhancer ? await enhancer(ctx, baseConfig) : baseConfig;
    } catch (err: unknown) {
      this.logger.error('Error generating dynamic menu content', {
        error: unknownToError(err),
        userId,
        menuType,
      });

      // Return basic menu on error
      return this.menuService.generateMenu(menuType, ctx);
    }
  }

  /**
   * Enhance main menu with user-specific data
   */
  private async enhanceMainMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        return baseConfig;
      }

      const balance = await this.balanceService.getBalance(user.id);

      /**
       * FUTURE: Notification System Integration
       *
       * DEFERRED: Notification service integration pending notification schema
       *
       * Implementation plan:
       * 1. Create notification service with unread count method
       * 2. Add notification_preferences table
       * 3. Implement real-time notification delivery via WebSocket
       * 4. Add notification queue processing with Bull
       * 5. Create notification templates for different event types
       *
       * Current: Always shows no notifications (false)
       */
      const hasNotifications = false;

      // Update title with balance info
      const enhancedTitle = `${baseConfig.title}\n💰 Balance: ${this.currencySymbol}${balance.availableAmount.toFixed(2)}${hasNotifications ? '\n🔔 New notifications' : ''}`;

      return {
        ...baseConfig,
        title: enhancedTitle,
        metadata: {
          ...baseConfig.metadata,
          userBalance: balance.availableAmount,
          hasNotifications,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing main menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Enhance balance menu with transaction data
   */
  private async enhanceBalanceMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        return baseConfig;
      }

      const balance = await this.balanceService.getBalance(user.id);

      // Update description with current balance info
      const symbol = this.currencySymbol;
      const enhancedDescription = `
Current Balance: ${symbol}${balance.availableAmount.toFixed(2)}
Total Earned: ${symbol}${balance.totalEarned.toFixed(2)}
Pending: ${symbol}${balance.pendingAmount.toFixed(2)}

Last updated: ${new Date().toLocaleTimeString()}
`;

      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          balance,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing balance menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Enhance profile menu with user data
   */
  private async enhanceProfileMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        return baseConfig;
      }

      const enhancedDescription = `
Name: ${user.firstName} ${user.lastName || ''}
Username: ${user.username || 'Not set'}
Status: ${user.status === UserStatus.Active ? '✅ Active' : '❌ Inactive'}
Member since: ${this.messageService.formatDate(ctx, user.createdAt)}
`;

      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          user,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing profile menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Enhance statistics menu with quick stats
   */
  private async enhanceStatisticsMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        return baseConfig;
      }

      // Get basic statistics (implement these methods in StatisticService)
      const todayStats = {
        clicks: 0,
        conversions: 0,
        earnings: 0,
      };

      const enhancedDescription = `
📊 Today's Performance:
• Clicks: ${todayStats.clicks}
• Conversions: ${todayStats.conversions}
• Earnings: ${this.currencySymbol}${todayStats.earnings.toFixed(2)}

Last updated: ${new Date().toLocaleTimeString()}
`;

      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          todayStats,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing statistics menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Enhance traffic menu with source information
   */
  private async enhanceTrafficMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) {
        return baseConfig;
      }

      // Get traffic source count (implement this method in TrafficService)
      const activeSources = 0; // await this.trafficService.getActiveSourceCount(user.id);
      const totalVisits = 0; // await this.trafficService.getTotalVisits(user.id);

      const enhancedDescription = `
🎯 Traffic Overview:
• Active sources: ${activeSources}
• Total visits today: ${totalVisits}
• Status: ${activeSources > 0 ? '✅ Active' : '⚠️ No active sources'}

Monitor and optimize your traffic performance.
`;

      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          activeSources,
          totalVisits,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing traffic menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Enhance settings menu with current preferences
   */
  private async enhanceSettingsMenu(ctx: BotContext, baseConfig: MenuConfig): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return baseConfig;
    }

    try {
      const session = await this.sessionService.getSession(userId);
      const preferences = session?.data.preferences;

      const enhancedDescription = `
⚙️ Current Settings:
• Language: ${preferences?.language || 'English'}
• Theme: ${preferences?.display?.theme || 'Auto'}
• Notifications: ${preferences?.notifications?.enablePush ? '🔔 On' : '🔕 Off'}
• Timezone: ${preferences?.display?.timezone || 'UTC'}

Customize your bot experience.
`;

      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          preferences,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error enhancing settings menu', {
        error: unknownToError(err),
        userId,
      });

      return baseConfig;
    }
  }

  /**
   * Process menu action and return result
   */
  private async processMenuAction(ctx: BotContext, action: string, params: string[]): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();

    const actionHandlers: Record<string, () => Promise<MenuActionResult>> = {
      menu: async () => ({
        success: true,
        nextMenu: params[0] as MenuType,
      }),
      back: async () => {
        await this.goBack(ctx);

        return { success: true };
      },
      refresh: async () => {
        const currentNav = await this.getMenuNavigation(userId || '');

        return {
          success: true,
          nextMenu: currentNav?.currentMenu || MenuType.Main,
          message: ctx.t('menu.callback.menu_refreshed'),
        };
      },
      close: async () => ({
        success: true,
        closeMenu: true,
        message: ctx.t('bot.callback.menu_closed'),
      }),
      balance: async () => this.handleBalanceAction(ctx, params[0]),
      profile: async () => this.handleProfileAction(ctx, params[0]),
      settings: async () => this.handleSettingsAction(ctx, params[0]),
      stats: async () => this.handleStatsAction(ctx, params[0]),
      traffic: async () => this.handleTrafficAction(ctx, params[0]),
      help: async () => this.handleHelpAction(ctx, params[0]),
    };

    const handler = actionHandlers[action];

    if (handler) {
      return handler();
    }

    this.logger.warn(`Unhandled menu action: ${action}`, {
      userId,
      action,
      params,
    });

    return {
      success: false,
      message: ctx.t('menu.callback.action_not_implemented', { action }),
    };
  }

  /**
   * Handle balance-related actions
   */
  private async handleBalanceAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return { success: false, message: ctx.t('auth.authentication_required') };
    }

    const balanceActions: Record<string, () => Promise<MenuActionResult>> = {
      current: async () => ({ success: true, nextMenu: MenuType.Balance, message: ctx.t('balance.balance_updated') }),
      history: async () => {
        // Redirect to balance history handler
        return {
          success: true,
          data: { callback: 'balance:history' },
          message: ctx.t('balance.loading_history'),
        };
      },
      analytics: async () => {
        // Show balance analytics summary
        try {
          const user = await this.authUserService.findByPlatformId(userId);
          if (!user) {
            return { success: false, message: ctx.t('auth.authentication_required') };
          }

          const balance = await this.balanceService.getBalance(user.id);
          const symbol = this.currencySymbol;
          const analyticsMessage =
            `<b>${ctx.t('menu.balance.analytics_title')}</b>\n\n` +
            `${ctx.t('balance.available')}: ${symbol}${balance.availableAmount.toFixed(2)}\n` +
            `${ctx.t('balance.total_earned')}: ${symbol}${balance.totalEarned.toFixed(2)}\n` +
            `${ctx.t('balance.pending')}: ${symbol}${balance.pendingAmount.toFixed(2)}\n\n` +
            `<i>${ctx.t('menu.balance.analytics_hint')}</i>`;

          return {
            success: true,
            message: analyticsMessage,
            data: { parseMode: 'HTML' },
          };
        } catch {
          return { success: false, message: ctx.t('common.errors.load_failed') };
        }
      },
    };

    const handler = balanceActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Handle profile-related actions
   */
  private async handleProfileAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return { success: false, message: ctx.t('auth.authentication_required') };
    }

    const profileActions: Record<string, () => Promise<MenuActionResult>> = {
      stats: async () => {
        try {
          const user = await this.authUserService.findByPlatformId(userId);
          if (!user) {
            return { success: false, message: ctx.t('auth.authentication_required') };
          }

          const balance = await this.balanceService.getBalance(user.id);
          const memberSince = new Date(user.createdAt);
          const daysSinceJoin = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24));

          const statsMessage =
            `<b>${ctx.t('menu.profile.stats_title')}</b>\n\n` +
            `📅 ${ctx.t('menu.profile.member_for')}: ${daysSinceJoin} ${ctx.t('common.days_suffix')}\n` +
            `💰 ${ctx.t('balance.total_earned')}: ${this.currencySymbol}${balance.totalEarned.toFixed(2)}\n` +
            `📊 ${ctx.t('menu.profile.account_status')}: ${user.status === UserStatus.Active ? '✅' : '❌'}\n\n` +
            `<i>${ctx.t('menu.profile.stats_hint')}</i>`;

          return {
            success: true,
            message: statsMessage,
            data: { parseMode: 'HTML' },
          };
        } catch {
          return { success: false, message: ctx.t('common.errors.load_failed') };
        }
      },
      security: async () => {
        const securityMessage =
          `<b>${ctx.t('menu.profile.security_title')}</b>\n\n` +
          `🔐 ${ctx.t('menu.profile.two_factor')}: ❌ ${ctx.t('common.disabled')}\n` +
          `📱 ${ctx.t('menu.profile.linked_accounts')}: Telegram\n` +
          `🔑 ${ctx.t('menu.profile.last_login')}: ${this.messageService.formatDateTime(ctx, new Date())}\n\n` +
          `<i>${ctx.t('menu.profile.security_hint')}</i>`;

        return {
          success: true,
          message: securityMessage,
          data: { parseMode: 'HTML' },
        };
      },
    };

    const handler = profileActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Handle settings-related actions
   */
  private async handleSettingsAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return { success: false, message: ctx.t('auth.authentication_required') };
    }

    const settingsActions: Record<string, () => Promise<MenuActionResult>> = {
      notifications: async () => {
        try {
          const session = await this.sessionService.getSession(userId);
          const prefs = session?.data.preferences?.notifications;
          const isPush = prefs?.enablePush ?? true;
          const isEmail = prefs?.enableEmail ?? false;

          const notifMessage =
            `<b>${ctx.t('menu.settings.notifications_title')}</b>\n\n` +
            `🔔 ${ctx.t('menu.settings.push_notifications')}: ${isPush ? '✅' : '❌'}\n` +
            `📧 ${ctx.t('menu.settings.email_notifications')}: ${isEmail ? '✅' : '❌'}\n\n` +
            `<i>${ctx.t('menu.settings.notifications_hint')}</i>`;

          return {
            success: true,
            message: notifMessage,
            data: { parseMode: 'HTML' },
          };
        } catch {
          return { success: false, message: ctx.t('common.errors.load_failed') };
        }
      },
      language: async () => {
        // Redirect to settings:lang handler in settings.handler.ts
        return {
          success: true,
          data: { callback: 'settings:lang' },
          message: ctx.t('settings.select_language'),
        };
      },
      theme: async () => {
        try {
          const session = await this.sessionService.getSession(userId);
          const currentTheme = session?.data.preferences?.display?.theme || 'auto';

          const themeMessage =
            `<b>${ctx.t('menu.settings.theme_title')}</b>\n\n` +
            `${ctx.t('menu.settings.current_theme')}: ${currentTheme}\n\n` +
            `${ctx.t('menu.settings.available_themes')}:\n` +
            `• 🌞 ${ctx.t('menu.settings.theme_light')}\n` +
            `• 🌙 ${ctx.t('menu.settings.theme_dark')}\n` +
            `• 🔄 ${ctx.t('menu.settings.theme_auto')}\n\n` +
            `<i>${ctx.t('menu.settings.theme_hint')}</i>`;

          return {
            success: true,
            message: themeMessage,
            data: { parseMode: 'HTML' },
          };
        } catch {
          return { success: false, message: ctx.t('common.errors.load_failed') };
        }
      },
      export: async () => {
        const exportMessage =
          `<b>${ctx.t('menu.settings.export_title')}</b>\n\n` +
          `${ctx.t('menu.settings.export_description')}\n\n` +
          `${ctx.t('menu.settings.available_exports')}:\n` +
          `• 📊 ${ctx.t('menu.settings.export_transactions')}\n` +
          `• 📋 ${ctx.t('menu.settings.export_orders')}\n` +
          `• 👤 ${ctx.t('menu.settings.export_profile')}\n\n` +
          `<i>${ctx.t('menu.settings.export_hint')}</i>`;

        return {
          success: true,
          message: exportMessage,
          data: { parseMode: 'HTML' },
        };
      },
      reset: async () => {
        const resetMessage =
          `<b>⚠️ ${ctx.t('menu.settings.reset_title')}</b>\n\n` +
          `${ctx.t('menu.settings.reset_warning')}\n\n` +
          `${ctx.t('menu.settings.reset_affects')}:\n` +
          `• ${ctx.t('menu.settings.reset_preferences')}\n` +
          `• ${ctx.t('menu.settings.reset_navigation')}\n\n` +
          `<i>${ctx.t('menu.settings.reset_hint')}</i>`;

        return {
          success: true,
          message: resetMessage,
          data: { parseMode: 'HTML' },
        };
      },
    };

    const handler = settingsActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Handle statistics-related actions
   */
  private async handleStatsAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return { success: false, message: ctx.t('auth.authentication_required') };
    }

    const formatStatsMessage = (
      period: string,
      stats: { clicks: number; conversions: number; earnings: number },
    ): string => {
      return (
        `<b>${ctx.t('menu.stats.title', { period })}</b>\n\n` +
        `📊 ${ctx.t('menu.stats.clicks')}: ${stats.clicks}\n` +
        `🎯 ${ctx.t('menu.stats.conversions')}: ${stats.conversions}\n` +
        `💰 ${ctx.t('menu.stats.earnings')}: ${this.currencySymbol}${stats.earnings.toFixed(2)}\n\n` +
        `<i>${ctx.t('menu.stats.updated_at', { time: new Date().toLocaleTimeString() })}</i>`
      );
    };

    const statsActions: Record<string, () => Promise<MenuActionResult>> = {
      overview: async () => {
        try {
          const user = await this.authUserService.findByPlatformId(userId);
          if (!user) {
            return { success: false, message: ctx.t('auth.authentication_required') };
          }

          const balance = await this.balanceService.getBalance(user.id);

          const overviewMessage =
            `<b>${ctx.t('menu.stats.overview_title')}</b>\n\n` +
            `💰 ${ctx.t('balance.total_earned')}: ${this.currencySymbol}${balance.totalEarned.toFixed(2)}\n` +
            `📈 ${ctx.t('menu.stats.active_orders')}: 0\n` +
            `🎯 ${ctx.t('menu.stats.total_conversions')}: 0\n\n` +
            `<i>${ctx.t('menu.stats.overview_hint')}</i>`;

          return {
            success: true,
            message: overviewMessage,
            data: { parseMode: 'HTML' },
          };
        } catch {
          return { success: false, message: ctx.t('common.errors.load_failed') };
        }
      },
      daily: async () => {
        const stats = { clicks: 0, conversions: 0, earnings: 0 };

        return {
          success: true,
          message: formatStatsMessage(ctx.t('menu.stats.period_daily'), stats),
          data: { parseMode: 'HTML' },
        };
      },
      weekly: async () => {
        const stats = { clicks: 0, conversions: 0, earnings: 0 };

        return {
          success: true,
          message: formatStatsMessage(ctx.t('menu.stats.period_weekly'), stats),
          data: { parseMode: 'HTML' },
        };
      },
      monthly: async () => {
        const stats = { clicks: 0, conversions: 0, earnings: 0 };

        return {
          success: true,
          message: formatStatsMessage(ctx.t('menu.stats.period_monthly'), stats),
          data: { parseMode: 'HTML' },
        };
      },
    };

    const handler = statsActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Handle traffic-related actions
   */
  private async handleTrafficAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return { success: false, message: ctx.t('auth.authentication_required') };
    }

    const trafficActions: Record<string, () => Promise<MenuActionResult>> = {
      live: async () => {
        const liveMessage =
          `<b>${ctx.t('menu.traffic.live_title')}</b>\n\n` +
          `📊 ${ctx.t('menu.traffic.active_visitors')}: 0\n` +
          `🔄 ${ctx.t('menu.traffic.requests_per_min')}: 0\n` +
          `📈 ${ctx.t('menu.traffic.conversion_rate')}: 0%\n\n` +
          `<i>${ctx.t('menu.traffic.live_hint')}</i>`;

        return {
          success: true,
          message: liveMessage,
          data: { parseMode: 'HTML' },
        };
      },
      sources: async () => {
        // Redirect to traffic sources handler
        return {
          success: true,
          data: { callback: 'traf:src' },
          message: ctx.t('traffic.loading_sources'),
        };
      },
      analytics: async () => {
        const analyticsMessage =
          `<b>${ctx.t('menu.traffic.analytics_title')}</b>\n\n` +
          `📊 ${ctx.t('menu.traffic.total_visits')}: 0\n` +
          `🎯 ${ctx.t('menu.traffic.unique_users')}: 0\n` +
          `⏱️ ${ctx.t('menu.traffic.avg_session')}: 0s\n` +
          `📈 ${ctx.t('menu.traffic.bounce_rate')}: 0%\n\n` +
          `<i>${ctx.t('menu.traffic.analytics_hint')}</i>`;

        return {
          success: true,
          message: analyticsMessage,
          data: { parseMode: 'HTML' },
        };
      },
      optimize: async () => {
        const optimizeMessage =
          `<b>${ctx.t('menu.traffic.optimize_title')}</b>\n\n` +
          `${ctx.t('menu.traffic.optimize_description')}\n\n` +
          `${ctx.t('menu.traffic.optimization_tips')}:\n` +
          `• ${ctx.t('menu.traffic.tip_targeting')}\n` +
          `• ${ctx.t('menu.traffic.tip_schedule')}\n` +
          `• ${ctx.t('menu.traffic.tip_budget')}\n\n` +
          `<i>${ctx.t('menu.traffic.optimize_hint')}</i>`;

        return {
          success: true,
          message: optimizeMessage,
          data: { parseMode: 'HTML' },
        };
      },
    };

    const handler = trafficActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Handle help-related actions
   */
  private async handleHelpAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const helpActions: Record<string, () => Promise<MenuActionResult>> = {
      faq: async () => {
        const faqMessage =
          `<b>${ctx.t('menu.help_menu.faq_title')}</b>\n\n` +
          `<b>${ctx.t('menu.help_menu.faq_q1')}</b>\n` +
          `${ctx.t('menu.help_menu.faq_a1')}\n\n` +
          `<b>${ctx.t('menu.help_menu.faq_q2')}</b>\n` +
          `${ctx.t('menu.help_menu.faq_a2')}\n\n` +
          `<b>${ctx.t('menu.help_menu.faq_q3')}</b>\n` +
          `${ctx.t('menu.help_menu.faq_a3')}\n\n` +
          `<i>${ctx.t('menu.help_menu.faq_hint')}</i>`;

        return {
          success: true,
          message: faqMessage,
          data: { parseMode: 'HTML' },
        };
      },
      contact: async () => {
        const contactMessage =
          `<b>${ctx.t('support.contact_title')}</b>\n\n` +
          `${ctx.t('support.contact_description')}\n\n` +
          `📧 ${ctx.t('support.email')}: support@example.com\n` +
          `💬 ${ctx.t('support.telegram')}: @support_bot\n\n` +
          `<i>${ctx.t('support.response_time')}</i>`;

        return {
          success: true,
          message: contactMessage,
          data: { parseMode: 'HTML' },
        };
      },
      tutorials: async () => {
        const tutorialsMessage =
          `<b>${ctx.t('menu.help_menu.tutorials_title')}</b>\n\n` +
          `${ctx.t('menu.help_menu.tutorials_description')}\n\n` +
          `📚 ${ctx.t('menu.help_menu.available_tutorials')}:\n` +
          `• ${ctx.t('menu.help_menu.tutorial_getting_started')}\n` +
          `• ${ctx.t('menu.help_menu.tutorial_create_order')}\n` +
          `• ${ctx.t('menu.help_menu.tutorial_manage_traffic')}\n` +
          `• ${ctx.t('menu.help_menu.tutorial_withdraw')}\n\n` +
          `<i>${ctx.t('menu.help_menu.tutorials_hint')}</i>`;

        return {
          success: true,
          message: tutorialsMessage,
          data: { parseMode: 'HTML' },
        };
      },
    };

    const handler = helpActions[subAction];

    if (handler) {
      return handler();
    }

    return { success: false, message: ctx.t('bot.callback.action_unavailable', { action: subAction }) };
  }

  /**
   * Update navigation state in session
   */
  private async updateNavigationState(
    userId: string,
    menuType: MenuType,
    options?: {
      updateHistory?: boolean;
      clearBreadcrumb?: boolean;
      customData?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const session = await this.sessionService.getSession(userId);
      const currentState = session?.data.navigationState;

      const shouldUpdateHistory = options?.updateHistory !== false;
      const shouldClearBreadcrumb = options?.clearBreadcrumb === true;

      let newHistory = shouldClearBreadcrumb ? [] : [...(currentState?.history || [])];
      let newBreadcrumb = shouldClearBreadcrumb ? [] : [...(currentState?.breadcrumb || [])];

      // Add current location to history if different and updating history
      if (shouldUpdateHistory && currentState?.currentLocation && currentState.currentLocation !== menuType) {
        newHistory.push(currentState.currentLocation as MenuType);

        // Limit history size
        if (newHistory.length > this.maxBreadcrumbLength) {
          newHistory = newHistory.slice(-this.maxBreadcrumbLength);
        }
      }

      // Update breadcrumb
      if (!shouldClearBreadcrumb) {
        if (!newBreadcrumb.includes(menuType)) {
          newBreadcrumb.push(menuType);
        }

        // Limit breadcrumb size
        if (newBreadcrumb.length > this.maxBreadcrumbLength) {
          newBreadcrumb = newBreadcrumb.slice(-this.maxBreadcrumbLength);
        }
      }

      await this.sessionService.updateSession(userId, {
        navigationState: {
          currentLocation: menuType,
          breadcrumb: newBreadcrumb,
          history: newHistory,
          metadata: {
            ...currentState?.metadata,
            ...options?.customData,
            lastNavigationAt: new Date().toISOString(),
            navigationType: shouldUpdateHistory ? 'forward' : 'direct',
          },
        },
      });
    } catch (err: unknown) {
      this.logger.error('Failed to update navigation state', {
        userId,
        menuType,
        error: unknownToError(err),
      });
    }
  }

  /**
   * Format menu text with personalization and breadcrumbs
   */
  private async formatMenuText(ctx: BotContext, menuConfig: MenuConfig): Promise<string> {
    const userId = ctx.from?.id?.toString();
    let text = `<b>${menuConfig.title}</b>\n`;

    // Add breadcrumb navigation if available
    if (userId) {
      const navigation = await this.getMenuNavigation(userId);
      if (navigation && navigation.history.length > 0) {
        const breadcrumbText = navigation.history.map((menu) => this.getMenuDisplayName(menu)).join(' › ');
        text += `\n<i>📍 ${breadcrumbText} › ${this.getMenuDisplayName(navigation.currentMenu)}</i>\n`;
      }
    }

    if (menuConfig.description) {
      text += `\n${menuConfig.description}\n`;
    }

    return text;
  }

  /**
   * Get display name for menu type
   */
  private getMenuDisplayName(menuType: MenuType): string {
    const displayNames: Record<MenuType, string> = {
      [MenuType.Main]: 'Main',
      [MenuType.Profile]: 'Profile',
      [MenuType.Settings]: 'Settings',
      [MenuType.Auth]: 'Auth',
      [MenuType.Balance]: 'Balance',
      [MenuType.Traffic]: 'Traffic',
      [MenuType.Statistics]: 'Statistics',
      [MenuType.Help]: 'Help',
      [MenuType.Admin]: 'Admin',
      [MenuType.Campaign]: 'Campaign',
      [MenuType.Withdrawal]: 'Withdrawal',
      [MenuType.Referral]: 'Referral',
      [MenuType.Notifications]: 'Notifications',
      [MenuType.Verification]: 'Verification',
      [MenuType.Error]: 'Error',
    };

    return displayNames[menuType] || menuType;
  }

  /**
   * Create inline keyboard from menu buttons
   */
  private createInlineKeyboard(buttons: MenuButton[][]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    buttons.forEach((row, index) => {
      if (index > 0) {
        keyboard.row();
      }

      row.forEach((button) => {
        if (button.url) {
          keyboard.url(button.text, button.url);
        } else {
          keyboard.text(button.text, button.callbackData);
        }
      });
    });

    return keyboard;
  }

  /**
   * Send menu message (new or edit existing)
   */
  private async sendMenuMessage(
    ctx: BotContext,
    text: string,
    keyboard: InlineKeyboard,
    _config: MenuConfig,
  ): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle action-specific data
   */
  private async handleActionData(ctx: BotContext, data: Record<string, unknown>): Promise<void> {
    // Process any additional data from menu actions
    this.logger.debug('Handling action data', {
      userId: ctx.from?.id,
      data,
    });

    // This can be extended for specific data handling needs
  }

  /**
   * Update session with action activity
   */
  private async updateSessionActivity(userId: string, action: string, params: string[]): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        conversationState: {
          currentStep: `menu_action_${action}`,
          context: {
            lastAction: action,
            lastActionParams: params,
            lastActionAt: new Date().toISOString(),
          },
          isActive: true,
        },
      });
    } catch (err: unknown) {
      this.logger.error('Failed to update session activity', {
        userId,
        action,
        params,
        error: unknownToError(err),
      });
    }
  }

  /**
   * Handle menu navigation errors
   */
  private async handleMenuError(ctx: BotContext, error: Error, menuType: MenuType): Promise<void> {
    const userId = ctx.from?.id;

    this.logger.error('Menu navigation error', {
      menuType,
      userId,
      error: error.message,
      stack: error.stack,
    });

    const errorMessage =
      process.env.NODE_ENV === 'development' ? `Menu error: ${error.message}` : ctx.t('menu.errors.menu_load_error');

    try {
      const keyboard = new InlineKeyboard()
        .text(ctx.t('menu.buttons.main_menu'), 'menu:main')
        .text(ctx.t('menu.buttons.try_again'), `menu:${menuType}`)
        .row()
        .text(ctx.t('menu.buttons.support'), 'help:contact');

      await this.messageService.sendNewMessage(ctx, {
        text: errorMessage,
        replyMarkup: keyboard,
      });
    } catch (replyError) {
      this.logger.error('Failed to send menu error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
      });
    }
  }

  /**
   * Handle action processing errors
   */
  private async handleActionError(ctx: BotContext, error: Error, callbackData: string): Promise<void> {
    const userId = ctx.from?.id;

    this.logger.error('Menu action error', {
      callbackData,
      userId,
      error: error.message,
      stack: error.stack,
    });

    const errorMessage =
      process.env.NODE_ENV === 'development' ? `Action error: ${error.message}` : ctx.t('menu.errors.action_error');

    try {
      const keyboard = new InlineKeyboard()
        .text(ctx.t('menu.buttons.main_menu'), 'menu:main')
        .text(ctx.t('menu.buttons.support'), 'help:contact');

      await this.messageService.sendNewMessage(ctx, {
        text: errorMessage,
        replyMarkup: keyboard,
      });
    } catch (replyError) {
      this.logger.error('Failed to send action error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
      });
    }
  }
}
