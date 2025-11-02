import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotContext, MenuConfig, MenuType, MenuButton, MenuActionResult } from '@app/feature-bot-shared';
import { SessionService } from './session.service';

/**
 * Menu Service
 *
 * Service responsible for managing bot menu systems, keyboard layouts,
 * and menu navigation logic with dynamic content and state management.
 *
 * @class MenuService
 */
@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);
  private readonly maxHistoryLength = 10;

  constructor(private readonly sessionService: SessionService) {}

  /**
   * Generate menu configuration for specific menu type
   *
   * @param menuType - Type of menu to generate
   * @param ctx - Bot context for personalization
   * @returns MenuConfig - Configuration object for menu display
   */
  generateMenu(menuType: MenuType, ctx: BotContext): MenuConfig {
    this.logger.debug(`Generating menu type: ${menuType}`, {
      userId: ctx.from?.id,
      menuType,
    });

    switch (menuType) {
      case MenuType.Main:
        return this.generateMainMenu(ctx);
      case MenuType.Profile:
        return this.generateProfileMenu(ctx);
      case MenuType.Settings:
        return this.generateSettingsMenu(ctx);
      case MenuType.Balance:
        return this.generateBalanceMenu(ctx);
      case MenuType.Traffic:
        return this.generateTrafficMenu(ctx);
      case MenuType.Statistics:
        return this.generateStatisticsMenu(ctx);
      case MenuType.Help:
        return this.generateHelpMenu(ctx);
      case MenuType.Campaign:
        return this.generateCampaignMenu(ctx);
      case MenuType.Withdrawal:
        return this.generateWithdrawalMenu(ctx);
      case MenuType.Referral:
        return this.generateReferralMenu(ctx);
      case MenuType.Admin:
        return this.generateAdminMenu(ctx);
      default:
        return this.generateDefaultMenu(ctx, menuType);
    }
  }

  /**
   * Handle menu button interaction
   *
   * @param ctx - Bot context with callback data
   * @param callbackData - Data from button interaction
   * @returns Promise<void>
   */
  async handleMenuAction(ctx: BotContext, callbackData: string): Promise<void> {
    try {
      this.logger.debug(`Handling menu action: ${callbackData}`, {
        userId: ctx.from?.id,
        callbackData,
      });

      const [action, ...params] = callbackData.split(':');
      const actionResult = await this.processMenuAction(ctx, action, params);

      if (actionResult.success) {
        if (actionResult.nextMenu) {
          await this.navigateToMenu(ctx, actionResult.nextMenu);
        }

        if (actionResult.message) {
          await ctx.reply(actionResult.message);
        }
      } else {
        await ctx.reply(actionResult.message || 'Action failed. Please try again.');
      }
    } catch (err: unknown) {
      this.logger.error(`Error handling menu action: ${callbackData}`, {
        error: unknownToError(err),
        userId: ctx.from?.id,
        callbackData,
      });

      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  /**
   * Navigate to specific menu
   *
   * @param ctx - Bot context
   * @param menuType - Target menu type
   * @returns Promise<void>
   */
  async navigateToMenu(ctx: BotContext, menuType: MenuType): Promise<void> {
    try {
      this.logger.debug(`Navigating to menu: ${menuType}`, {
        userId: ctx.from?.id,
        menuType,
      });

      if (!ctx.from?.id) {
        await ctx.reply('Authentication required to access menus.');

        return;
      }

      // Update navigation state in session
      await this.updateNavigationState(ctx.from.id.toString(), menuType);

      // Generate menu
      const menuConfig = this.generateMenu(menuType, ctx);

      // Create inline keyboard
      const keyboard = this.createInlineKeyboard(menuConfig.buttons);

      // Send or edit message with menu
      const menuText = this.formatMenuText(menuConfig);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });
      } else {
        await ctx.replyWithHTML(menuText, {
          reply_markup: keyboard,
        });
      }
    } catch (err: unknown) {
      this.logger.error(`Error navigating to menu: ${menuType}`, {
        error: unknownToError(err),
        userId: ctx.from?.id,
        menuType,
      });

      await ctx.reply('Failed to navigate to menu. Please try again.');
    }
  }

  /**
   * Get user's menu history for back navigation
   *
   * @param userId - User identifier
   * @returns Promise<MenuType[]> - Array of previously visited menus
   */
  async getMenuHistory(userId: string): Promise<MenuType[]> {
    try {
      this.logger.debug(`Getting menu history for user: ${userId}`);

      const session = await this.sessionService.getSession(userId);
      if (!session?.data.navigationState) {
        return [];
      }

      return session.data.navigationState.history as MenuType[];
    } catch (err: unknown) {
      this.logger.error(`Error getting menu history for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      return [];
    }
  }

  /**
   * Go back to previous menu
   *
   * @param ctx - Bot context
   * @returns Promise<void>
   */
  async goBack(ctx: BotContext): Promise<void> {
    if (!ctx.from?.id) {
      await ctx.reply('Authentication required.');

      return;
    }

    const userId = ctx.from.id.toString();
    const history = await this.getMenuHistory(userId);

    if (history.length === 0) {
      await this.navigateToMenu(ctx, MenuType.Main);

      return;
    }

    const previousMenu = history[history.length - 1];
    await this.navigateToMenu(ctx, previousMenu);
  }

  // Private helper methods
  private generateMainMenu(ctx: BotContext): MenuConfig {
    const userName = ctx.from?.first_name || 'User';

    return {
      type: MenuType.Main,
      title: `Welcome, ${userName}! 🚀`,
      description: 'Choose an option from the menu below:',
      buttons: [
        [
          { text: '📈 Statistics', callbackData: 'menu:statistics' },
          { text: '💰 Balance', callbackData: 'menu:balance' },
        ],
        [
          { text: '🎯 Traffic', callbackData: 'menu:traffic' },
          { text: '📋 Campaign', callbackData: 'menu:campaign' },
        ],
        [
          { text: '👤 Profile', callbackData: 'menu:profile' },
          { text: '⚙️ Settings', callbackData: 'menu:settings' },
        ],
        [
          { text: '💸 Withdraw', callbackData: 'menu:withdrawal' },
          { text: '🤝 Referrals', callbackData: 'menu:referral' },
        ],
        [{ text: '❓ Help', callbackData: 'menu:help' }],
      ],
      isInline: true,
    };
  }

  private generateProfileMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Profile,
      title: 'Your Profile 👤',
      description: 'Manage your account information',
      buttons: [
        [
          { text: '📝 Edit Info', callbackData: 'profile:edit' },
          { text: '📊 View Stats', callbackData: 'profile:stats' },
        ],
        [
          { text: '🔒 Security', callbackData: 'profile:security' },
          { text: '📧 Notifications', callbackData: 'menu:notifications' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateSettingsMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Settings,
      title: 'Settings ⚙️',
      description: 'Configure your preferences',
      buttons: [
        [
          { text: '🌍 Language', callbackData: 'settings:language' },
          { text: '🔔 Notifications', callbackData: 'settings:notifications' },
        ],
        [
          { text: '🎨 Theme', callbackData: 'settings:theme' },
          { text: '🔒 Privacy', callbackData: 'settings:privacy' },
        ],
        [
          { text: '📥 Export Data', callbackData: 'settings:export' },
          { text: '🔄 Reset', callbackData: 'settings:reset' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateBalanceMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Balance,
      title: 'Balance & Earnings 💰',
      description: 'View your financial information',
      buttons: [
        [
          { text: '💵 Current Balance', callbackData: 'balance:current' },
          { text: '📈 Earnings History', callbackData: 'balance:history' },
        ],
        [
          { text: '💸 Request Withdrawal', callbackData: 'menu:withdrawal' },
          { text: '📊 Analytics', callbackData: 'balance:analytics' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateTrafficMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Traffic,
      title: 'Traffic Management 🎯',
      description: 'Monitor and manage your traffic sources',
      buttons: [
        [
          { text: '📉 Live Stats', callbackData: 'traffic:live' },
          { text: '🎯 Sources', callbackData: 'traffic:sources' },
        ],
        [
          { text: '🔍 Analytics', callbackData: 'traffic:analytics' },
          { text: '⚙️ Optimize', callbackData: 'traffic:optimize' },
        ],
        [
          { text: '📋 Reports', callbackData: 'traffic:reports' },
          { text: '⬅️ Back', callbackData: 'menu:main' },
        ],
      ],
      isInline: true,
    };
  }

  private generateStatisticsMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Statistics,
      title: 'Statistics 📈',
      description: 'View detailed performance metrics',
      buttons: [
        [
          { text: '📈 Overview', callbackData: 'stats:overview' },
          { text: '📅 Daily', callbackData: 'stats:daily' },
        ],
        [
          { text: '📅 Weekly', callbackData: 'stats:weekly' },
          { text: '📅 Monthly', callbackData: 'stats:monthly' },
        ],
        [
          { text: '📥 Export', callbackData: 'stats:export' },
          { text: '⬅️ Back', callbackData: 'menu:main' },
        ],
      ],
      isInline: true,
    };
  }

  private generateHelpMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Help,
      title: 'Help & Support ❓',
      description: 'Get assistance and learn more',
      buttons: [
        [
          { text: '📝 FAQ', callbackData: 'help:faq' },
          { text: '📞 Contact Support', callbackData: 'help:contact' },
        ],
        [
          { text: '📚 Tutorials', callbackData: 'help:tutorials' },
          { text: '📢 Updates', callbackData: 'help:updates' },
        ],
        [
          { text: '📜 Terms', callbackData: 'help:terms' },
          { text: '🔒 Privacy', callbackData: 'help:privacy' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateCampaignMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Campaign,
      title: 'Campaign Management 📋',
      description: 'Manage your marketing campaigns',
      buttons: [
        [
          { text: '➕ Create Campaign', callbackData: 'campaign:create' },
          { text: '📋 Active Campaigns', callbackData: 'campaign:active' },
        ],
        [
          { text: '📈 Performance', callbackData: 'campaign:performance' },
          { text: '⚙️ Settings', callbackData: 'campaign:settings' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateWithdrawalMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Withdrawal,
      title: 'Withdrawal 💸',
      description: 'Request and manage withdrawals',
      buttons: [
        [
          { text: '💸 Request Withdrawal', callbackData: 'withdrawal:request' },
          { text: '📋 History', callbackData: 'withdrawal:history' },
        ],
        [
          { text: '🏦 Payment Methods', callbackData: 'withdrawal:methods' },
          { text: '⚙️ Settings', callbackData: 'withdrawal:settings' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateReferralMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Referral,
      title: 'Referral Program 🤝',
      description: 'Earn by inviting others',
      buttons: [
        [
          { text: '🔗 My Link', callbackData: 'referral:link' },
          { text: '📈 Earnings', callbackData: 'referral:earnings' },
        ],
        [
          { text: '👥 Referrals', callbackData: 'referral:list' },
          { text: '🏆 Rewards', callbackData: 'referral:rewards' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateAdminMenu(_ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Admin,
      title: 'Admin Panel 🔧',
      description: 'Administrative functions',
      buttons: [
        [
          { text: '📈 System Stats', callbackData: 'admin:stats' },
          { text: '👥 User Management', callbackData: 'admin:users' },
        ],
        [
          { text: '⚙️ System Config', callbackData: 'admin:config' },
          { text: '📋 Logs', callbackData: 'admin:logs' },
        ],
        [{ text: '⬅️ Back', callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateDefaultMenu(_ctx: BotContext, menuType: MenuType): MenuConfig {
    return {
      type: menuType,
      title: 'Menu',
      description: 'Select an option',
      buttons: [[{ text: '⬅️ Back to Main', callbackData: 'menu:main' }]],
      isInline: true,
    };
  }

  private async processMenuAction(ctx: BotContext, action: string, params: string[]): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();

    switch (action) {
      case 'menu':
        return {
          success: true,
          nextMenu: params[0] as MenuType,
        };

      case 'back':
        if (userId) {
          const history = await this.getMenuHistory(userId);
          const previousMenu = history.length > 0 ? history[history.length - 1] : MenuType.Main;

          return {
            success: true,
            nextMenu: previousMenu,
          };
        }

        return {
          success: true,
          nextMenu: MenuType.Main,
        };

      default:
        // Handle specific action logic here
        return {
          success: false,
          message: `Action "${action}" is not implemented yet.`,
        };
    }
  }

  private async updateNavigationState(userId: string, menuType: MenuType): Promise<void> {
    try {
      const session = await this.sessionService.getSession(userId);
      const currentState = session?.data.navigationState;

      const newHistory = [...(currentState?.history || [])];

      // Add current location to history if different from new location
      if (currentState?.currentLocation && currentState.currentLocation !== menuType) {
        newHistory.push(currentState.currentLocation as MenuType);

        // Limit history size
        if (newHistory.length > this.maxHistoryLength) {
          newHistory.shift();
        }
      }

      await this.sessionService.updateSession(userId, {
        navigationState: {
          currentLocation: menuType,
          breadcrumb: [...(currentState?.breadcrumb || []), menuType],
          history: newHistory,
          metadata: {
            ...currentState?.metadata,
            lastNavigationAt: new Date().toISOString(),
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

  private formatMenuText(menuConfig: MenuConfig): string {
    let text = `<b>${menuConfig.title}</b>\n`;

    if (menuConfig.description) {
      text += `\n${menuConfig.description}\n`;
    }

    return text;
  }
}
