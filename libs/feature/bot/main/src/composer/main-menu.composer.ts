import { unknownToError } from '@app/common-shared';
import { Injectable, Logger } from '@nestjs/common';
import { Composer, InlineKeyboard } from 'grammy';
import { BotContext, CallbackUtil, MenuButton, MenuConfig, MenuType, SessionInterface } from '@app/feature-bot-shared';
import { SessionService } from '../service/session.service';
import { MenuService } from '../service/menu.service';
import { AuthUserService } from '@app/feature-auth-shared';
import { BalanceDto, BalanceService } from '@app/feature-balance-main';
import { UserEntity, UserRole, UserStatus } from '@app/database';

/**
 * Main Menu Composer
 *
 * Grammy-based composer for main menu UI composition and interactions.
 * Handles menu navigation, state management, and dynamic content generation
 * using Grammy's Composer patterns for modular bot functionality.
 *
 * @class MainMenuComposer
 */
@Injectable()
export class MainMenuComposer {
  private readonly logger = new Logger(MainMenuComposer.name);
  private composer: Composer<BotContext>;

  constructor(
    private readonly sessionService: SessionService,
    private readonly menuService: MenuService,
    private readonly authUserService: AuthUserService,
    private readonly balanceService: BalanceService,
  ) {
    this.composer = new Composer<BotContext>();
    this.setupComposer();
  }

  /**
   * Get the Grammy composer instance
   *
   * @returns Composer<BotContext> - Grammy composer instance
   */
  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  /**
   * Compose main menu with dynamic content
   *
   * @param ctx - Bot context for personalization
   * @returns Promise<MenuConfig> - Main menu configuration
   */
  async composeMainMenu(ctx: BotContext): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    if (!userId) {
      return this.getDefaultMainMenu(ctx);
    }

    this.logger.debug(`Composing dynamic main menu for user: ${userId}`);

