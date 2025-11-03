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

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);

  constructor(
    private readonly menuHandler: MenuActionHandler,
    private readonly profileHandler: ProfileActionHandler,
    private readonly balanceHandler: BalanceActionHandler,
    private readonly statisticsHandler: StatisticsActionHandler,
    private readonly orderHandler: OrderActionHandler,
    private readonly settingsHandler: SettingsActionHandler,
    private readonly rateLimitMiddleware: RateLimitMiddleware,
  ) {}

  /**
   * Route callback query to appropriate handler
   */
  async routeCallback(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
      return;
    }

    const data = ctx.callbackQuery.data;

    try {
      // Check rate limit
      const isAllowed = await this.rateLimitMiddleware.checkRateLimit(ctx, 'callback');

      if (!isAllowed) {
        await ctx.answerCallbackQuery('Rate limit exceeded');
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

      // Route to appropriate handler based on primary action
      switch (primaryAction) {
        case 'menu':
          await this.routeMenuAction(ctx, secondaryAction);
          break;

        case 'profile':
          await this.routeProfileAction(ctx, secondaryAction, params);
          break;

        case 'balance':
          await this.routeBalanceAction(ctx, secondaryAction, params);
          break;

        case 'stats':
          await this.routeStatisticsAction(ctx, secondaryAction);
          break;

        case 'orders':
          await this.routeOrderAction(ctx, secondaryAction, params);
          break;

        case 'order':
          await this.routeOrderAction(ctx, secondaryAction, params);
          break;

        case 'settings':
          await this.routeSettingsAction(ctx, secondaryAction, params);
          break;

        case 'referral':
          await this.handleReferralAction(ctx, secondaryAction);
          break;

        case 'payment':
          await this.handlePaymentAction(ctx, secondaryAction);
          break;

        case 'deposit':
          await this.handleDepositAction(ctx, secondaryAction);
          break;

        case 'withdraw':
          await this.handleWithdrawalAction(ctx, secondaryAction, params);
          break;

        default:
          await ctx.answerCallbackQuery('Unknown action');
          await ctx.reply('Unknown action. Please try again or use /menu.');
      }

      // Answer callback query to remove loading state
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error routing callback', {
        error: error instanceof Error ? error.message : String(error),
        data,
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery('Error occurred');
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Route menu actions
   */
  private async routeMenuAction(ctx: BotContext, action: string): Promise<void> {
    switch (action) {
      case 'main':
        await this.handleMainMenu(ctx);
        break;
      case 'profile':
        await this.profileHandler.handleProfileView(ctx);
        break;
      case 'balance':
        await this.balanceHandler.handleBalanceView(ctx);
        break;
      case 'statistics':
        await this.statisticsHandler.handleStatisticsOverview(ctx);
        break;
      case 'orders':
        await this.handleOrdersMenu(ctx);
        break;
      case 'settings':
        await this.settingsHandler.handleSettingsView(ctx);
        break;
      case 'referrals':
        await this.handleReferralsMenu(ctx);
        break;
      case 'payments':
        await this.handlePaymentsMenu(ctx);
        break;
      case 'support':
        await this.handleSupportMenu(ctx);
        break;
      case 'help':
        await this.handleHelpMenu(ctx);
        break;
      default:
        await ctx.reply('Unknown menu action');
    }
  }

  /**
   * Route profile actions
   */
  private async routeProfileAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'edit':
        if (params.length > 0) {
          // Handle specific field edit
          await ctx.reply(`Please enter your new ${params[0]}:`);
          if (ctx.session) {
            ctx.session.conversationState = 'profile_edit_field';
            ctx.session.formData = { field: params[0] };
          }
        } else {
          await this.profileHandler.handleProfileEditStart(ctx);
        }
        break;
      case 'details':
        await this.profileHandler.handleProfileDetails(ctx);
        break;
      case 'verify':
        await this.profileHandler.handleVerification(ctx);
        break;
      default:
        await this.profileHandler.handleProfileView(ctx);
    }
  }

  /**
   * Route balance actions
   */
  private async routeBalanceAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'view':
        await this.balanceHandler.handleBalanceView(ctx);
        break;
      case 'history':
        const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
        await this.balanceHandler.handleTransactionHistory(ctx, page);
        break;
      case 'withdraw':
        await this.balanceHandler.handleWithdrawalStart(ctx);
        break;
      case 'deposit':
        await this.balanceHandler.handleDepositStart(ctx);
        break;
      default:
        await this.balanceHandler.handleBalanceView(ctx);
    }
  }

  /**
   * Route statistics actions
   */
  private async routeStatisticsAction(ctx: BotContext, action: string): Promise<void> {
    switch (action) {
      case 'overview':
        await this.statisticsHandler.handleStatisticsOverview(ctx);
        break;
      case 'detailed':
        await this.statisticsHandler.handleDetailedStatistics(ctx);
        break;
      case 'traffic':
        await this.statisticsHandler.handleTrafficStatistics(ctx);
        break;
      case 'earnings':
        await this.statisticsHandler.handleEarningsStatistics(ctx);
        break;
      default:
        await this.statisticsHandler.handleStatisticsOverview(ctx);
    }
  }

  /**
   * Route order actions
   */
  private async routeOrderAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'active':
        const activePage = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
        await this.orderHandler.handleActiveOrders(ctx, activePage);
        break;
      case 'completed':
        const completedPage = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
        await this.orderHandler.handleCompletedOrders(ctx, completedPage);
        break;
      case 'create':
        await this.orderHandler.handleCreateOrderStart(ctx);
        break;
      case 'search':
        await this.orderHandler.handleOrderSearch(ctx);
        break;
      case 'details':
        if (params.length > 0) {
          await this.orderHandler.handleOrderDetails(ctx, params[0]);
        }
        break;
      default:
        await this.handleOrdersMenu(ctx);
    }
  }

  /**
   * Route settings actions
   */
  private async routeSettingsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'language':
        await this.settingsHandler.handleLanguageSettings(ctx);
        break;
      case 'lang':
        if (params.length > 0) {
          await this.settingsHandler.handleLanguageChange(ctx, params[0]);
        }
        break;
      case 'notifications':
        await this.settingsHandler.handleNotificationSettings(ctx);
        break;
      case 'notify':
        if (params.length > 0) {
          await this.settingsHandler.handleNotificationToggle(ctx, params[0]);
        }
        break;
      case 'preferences':
        await this.settingsHandler.handlePreferencesSettings(ctx);
        break;
      case 'privacy':
        await this.settingsHandler.handlePrivacySettings(ctx);
        break;
      default:
        await this.settingsHandler.handleSettingsView(ctx);
    }
  }

  // Placeholder methods for additional features

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createMainMenuKeyboard();
    await ctx.reply('📋 <b>Main Menu</b>\n\nSelect an option:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handleOrdersMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createOrdersMenuKeyboard();
    await ctx.reply('📦 <b>Orders Menu</b>\n\nManage your traffic orders:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handleReferralsMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createReferralsMenuKeyboard();
    await ctx.reply('🎁 <b>Referrals Menu</b>\n\nView and manage your referrals:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handlePaymentsMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createPaymentsMenuKeyboard();
    await ctx.reply('💳 <b>Payments Menu</b>\n\nManage your payments:', {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handleSupportMenu(ctx: BotContext): Promise<void> {
    await ctx.reply(
      '📞 <b>Support</b>\n\n' +
        'Need help? Here are your options:\n\n' +
        '• Email: support@motivbuy.com\n' +
        '• Telegram: @motivbuy_support\n' +
        '• FAQ: /faq\n\n' +
        '<i>We typically respond within 24 hours.</i>',
      { parse_mode: 'HTML' },
    );
  }

  private async handleHelpMenu(ctx: BotContext): Promise<void> {
    const helpText = `
🤖 <b>MotivBuy Bot Help</b>

<b>Available Commands:</b>
/start - Start or restart the bot
/menu - Open main menu
/profile - View your profile
/balance - Check your balance
/settings - Manage settings
/help - Show this help message

<b>Features:</b>
• 📊 Track campaign performance
• 💰 Monitor earnings and balance
• 🎯 Manage traffic sources
• ⚙️ Customize preferences
• 📈 View detailed statistics

For support, contact @support or use /support.
`;

    await ctx.replyWithHTML(helpText);
  }

  private async handleReferralAction(ctx: BotContext, action: string): Promise<void> {
    await ctx.reply('🎁 Referral features coming soon!');
  }

  private async handlePaymentAction(ctx: BotContext, action: string): Promise<void> {
    await ctx.reply('💳 Payment features coming soon!');
  }

  private async handleDepositAction(ctx: BotContext, action: string): Promise<void> {
    await ctx.reply('💰 Deposit features coming soon!');
  }

  private async handleWithdrawalAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    await ctx.reply('💸 Withdrawal features coming soon!');
  }
}
