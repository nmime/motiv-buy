import { Injectable, Logger } from '@nestjs/common';
import { BotContext, MenuType, MenuConfig, MenuActionResult, MenuNavigation } from '@app/feature-bot-shared';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceService } from '@app/feature-balance-main';
import { UserService } from '@app/feature-user-main';
import { StatisticService } from '@app/feature-statistic-main';
import { TrafficService } from '@app/feature-traffic-main';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { InlineKeyboard } from 'grammy';

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
  private readonly MAX_BREADCRUMB_LENGTH = 5;

  constructor(
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
    private readonly userService: UserService,
    private readonly statisticService: StatisticService,
    private readonly trafficService: TrafficService,
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
  ) {}

  /**
   * Handle menu navigation request
   * 
   * @param ctx - Bot context
   * @param menuType - Target menu type
   * @param options - Navigation options
   * @returns Promise<void>
   */
  async navigateToMenu(ctx: BotContext, menuType: MenuType, options?: {
    updateHistory?: boolean;
    clearBreadcrumb?: boolean;
    customData?: Record<string, any>;
  }): Promise<void> {
    try {
      this.logger.debug(`Navigating to menu: ${menuType}`, {
        userId: ctx.from?.id,
        menuType,
        options,
      });

      if (!ctx.from?.id) {
        await ctx.reply('🔒 Authentication required to access menus.');
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
    } catch (error) {
      this.logger.error(`Error navigating to menu: ${menuType}`, {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.from?.id,
        menuType,
      });
      
      await this.handleMenuError(ctx, error as Error, menuType);
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
        await ctx.reply('🔒 Authentication required.');
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
          await ctx.reply(actionResult.message);
        }

        if (actionResult.closeMenu) {
          // Close inline keyboard by editing message
          try {
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
          } catch (error) {
            // Ignore edit errors for old messages
            this.logger.debug('Could not close menu - message too old or already edited');
          }
        }

        // Handle custom action data
        if (actionResult.data) {
          await this.handleActionData(ctx, actionResult.data);
        }
      } else {
        await ctx.reply(
          actionResult.message || '❌ Action failed. Please try again.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 Main Menu', callback_data: 'menu:main' }],
              ],
            },
          }
        );
      }
      
      // Update session with action activity
      await this.updateSessionActivity(userId, action, params);
      
    } catch (error) {
      this.logger.error(`Error handling menu action: ${callbackData}`, {
        error: error instanceof Error ? error.message : String(error),
        userId: ctx.from?.id,
        callbackData,
      });
      
      await this.handleActionError(ctx, error as Error, callbackData);
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
        maxHistoryLength: this.MAX_BREADCRUMB_LENGTH,
        canGoBack: (navState.history as MenuType[])?.length > 0,
      };
    } catch (error) {
      this.logger.error(`Error getting menu navigation for user: ${userId}`, {
        error: error instanceof Error ? error.message : String(error),
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
      await ctx.reply('🔒 Authentication required.');
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
    } catch (error) {
      this.logger.error(`Error clearing navigation history for user: ${userId}`, {
        error: error instanceof Error ? error.message : String(error),
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
      
      // Enhance with dynamic data
      switch (menuType) {
        case MenuType.Main:
          return await this.enhanceMainMenu(ctx, baseConfig);
        case MenuType.Balance:
          return await this.enhanceBalanceMenu(ctx, baseConfig);
        case MenuType.Profile:
          return await this.enhanceProfileMenu(ctx, baseConfig);
        case MenuType.Statistics:
          return await this.enhanceStatisticsMenu(ctx, baseConfig);
        case MenuType.Traffic:
          return await this.enhanceTrafficMenu(ctx, baseConfig);
        case MenuType.Settings:
          return await this.enhanceSettingsMenu(ctx, baseConfig);
        default:
          return baseConfig;
      }
    } catch (error) {
      this.logger.error('Error generating dynamic menu content', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) return baseConfig;

      const balance = await this.balanceService.getUserBalance(user.id);
      const hasNotifications = false; // TODO: Check for unread notifications
      
      // Update title with balance info
      const enhancedTitle = `${baseConfig.title}\n💰 Balance: $${balance.availableAmount.toFixed(2)}${hasNotifications ? '\n🔔 New notifications' : ''}`;
      
      return {
        ...baseConfig,
        title: enhancedTitle,
        metadata: {
          ...baseConfig.metadata,
          userBalance: balance.availableAmount,
          hasNotifications,
        },
      };
    } catch (error) {
      this.logger.error('Error enhancing main menu', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) return baseConfig;

      const balance = await this.balanceService.getUserBalance(user.id);
      
      // Update description with current balance info
      const enhancedDescription = `
Current Balance: $${balance.availableAmount.toFixed(2)}
Total Earned: $${balance.totalEarned.toFixed(2)}
Pending: $${balance.pendingAmount.toFixed(2)}

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
    } catch (error) {
      this.logger.error('Error enhancing balance menu', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) return baseConfig;

      const enhancedDescription = `
Name: ${user.firstName} ${user.lastName || ''}
Username: ${user.username || 'Not set'}
Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}
Verified: ${user.isVerified ? '✅ Verified' : '❌ Unverified'}
Member since: ${new Date(user.createdAt).toLocaleDateString()}
`;
      
      return {
        ...baseConfig,
        description: enhancedDescription,
        metadata: {
          ...baseConfig.metadata,
          user,
        },
      };
    } catch (error) {
      this.logger.error('Error enhancing profile menu', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) return baseConfig;

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
• Earnings: $${todayStats.earnings.toFixed(2)}

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
    } catch (error) {
      this.logger.error('Error enhancing statistics menu', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

    try {
      const user = await this.authUserService.findByPlatformId(userId);
      if (!user) return baseConfig;

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
    } catch (error) {
      this.logger.error('Error enhancing traffic menu', {
        error: error instanceof Error ? error.message : String(error),
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
    if (!userId) return baseConfig;

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
    } catch (error) {
      this.logger.error('Error enhancing settings menu', {
        error: error instanceof Error ? error.message : String(error),
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
    
    switch (action) {
      case 'menu':
        return {
          success: true,
          nextMenu: params[0] as MenuType,
        };
      
      case 'back':
        await this.goBack(ctx);
        return { success: true };
      
      case 'refresh':
        const currentNav = await this.getMenuNavigation(userId!);
        return {
          success: true,
          nextMenu: currentNav?.currentMenu || MenuType.Main,
          message: '🔄 Menu refreshed',
        };
      
      case 'close':
        return {
          success: true,
          closeMenu: true,
          message: 'Menu closed.',
        };
      
      // Handle specific menu actions
      case 'balance':
        return await this.handleBalanceAction(ctx, params[0]);
      
      case 'profile':
        return await this.handleProfileAction(ctx, params[0]);
      
      case 'settings':
        return await this.handleSettingsAction(ctx, params[0]);
      
      case 'stats':
        return await this.handleStatsAction(ctx, params[0]);
      
      case 'traffic':
        return await this.handleTrafficAction(ctx, params[0]);
      
      case 'help':
        return await this.handleHelpAction(ctx, params[0]);
      
      default:
        this.logger.warn(`Unhandled menu action: ${action}`, {
          userId,
          action,
          params,
        });
        
        return {
          success: false,
          message: `Action "${action}" is not implemented yet. Please try again or contact support.`,
        };
    }
  }

  /**
   * Handle balance-related actions
   */
  private async handleBalanceAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    switch (subAction) {
      case 'current':
        return { success: true, nextMenu: MenuType.Balance, message: '💰 Balance refreshed' };
      case 'history':
        return { success: false, message: '📈 Transaction history coming soon!' };
      case 'analytics':
        return { success: false, message: '📊 Balance analytics coming soon!' };
      default:
        return { success: false, message: `Balance action "${subAction}" not available.` };
    }
  }

  /**
   * Handle profile-related actions
   */
  private async handleProfileAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    switch (subAction) {
      case 'edit':
        return { success: false, message: '📝 Profile editing coming soon!' };
      case 'stats':
        return { success: false, message: '📊 Profile stats coming soon!' };
      case 'security':
        return { success: false, message: '🔒 Security settings coming soon!' };
      default:
        return { success: false, message: `Profile action "${subAction}" not available.` };
    }
  }

  /**
   * Handle settings-related actions
   */
  private async handleSettingsAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();
    if (!userId) return { success: false, message: 'Authentication required.' };

    switch (subAction) {
      case 'notifications':
        return { success: false, message: '🔔 Notification settings coming soon!' };
      case 'language':
        return { success: false, message: '🌍 Language settings coming soon!' };
      case 'theme':
        return { success: false, message: '🎨 Theme settings coming soon!' };
      case 'export':
        return { success: false, message: '📥 Data export coming soon!' };
      case 'reset':
        return { success: false, message: '🔄 Reset options coming soon!' };
      default:
        return { success: false, message: `Settings action "${subAction}" not available.` };
    }
  }

  /**
   * Handle statistics-related actions
   */
  private async handleStatsAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    switch (subAction) {
      case 'overview':
        return { success: false, message: '📈 Statistics overview coming soon!' };
      case 'daily':
        return { success: false, message: '📅 Daily statistics coming soon!' };
      case 'weekly':
        return { success: false, message: '📅 Weekly statistics coming soon!' };
      case 'monthly':
        return { success: false, message: '📅 Monthly statistics coming soon!' };
      default:
        return { success: false, message: `Stats action "${subAction}" not available.` };
    }
  }

  /**
   * Handle traffic-related actions
   */
  private async handleTrafficAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    switch (subAction) {
      case 'live':
        return { success: false, message: '📉 Live traffic stats coming soon!' };
      case 'sources':
        return { success: false, message: '🎯 Traffic sources coming soon!' };
      case 'analytics':
        return { success: false, message: '🔍 Traffic analytics coming soon!' };
      case 'optimize':
        return { success: false, message: '⚙️ Traffic optimization coming soon!' };
      default:
        return { success: false, message: `Traffic action "${subAction}" not available.` };
    }
  }

  /**
   * Handle help-related actions
   */
  private async handleHelpAction(ctx: BotContext, subAction: string): Promise<MenuActionResult> {
    switch (subAction) {
      case 'faq':
        return { success: false, message: '📚 FAQ section coming soon!' };
      case 'contact':
        return { 
          success: true, 
          message: '📞 Contact support at @motivbuy_support or support@motivbuy.com' 
        };
      case 'tutorials':
        return { success: false, message: '📚 Tutorials coming soon!' };
      default:
        return { success: false, message: `Help action "${subAction}" not available.` };
    }
  }

  /**
   * Update navigation state in session
   */
  private async updateNavigationState(userId: string, menuType: MenuType, options?: {
    updateHistory?: boolean;
    clearBreadcrumb?: boolean;
    customData?: Record<string, any>;
  }): Promise<void> {
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
        if (newHistory.length > this.MAX_BREADCRUMB_LENGTH) {
          newHistory = newHistory.slice(-this.MAX_BREADCRUMB_LENGTH);
        }
      }
      
      // Update breadcrumb
      if (!shouldClearBreadcrumb) {
        if (!newBreadcrumb.includes(menuType)) {
          newBreadcrumb.push(menuType);
        }
        
        // Limit breadcrumb size
        if (newBreadcrumb.length > this.MAX_BREADCRUMB_LENGTH) {
          newBreadcrumb = newBreadcrumb.slice(-this.MAX_BREADCRUMB_LENGTH);
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
    } catch (error) {
      this.logger.error('Failed to update navigation state', {
        userId,
        menuType,
        error: error instanceof Error ? error.message : String(error),
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
        const breadcrumbText = navigation.history.map(menu => this.getMenuDisplayName(menu)).join(' › ');
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
  private createInlineKeyboard(buttons: any[][]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    buttons.forEach((row, index) => {
      if (index > 0) keyboard.row();
      
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
  private async sendMenuMessage(ctx: BotContext, text: string, keyboard: InlineKeyboard, config: MenuConfig): Promise<void> {
    const options = {
      reply_markup: keyboard,
      parse_mode: 'HTML' as const,
    };

    try {
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        // Edit existing message
        await ctx.editMessageText(text, options);
      } else {
        // Send new message
        await ctx.replyWithHTML(text, options);
      }
    } catch (error) {
      this.logger.error('Error sending menu message', {
        error: error instanceof Error ? error.message : String(error),
        menuType: config.type,
        userId: ctx.from?.id,
      });
      
      // Fallback to regular reply if edit fails
      try {
        await ctx.replyWithHTML(text, options);
      } catch (fallbackError) {
        this.logger.error('Fallback menu message also failed', {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }
  }

  /**
   * Handle action-specific data
   */
  private async handleActionData(ctx: BotContext, data: Record<string, any>): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to update session activity', {
        userId,
        action,
        params,
        error: error instanceof Error ? error.message : String(error),
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

    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Menu error: ${error.message}`
      : 'Sorry, there was a problem loading the menu. Please try again.';

    try {
      await ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🏠 Main Menu', callback_data: 'menu:main' },
              { text: '🔄 Try Again', callback_data: `menu:${menuType}` },
            ],
            [
              { text: '🆘 Support', callback_data: 'help:contact' },
            ],
          ],
        },
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

    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Action error: ${error.message}`
      : 'Sorry, that action failed. Please try again or return to the main menu.';

    try {
      await ctx.reply(errorMessage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Main Menu', callback_data: 'menu:main' },
              { text: '🆘 Support', callback_data: 'help:contact' },
            ],
          ],
        },
      });
    } catch (replyError) {
      this.logger.error('Failed to send action error message', {
        originalError: error.message,
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
      });
    }
  }
}