    try {
      // Get user data and session
      const session = await this.sessionService.getOrCreateSession(userId);
      const user = await this.authUserService.findByPlatformId(userId);
      const balance = user ? await this.balanceService.getBalance(user.id) : null;

      // Personalize greeting
      const userName = ctx.from?.first_name || 'User';
      const greeting = this.getPersonalizedGreeting(userName, session?.data.preferences?.language || 'en');

      // Build dynamic menu based on user status
      const buttons = await this.buildMainMenuButtons(ctx, user || undefined, balance || undefined, session);

      return {
        type: MenuType.Main,
        title: greeting,
        description: this.getMainMenuDescription(user || undefined, balance || undefined),
        buttons,
        isInline: true,
        metadata: {
          userId,
          timestamp: Date.now(),
          hasBalance: !!balance,
          isActive: user?.status === UserStatus.Active,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error composing main menu', {
        error: unknownToError(err),
        userId,
      });

      return this.getDefaultMainMenu(ctx);
    }
  }

  /**
   * Compose quick actions menu with contextual actions
   *
   * @param ctx - Bot context
   * @returns Promise<MenuConfig> - Quick actions menu configuration
   */
  async composeQuickActionsMenu(ctx: BotContext): Promise<MenuConfig> {
    const userId = ctx.from?.id?.toString();
    this.logger.debug(`Composing quick actions menu for user: ${userId}`);

    try {
      const session = await this.sessionService.getSession(userId || '');
      const recentActions = (session?.data.cache?.recentActions as unknown[] | undefined) || [];
      const preferences = session?.data.preferences;

      // Build contextual quick actions
      const buttons: MenuButton[][] = [];

      // Most used actions first
      buttons.push([
        {
          text: '🚀 New Campaign',
          callbackData: CallbackUtil.createActionCallback('action', 'new_campaign'),
          metadata: { priority: 'high' },
        },
        {
          text: '📈 View Stats',
          callbackData: CallbackUtil.createActionCallback('action', 'view_stats'),
          metadata: { priority: 'high' },
        },
      ]);

      // Financial actions
      buttons.push([
        { text: '💰 Check Balance', callbackData: CallbackUtil.createActionCallback('action', 'check_balance') },
        { text: '💸 Quick Withdraw', callbackData: CallbackUtil.createActionCallback('action', 'quick_withdraw') },
      ]);

      // System actions
      buttons.push([
        { text: '🔄 Refresh Data', callbackData: CallbackUtil.createActionCallback('action', 'refresh_all') },
        { text: '📊 Dashboard', callbackData: CallbackUtil.createActionCallback('action', 'dashboard') },
      ]);

      // Recent actions (if any)
      if (recentActions.length > 0) {
        const recentButton = {
          text: '📋 Recent Actions',
          callbackData: CallbackUtil.createActionCallback('action', 'recent_actions'),
        };

        buttons.push([recentButton]);
      }

      // Navigation
      buttons.push([{ text: '🔙 Back to Main', callbackData: CallbackUtil.createMenuCallback('main', 'navigate') }]);

      return {
        type: MenuType.Main,
        title: '⚡ Quick Actions',
        description: 'Frequently used actions for faster workflow',
        buttons,
        isInline: true,
        metadata: {
          recentActionsCount: Array.isArray(recentActions) ? recentActions.length : 0,
          userPreferences: preferences,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Error composing quick actions menu', {
        error: unknownToError(err),
        userId,
      });

      return this.getDefaultQuickActionsMenu();
    }
  }

  /**
   * Customize menu based on user permissions, status, and preferences
   *
   * @param menu - Base menu configuration
   * @param ctx - Bot context with user info
   * @param user - User entity (optional)
   * @param session - User session (optional)
   * @returns Promise<MenuConfig> - Customized menu configuration
   */
  async customizeMenuForUser(
    menu: MenuConfig,
    ctx: BotContext,
    user?: UserEntity,
    session?: SessionInterface,
  ): Promise<MenuConfig> {
    const userId = ctx.from?.id;
    if (!userId) {
      return menu;
    }

    this.logger.debug(`Customizing menu for user: ${userId}`);

    try {
      const customizedMenu = { ...menu };

      // Apply user role-based customizations
      if (user) {
        customizedMenu.buttons = await this.applyRolePermissions(customizedMenu.buttons, user);

        // Admin features
        if (user.role !== UserRole.User) {
          customizedMenu.buttons = this.addAdminFeatures(customizedMenu.buttons);
        }
      }

      // Apply user preferences
      if (session?.data.preferences) {
        customizedMenu.buttons = this.applyUserPreferences(customizedMenu.buttons, session.data.preferences);
      }

      // Apply A/B testing variations
      customizedMenu.buttons = await this.applyABTestVariations(customizedMenu.buttons, userId.toString());

      // Add breadcrumb navigation if enabled
      if (session?.data.navigationState) {
        customizedMenu.buttons = this.addBreadcrumbNavigation(
          customizedMenu.buttons,
          session.data.navigationState as unknown as Record<string, unknown>,
        );
      }

      // Update metadata
      customizedMenu.metadata = {
        ...customizedMenu.metadata,
        customized: true,
        customizationTimestamp: Date.now(),
        userRole: user?.role,
        preferences: session?.data.preferences,
      };

      return customizedMenu;
    } catch (err: unknown) {
      this.logger.error('Error customizing menu for user', {
        error: unknownToError(err),
        userId,
      });

      return menu;
    }
  }

  /**
   * Add smart navigation buttons with context awareness
   *
   * @param menu - Menu configuration
   * @param navigationOptions - Navigation options
   * @returns MenuConfig - Menu with navigation buttons added
   */
  addNavigationButtons(
    menu: MenuConfig,
    navigationOptions: {
      showBack?: boolean;
      showHome?: boolean;
      showBreadcrumb?: boolean;
      customBack?: string;
      customHome?: string;
    } = {},
  ): MenuConfig {
    const { showBack = false, showHome = false, showBreadcrumb = false, customBack, customHome } = navigationOptions;

    const navigationRow: MenuButton[] = [];

    if (showBack) {
      navigationRow.push({
        text: '◀️ Back',
        callbackData: customBack || CallbackUtil.createActionCallback('action', 'back'),
        metadata: { action: 'navigation', type: 'back' },
      });
    }

    if (showHome) {
      navigationRow.push({
        text: '🏠 Home',
        callbackData: customHome || CallbackUtil.createMenuCallback('main', 'navigate'),
        metadata: { action: 'navigation', type: 'home' },
      });
    }

    if (showBreadcrumb) {
      navigationRow.push({
        text: '📍 Menu Path',
        callbackData: CallbackUtil.createActionCallback('action', 'breadcrumb'),
        metadata: { action: 'navigation', type: 'breadcrumb' },
      });
    }

    if (navigationRow.length > 0) {
      menu.buttons.push(navigationRow);
    }

    return menu;
  }

  /**
   * Create inline keyboard from menu configuration
   *
   * @param menuConfig - Menu configuration
   * @returns InlineKeyboard - Grammy InlineKeyboard instance
   */
  createInlineKeyboard(menuConfig: MenuConfig): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    menuConfig.buttons.forEach((row, rowIndex) => {
      if (rowIndex > 0) {
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
   * Setup Grammy composer with callback handlers
   */
  private setupComposer(): void {
    // Main menu navigation
    this.composer.callbackQuery('menu:main', (ctx) => this.handleMainMenu(ctx));
    this.composer.callbackQuery(/^menu:/, (ctx) => this.handleMenuNavigation(ctx));

    // Quick actions
    this.composer.callbackQuery(/^action:/, (ctx) => this.handleQuickAction(ctx));

    // Menu refresh and utilities
    this.composer.callbackQuery('refresh', (ctx) => this.handleRefresh(ctx));
    this.composer.callbackQuery('breadcrumb', (ctx) => this.handleBreadcrumb(ctx));

    // Menu state management
    this.composer.callbackQuery('menu_state:save', (ctx) => this.saveMenuState(ctx));
    this.composer.callbackQuery('menu_state:restore', (ctx) => this.restoreMenuState(ctx));
  }

  // Menu composition handlers for Grammy

  /**
   * Handle main menu display
   */
  private async handleMainMenu(ctx: BotContext): Promise<void> {
    try {
      const menuConfig = await this.composeMainMenu(ctx);
      const keyboard = this.createInlineKeyboard(menuConfig);

      const menuText = this.formatMenuText(menuConfig);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        await ctx.answerCallbackQuery('🏠 Main menu loaded');
      } else {
        await ctx.replyWithHTML(menuText, {
          reply_markup: keyboard,
        });
      }

      // Update navigation state
      const userId = ctx.from?.id?.toString();
      if (userId) {
        await this.updateMenuState(userId, MenuType.Main, menuConfig.metadata);
      }
    } catch (err: unknown) {
      this.logger.error('Error handling main menu', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Failed to load menu');
    }
  }

  /**
   * Handle menu navigation
   */
  private async handleMenuNavigation(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';
    const menuType = callbackData.split(':')[1] as MenuType;

    try {
      // Use the menu service for navigation
      await this.menuService.navigateToMenu(ctx, menuType);
      await ctx.answerCallbackQuery(`📱 Navigated to ${menuType}`);
    } catch (err: unknown) {
      this.logger.error('Error handling menu navigation', {
        error: unknownToError(err),
        menuType,
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Navigation failed');
    }
  }

  /**
   * Handle quick actions
   */
  private async handleQuickAction(ctx: BotContext): Promise<void> {
    const callbackData = ctx.callbackQuery?.data || '';
    const [, action] = callbackData.split(':');

    try {
      await this.processQuickAction(ctx, action);
      await ctx.answerCallbackQuery(`⚡ ${action} executed`);
    } catch (err: unknown) {
      this.logger.error('Error handling quick action', {
        error: unknownToError(err),
        action,
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Action failed');
    }
  }

  /**
   * Handle menu refresh
   */
  private async handleRefresh(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id?.toString();
      if (!userId) {
        return;
      }

      // Get current menu state
      const session = await this.sessionService.getSession(userId);
      const currentMenu = session?.data.navigationState?.currentLocation || MenuType.Main;

      // Refresh current menu
      if (currentMenu === MenuType.Main) {
        await this.handleMainMenu(ctx);
      } else {
        await this.menuService.navigateToMenu(ctx, currentMenu as MenuType);
      }

      await ctx.answerCallbackQuery('🔄 Menu refreshed');
    } catch (err: unknown) {
      this.logger.error('Error handling refresh', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Refresh failed');
    }
  }

  /**
   * Handle breadcrumb display
   */
  private async handleBreadcrumb(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id?.toString();
      if (!userId) {
        return;
      }

      const session = await this.sessionService.getSession(userId);
      const breadcrumb = session?.data.navigationState?.breadcrumb || [];

      const breadcrumbText =
        breadcrumb.length > 0 ? `📍 Navigation Path:\n${breadcrumb.join(' → ')}` : '📍 You are at the main menu';

      await ctx.answerCallbackQuery({ text: breadcrumbText, show_alert: true });
    } catch (err: unknown) {
      this.logger.error('Error handling breadcrumb', {
        error: unknownToError(err),
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('❌ Cannot show path');
    }
  }

  // Helper methods

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async buildMainMenuButtons(
    ctx: BotContext,
    user: UserEntity | undefined,
    balance: BalanceDto | undefined,
    session: SessionInterface | undefined,
  ): Promise<MenuButton[][]> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const buttons: MenuButton[][] = [];

    // Centralized menu layout:
    // Row 1: Sell Traffic | Buy Traffic
    buttons.push([
      {
        text: ctx.t('menu.main_menu.btn_sell_traffic'),
        callbackData: 'menu:sell_traffic',
        metadata: { feature: 'sell_traffic' },
      },
      {
        text: ctx.t('menu.main_menu.btn_buy_traffic'),
        callbackData: 'menu:buy_traffic',
        metadata: { feature: 'buy_traffic' },
      },
    ]);

    // Row 2: Profile | Balance
    buttons.push([
      {
        text: ctx.t('menu.main_menu.btn_profile'),
        callbackData: 'profile:view',
        metadata: { feature: 'profile' },
      },
      {
        text: balance
          ? `${ctx.t('menu.main_menu.btn_balance')} ($${balance.availableAmount.toFixed(2)})`
          : ctx.t('menu.main_menu.btn_balance'),
        callbackData: 'balance:view',
        metadata: { feature: 'balance', hasData: !!balance },
      },
    ]);

    // Row 3: Support
    buttons.push([
      {
        text: ctx.t('menu.main_menu.btn_support'),
        callbackData: 'menu:support',
        metadata: { feature: 'support' },
      },
    ]);

    return buttons;
  }

  private getDefaultMainMenu(ctx: BotContext): MenuConfig {
    const userName = ctx.from?.first_name || 'User';

    // Centralized menu layout:
    // Row 1: Sell Traffic | Buy Traffic
    // Row 2: Profile | Balance
    // Row 3: Support
    return {
      type: MenuType.Main,
      title: `Welcome, ${userName}! 🚀`,
      description: ctx.t('menu.main_menu.select_action'),
      buttons: [
        [
          { text: ctx.t('menu.main_menu.btn_sell_traffic'), callbackData: 'menu:sell_traffic' },
          { text: ctx.t('menu.main_menu.btn_buy_traffic'), callbackData: 'menu:buy_traffic' },
        ],
        [
          { text: ctx.t('menu.main_menu.btn_profile'), callbackData: 'profile:view' },
          { text: ctx.t('menu.main_menu.btn_balance'), callbackData: 'balance:view' },
        ],
        [{ text: ctx.t('menu.main_menu.btn_support'), callbackData: 'menu:support' }],
      ],
      isInline: true,
    };
  }

  private getDefaultQuickActionsMenu(): MenuConfig {
    return {
      type: MenuType.Main,
      title: '⚡ Quick Actions',
      description: 'Frequently used actions',
      buttons: [
        [
          { text: '📈 View Stats', callbackData: 'action:view_stats' },
          { text: '💰 Check Balance', callbackData: 'action:check_balance' },
        ],
        [
          { text: '🔄 Refresh', callbackData: 'action:refresh_all' },
          { text: '🔙 Back to Main', callbackData: 'menu:main' },
        ],
      ],
      isInline: true,
    };
  }

  private getPersonalizedGreeting(userName: string, language: string): string {
    const greetings: Record<string, string> = {
      en: `Welcome back, ${userName}! 🚀`,
      es: `¡Bienvenido de vuelta, ${userName}! 🚀`,
      fr: `Bon retour, ${userName}! 🚀`,
      de: `Willkommen zurück, ${userName}! 🚀`,
      ru: `С возвращением, ${userName}! 🚀`,
    };

    return greetings[language] || greetings.en;
  }

  private getMainMenuDescription(user?: UserEntity, balance?: BalanceDto): string {
    if (!user) {
      return 'Please register to access all features.';
    }

    const parts = [];

    if (balance && balance.availableAmount > 0) {
      parts.push(`Balance: $${balance.availableAmount.toFixed(2)}`);
    }

    if (user.status === UserStatus.Active) {
      parts.push('Account active ✅');
    } else {
      parts.push('Account restricted ⚠️');
    }

    return parts.join(' • ');
  }

  private async applyRolePermissions(buttons: MenuButton[][], user: UserEntity): Promise<MenuButton[][]> {
    // Filter buttons based on user permissions
    return buttons
      .filter((row) => row.some((button) => this.hasPermissionForButton(button, user)))
      .map((row) => row.filter((button) => this.hasPermissionForButton(button, user)));
  }

  private hasPermissionForButton(button: MenuButton, user: UserEntity): boolean {
    const feature = button.metadata?.feature;

    switch (feature) {
      case 'withdrawal':
        return user.status === UserStatus.Active;
      case 'admin':
        return user.role !== UserRole.User;
      default:
        return true;
    }
  }

  private addPremiumFeatures(buttons: MenuButton[][]): MenuButton[][] {
    // Add premium-only features
    const premiumRow = [
      {
        text: '👑 Premium Analytics',
        callbackData: CallbackUtil.createMenuCallback('premium_analytics', 'navigate'),
        metadata: { feature: 'premium', tier: 'premium' },
      },
    ];

    return [...buttons, premiumRow];
  }

  private addAdminFeatures(buttons: MenuButton[][]): MenuButton[][] {
    // Add admin-only features
    const adminRow = [
      {
        text: '🔧 Admin Panel',
        callbackData: CallbackUtil.createMenuCallback('admin', 'navigate'),
        metadata: { feature: 'admin', restricted: true },
      },
    ];

    return [...buttons, adminRow];
  }

  private applyUserPreferences(buttons: MenuButton[][], preferences: Record<string, unknown>): MenuButton[][] {
    // Apply user-specific preferences (hiding/showing features)
    return buttons.filter((row) => {
      return row.some((button) => {
        const feature = button.metadata?.feature as string | undefined;
        interface PreferencesWithHidden extends Record<string, unknown> {
          hiddenFeatures?: string[];
        }
        const hiddenFeatures = (preferences as PreferencesWithHidden)?.hiddenFeatures;

        return !feature || !hiddenFeatures?.includes(feature);
      });
    });
  }

  private async applyABTestVariations(buttons: MenuButton[][], userId: string): Promise<MenuButton[][]> {
    // Apply A/B test variations based on user ID hash
    const userHash = parseInt(userId) % 100;

    // Example: 50% of users see different button text
    if (userHash < 50) {
      return buttons.map((row) =>
        row.map((button) => {
          if (button.text.includes('Statistics')) {
            return { ...button, text: '📊 Analytics' };
          }

          return button;
        }),
      );
    }

    return buttons;
  }

  private addBreadcrumbNavigation(buttons: MenuButton[][], navigationState: Record<string, unknown>): MenuButton[][] {
    const breadcrumb = navigationState.breadcrumb as string[] | undefined;

    if (breadcrumb && breadcrumb.length > 0) {
      const breadcrumbRow = [
        {
          text: '📍 Show Path',
          callbackData: CallbackUtil.createActionCallback('action', 'breadcrumb'),
          metadata: { type: 'navigation', breadcrumb: true },
        },
      ];

      return [...buttons, breadcrumbRow];
    }

    return buttons;
  }

  private formatMenuText(menuConfig: MenuConfig): string {
    let text = `<b>${menuConfig.title}</b>`;

    if (menuConfig.description) {
      text += `\n\n${menuConfig.description}`;
    }

    return text;
  }

  private async updateMenuState(userId: string, menuType: MenuType, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.sessionService.updateSession(userId, {
        navigationState: {
          currentLocation: menuType,
          breadcrumb: [],
          history: [],
          metadata: {
            lastMenuUpdate: Date.now(),
            menuMetadata: metadata,
          },
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error updating menu state', {
        error: unknownToError(err),
        userId,
        menuType,
      });
    }
  }

  private async processQuickAction(ctx: BotContext, action: string): Promise<void> {
    switch (action) {
      case 'quick_menu': {
        const quickMenu = await this.composeQuickActionsMenu(ctx);
        const keyboard = this.createInlineKeyboard(quickMenu);
        await ctx.editMessageText(this.formatMenuText(quickMenu), {
          reply_markup: keyboard,
          parse_mode: 'HTML',
        });

        break;
      }

      case 'refresh_all':
        await this.handleRefresh(ctx);
        break;

      case 'check_balance':
        await this.menuService.navigateToMenu(ctx, MenuType.Balance);
        break;

      case 'view_stats':
        await this.menuService.navigateToMenu(ctx, MenuType.Statistics);
        break;

      default:
        await ctx.reply(`Action "${action}" is not implemented yet.`);
    }
  }

  private async saveMenuState(ctx: BotContext): Promise<void> {
    // Implementation for saving current menu state
    await ctx.answerCallbackQuery('Menu state saved');
  }

  private async restoreMenuState(ctx: BotContext): Promise<void> {
    // Implementation for restoring saved menu state
    await ctx.answerCallbackQuery('Menu state restored');
  }
}
