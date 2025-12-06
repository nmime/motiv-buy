import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { BotContext, MenuActionResult, MenuButton, MenuConfig, MenuType } from '@app/feature-bot-shared';
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
  private readonly menuGenerators: Map<MenuType, (ctx: BotContext) => MenuConfig>;

  constructor(private readonly sessionService: SessionService) {
    this.menuGenerators = new Map([
      [MenuType.Main, (ctx) => this.generateMainMenu(ctx)],
      [MenuType.Profile, (ctx) => this.generateProfileMenu(ctx)],
      [MenuType.Settings, (ctx) => this.generateSettingsMenu(ctx)],
      [MenuType.Balance, (ctx) => this.generateBalanceMenu(ctx)],
      [MenuType.Traffic, (ctx) => this.generateTrafficMenu(ctx)],
      [MenuType.Statistics, (ctx) => this.generateStatisticsMenu(ctx)],
      [MenuType.Help, (ctx) => this.generateHelpMenu(ctx)],
      [MenuType.Campaign, (ctx) => this.generateCampaignMenu(ctx)],
      [MenuType.Withdrawal, (ctx) => this.generateWithdrawalMenu(ctx)],
      [MenuType.Referral, (ctx) => this.generateReferralMenu(ctx)],
      [MenuType.Admin, (ctx) => this.generateAdminMenu(ctx)],
    ]);
  }

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

    const generator = this.menuGenerators.get(menuType);

    return generator ? generator(ctx) : this.generateDefaultMenu(ctx, menuType);
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
        await ctx.reply(actionResult.message || ctx.t('common.errors.operation_failed'));
      }
    } catch (err: unknown) {
      this.logger.error(`Error handling menu action: ${callbackData}`, {
        error: unknownToError(err),
        userId: ctx.from?.id,
        callbackData,
      });

      await ctx.reply(ctx.t('common.errors.operation_failed'));
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
        await ctx.reply(ctx.t('common.errors.authentication_required'));

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

      await ctx.reply(ctx.t('common.errors.operation_failed'));
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
      await ctx.reply(ctx.t('common.errors.authentication_required'));

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
    const userName = ctx.from?.first_name || ctx.t('common.user');

    return {
      type: MenuType.Main,
      title: ctx.t('bot.commands.welcome_back', { name: userName }),
      description: ctx.t('bot.commands.use_menu'),
      buttons: [
        [
          { text: ctx.t('bot.menu.statistics'), callbackData: 'menu:statistics' },
          { text: ctx.t('bot.menu.balance.title'), callbackData: 'menu:balance' },
        ],
        [
          { text: ctx.t('bot.menu.traffic.title'), callbackData: 'menu:traffic' },
          { text: ctx.t('bot.menu.campaign'), callbackData: 'menu:campaign' },
        ],
        [
          { text: ctx.t('bot.menu.profile.title'), callbackData: 'menu:profile' },
          { text: ctx.t('bot.menu.settings.title'), callbackData: 'menu:settings' },
        ],
        [
          { text: ctx.t('bot.menu.withdrawal'), callbackData: 'menu:withdrawal' },
          { text: ctx.t('bot.menu.referral'), callbackData: 'menu:referral' },
        ],
        [{ text: ctx.t('bot.menu.help.title'), callbackData: 'menu:help' }],
      ],
      isInline: true,
    };
  }

  private generateProfileMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Profile,
      title: ctx.t('profile.title'),
      description: ctx.t('profile.manage_hint'),
      buttons: [
        [
          { text: ctx.t('profile.details_title'), callbackData: 'profile:details' },
          { text: ctx.t('profile.referrals'), callbackData: 'profile:stats' },
        ],
        [
          { text: ctx.t('profile.security_menu'), callbackData: 'profile:security' },
          { text: ctx.t('settings.notifications'), callbackData: 'menu:notifications' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateSettingsMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Settings,
      title: ctx.t('bot.menu.settings.title'),
      description: ctx.t('settings.use_buttons'),
      buttons: [
        [
          { text: ctx.t('settings.language_title'), callbackData: 'settings:language' },
          { text: ctx.t('settings.notification_title'), callbackData: 'settings:notifications' },
        ],
        [
          { text: ctx.t('settings.theme'), callbackData: 'settings:theme' },
          { text: ctx.t('settings.privacy_title'), callbackData: 'settings:privacy' },
        ],
        [
          { text: ctx.t('settings.export_data'), callbackData: 'settings:export' },
          { text: ctx.t('settings.reset_settings'), callbackData: 'settings:reset' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateBalanceMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Balance,
      title: ctx.t('bot.menu.balance.title'),
      description: ctx.t('balance.view_description'),
      buttons: [
        [{ text: ctx.t('balance.history_title'), callbackData: 'balance:history' }],
        [
          { text: ctx.t('balance.withdraw'), callbackData: 'menu:withdrawal' },
          { text: ctx.t('balance.deposit'), callbackData: 'balance:deposit' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateTrafficMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Traffic,
      title: ctx.t('traffic.management_title'),
      description: ctx.t('traffic.your_sources'),
      buttons: [
        [
          { text: ctx.t('bot.menu.traffic.live_coming_soon'), callbackData: 'traffic:live' },
          { text: ctx.t('traffic.sources'), callbackData: 'traffic:sources' },
        ],
        [
          { text: ctx.t('bot.menu.traffic.analytics_coming_soon'), callbackData: 'traffic:analytics' },
          { text: ctx.t('bot.menu.traffic.optimize_coming_soon'), callbackData: 'traffic:optimize' },
        ],
        [
          { text: ctx.t('traffic.orders'), callbackData: 'traffic:reports' },
          { text: ctx.t('common.buttons.back'), callbackData: 'menu:main' },
        ],
      ],
      isInline: true,
    };
  }

  private generateStatisticsMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Statistics,
      title: ctx.t('statistic.title'),
      description: ctx.t('statistic.select_option'),
      buttons: [
        [
          { text: ctx.t('statistic.overview_title'), callbackData: 'stats:overview' },
          { text: ctx.t('statistic.daily'), callbackData: 'stats:daily' },
        ],
        [
          { text: ctx.t('statistic.weekly'), callbackData: 'stats:weekly' },
          { text: ctx.t('statistic.monthly'), callbackData: 'stats:monthly' },
        ],
        [
          { text: ctx.t('statistic.export_statistics'), callbackData: 'stats:export' },
          { text: ctx.t('common.buttons.back'), callbackData: 'menu:main' },
        ],
      ],
      isInline: true,
    };
  }

  private generateHelpMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Help,
      title: ctx.t('bot.commands.help_title'),
      description: ctx.t('bot.commands.help_intro'),
      buttons: [
        [
          { text: ctx.t('bot.menu.help.faq_coming_soon'), callbackData: 'help:faq' },
          { text: ctx.t('bot.menu.support'), callbackData: 'help:contact' },
        ],
        [
          { text: ctx.t('bot.menu.help.tutorials_coming_soon'), callbackData: 'help:tutorials' },
          { text: ctx.t('common.overview'), callbackData: 'help:updates' },
        ],
        [
          { text: ctx.t('common.menu'), callbackData: 'help:terms' },
          { text: ctx.t('settings.privacy'), callbackData: 'help:privacy' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateCampaignMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Campaign,
      title: ctx.t('bot.menu.campaign'),
      description: ctx.t('orders.type_selection'),
      buttons: [
        [
          { text: ctx.t('common.buttons.create'), callbackData: 'campaign:create' },
          { text: ctx.t('orders.btn_active'), callbackData: 'campaign:active' },
        ],
        [
          { text: ctx.t('statistic.performance'), callbackData: 'campaign:performance' },
          { text: ctx.t('bot.menu.settings.title'), callbackData: 'campaign:settings' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateWithdrawalMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Withdrawal,
      title: ctx.t('bot.menu.withdrawal'),
      description: ctx.t('balance.withdraw_description'),
      buttons: [
        [
          { text: ctx.t('balance.withdraw'), callbackData: 'withdrawal:request' },
          { text: ctx.t('balance.history_title'), callbackData: 'withdrawal:history' },
        ],
        [
          { text: ctx.t('balance.payment_methods'), callbackData: 'withdrawal:methods' },
          { text: ctx.t('bot.menu.settings.title'), callbackData: 'withdrawal:settings' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateReferralMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Referral,
      title: ctx.t('bot.menu.referral'),
      description: ctx.t('referral.invite_description'),
      buttons: [
        [
          { text: ctx.t('referral.my_link'), callbackData: 'referral:link' },
          { text: ctx.t('referral.earnings'), callbackData: 'referral:earnings' },
        ],
        [
          { text: ctx.t('referral.my_referrals'), callbackData: 'referral:list' },
          { text: ctx.t('referral.rewards'), callbackData: 'referral:rewards' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateAdminMenu(ctx: BotContext): MenuConfig {
    return {
      type: MenuType.Admin,
      title: ctx.t('admin.title'),
      description: ctx.t('admin.description'),
      buttons: [
        [
          { text: ctx.t('admin.system_stats'), callbackData: 'admin:stats' },
          { text: ctx.t('admin.user_management'), callbackData: 'admin:users' },
        ],
        [
          { text: ctx.t('admin.system_config'), callbackData: 'admin:config' },
          { text: ctx.t('admin.logs'), callbackData: 'admin:logs' },
        ],
        [{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }],
      ],
      isInline: true,
    };
  }

  private generateDefaultMenu(ctx: BotContext, menuType: MenuType): MenuConfig {
    return {
      type: menuType,
      title: ctx.t('common.menu'),
      description: ctx.t('common.select_action'),
      buttons: [[{ text: ctx.t('common.buttons.back'), callbackData: 'menu:main' }]],
      isInline: true,
    };
  }

  private async processMenuAction(ctx: BotContext, action: string, params: string[]): Promise<MenuActionResult> {
    const userId = ctx.from?.id?.toString();

    const actionHandlers: Record<string, () => Promise<MenuActionResult>> = {
      menu: async () => ({
        success: true,
        nextMenu: params[0] as MenuType,
      }),
      back: async () => {
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
      },
    };

    const handler = actionHandlers[action];

    if (handler) {
      return handler();
    }

    // Default: Handle specific action logic here
    return {
      success: false,
      message: ctx.t('common.errors.feature_coming_soon'),
    };
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
