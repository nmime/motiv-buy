/**
 * Menu Action Handler
 *
 * Handles all bot menu actions and callback queries.
 * Provides routing and orchestration for menu interactions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { InlineKeyboard } from 'grammy';
import { BotValidationUtil } from '../util/bot-validation.util';
import { MessageService } from '../service/message.service';

export interface MenuAction {
  action: string;
  params?: Record<string, string>;
}

/**
 * Menu Action Handler Service
 */
@Injectable()
export class MenuActionHandler {
  private readonly logger = new Logger(MenuActionHandler.name);

  constructor(private readonly messageService: MessageService) {}

  /**
   * Parse callback data into action and parameters
   */
  parseCallbackData(data: string): MenuAction {
    try {
      const [action, ...paramParts] = data.split(':');
      const params: Record<string, string> = {};

      // Parse parameters in format key=value
      paramParts.forEach((part) => {
        const [key, value] = part.split('=');
        if (key && value) {
          params[key] = value;
        }
      });

      return { action, params };
    } catch (error) {
      this.logger.error('Failed to parse callback data', { data, error });

      return { action: 'unknown', params: {} };
    }
  }

  /**
   * Sanitize callback data to prevent injection attacks
   */
  sanitizeCallbackData(data: string): string {
    const validation = BotValidationUtil.sanitizeInput(data);

    return validation.substring(0, 64); // Telegram callback data max length
  }

  /**
   * Generate callback data string
   */
  generateCallbackData(action: string, params: Record<string, string> = {}): string {
    const paramString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join(':');

    const callbackData = paramString ? `${action}:${paramString}` : action;

    return this.sanitizeCallbackData(callbackData);
  }

  /**
   * Create main menu keyboard - centralized layout
   * Row 1: Sell Traffic | Buy Traffic
   * Row 2: Profile | Balance
   * Row 3: Support
   */
  createMainMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('menu.main_menu.btn_sell_traffic'), 'menu:sell_traffic')
      .text(ctx.t('menu.main_menu.btn_buy_traffic'), 'menu:buy_traffic')
      .row()
      .text(ctx.t('menu.main_menu.btn_profile'), 'profile:view')
      .text(ctx.t('menu.main_menu.btn_balance'), 'balance:view')
      .row()
      .text(ctx.t('menu.main_menu.btn_support'), 'menu:support');
  }

  /**
   * Create profile menu keyboard
   */
  createProfileMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard().text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create balance menu keyboard
   */
  createBalanceMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.history'), 'balance:history')
      .row()
      .text(ctx.t('balance.withdraw'), 'balance:withdraw')
      .text(ctx.t('balance.deposit'), 'balance:deposit')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create statistics menu keyboard
   */
  createStatisticsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('menu.stats.overview'), 'stats:overview')
      .text(ctx.t('menu.stats.detailed'), 'stats:detailed')
      .row()
      .text(ctx.t('menu.stats.traffic'), 'stats:traffic')
      .text(ctx.t('menu.stats.earnings'), 'stats:earnings')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create orders menu keyboard
   */
  createOrdersMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('orders.btn_active'), 'orders:active')
      .text(ctx.t('orders.btn_completed'), 'orders:completed')
      .row()
      .text(ctx.t('orders.btn_new'), 'orders:create')
      .text(ctx.t('orders.btn_search'), 'orders:search')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create settings menu keyboard
   */
  createSettingsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('menu.settings.language'), 'settings:language')
      .text(ctx.t('menu.settings.notifications'), 'settings:notifications')
      .row()
      .text(ctx.t('menu.settings.preferences'), 'settings:preferences')
      .text(ctx.t('menu.settings.privacy'), 'settings:privacy')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create referrals menu keyboard
   */
  createReferralsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('bot.referral.list'), 'referral:list')
      .text(ctx.t('bot.referral.link'), 'referral:link')
      .row()
      .text(ctx.t('bot.referral.earnings'), 'referral:earnings')
      .text(ctx.t('bot.referral.stats'), 'referral:stats')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create payments menu keyboard
   */
  createPaymentsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('payment.method'), 'payment:methods')
      .text(ctx.t('payment.payment_history'), 'payment:history')
      .row()
      .text(ctx.t('balance.withdraw'), 'payment:withdraw')
      .text(ctx.t('balance.top_up'), 'payment:topup')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create traffic menu keyboard
   */
  createTrafficMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('traffic.sources'), 'traffic:sources')
      .text(ctx.t('traffic.targets'), 'traffic:targets')
      .row()
      .text(ctx.t('menu.sell_traffic.btn_add_source'), 'traffic:sources:add')
      .text(ctx.t('common.buttons.add'), 'traffic:targets:add')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create traffic sources list keyboard
   */
  createTrafficSourcesKeyboard(
    ctx: BotContext,
    sources: Array<{ id: string; name: string; status: string }>,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    sources.forEach((source) => {
      const statusEmoji = source.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${source.name}`, `traffic:source:view:${source.id}`).row();
    });

    keyboard.text(ctx.t('sell_traffic.btn_add_source'), 'traffic:sources:add').row();
    keyboard.text(ctx.t('common.back'), 'menu:sell_traffic');

    return keyboard;
  }

  /**
   * Create traffic targets list keyboard
   */
  createTrafficTargetsKeyboard(
    ctx: BotContext,
    targets: Array<{ id: string; name: string; status: string }>,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    targets.forEach((target) => {
      const statusEmoji = target.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${target.name}`, `traffic:target:view:${target.id}`).row();
    });

    keyboard.text(ctx.t('common.buttons.add'), 'traffic:targets:add').row();
    keyboard.text(ctx.t('common.back'), 'menu:sell_traffic');

    return keyboard;
  }

  /**
   * Create traffic source detail keyboard
   */
  createTrafficSourceDetailKeyboard(ctx: BotContext, sourceId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.buttons.edit'), `traffic:source:edit:${sourceId}`)
      .text(ctx.t('traffic.toggle_status'), `traffic:source:toggle:${sourceId}`)
      .row()
      .text(ctx.t('common.statistics'), `traffic:source:stats:${sourceId}`)
      .text(ctx.t('common.buttons.delete'), `traffic:source:delete:${sourceId}`)
      .row()
      .text(ctx.t('common.back'), 'traffic:sources');
  }

  /**
   * Create traffic target detail keyboard
   */
  createTrafficTargetDetailKeyboard(ctx: BotContext, targetId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.buttons.edit'), `traffic:target:edit:${targetId}`)
      .text(ctx.t('traffic.toggle_status'), `traffic:target:toggle:${targetId}`)
      .row()
      .text(ctx.t('common.statistics'), `traffic:target:stats:${targetId}`)
      .text(ctx.t('common.buttons.delete'), `traffic:target:delete:${targetId}`)
      .row()
      .text(ctx.t('common.back'), 'traffic:targets');
  }

  /**
   * Create campaign menu keyboard
   */
  createCampaignMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('orders.btn_active'), 'campaign:active')
      .text(ctx.t('orders.btn_completed'), 'campaign:completed')
      .row()
      .text(ctx.t('orders.btn_new'), 'campaign:create')
      .text(ctx.t('menu.sell_traffic.btn_analytics'), 'campaign:analytics')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create profile stats menu keyboard
   */
  createProfileStatsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.overview'), 'profile:stats:overview')
      .text(ctx.t('balance.recent_activity'), 'profile:stats:activity')
      .row()
      .text(ctx.t('balance.earned'), 'profile:stats:earnings')
      .text(ctx.t('statistic.performance'), 'profile:stats:performance')
      .row()
      .text(ctx.t('common.back'), 'profile:view');
  }

  /**
   * Create profile security menu keyboard
   */
  createProfileSecurityMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('profile.password_change'), 'profile:password')
      .text(ctx.t('profile.email_security'), 'profile:email_security')
      .row()
      .text(ctx.t('bot.settings.two_fa'), 'profile:2fa')
      .text(ctx.t('bot.settings.login_history'), 'profile:login_history')
      .row()
      .text(ctx.t('common.back'), 'menu:profile');
  }

  /**
   * Create admin menu keyboard
   */
  createAdminMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.user'), 'admin:users')
      .text(ctx.t('common.statistics'), 'admin:stats')
      .row()
      .text(ctx.t('settings.title'), 'admin:settings')
      .text(ctx.t('bot.admin.logs'), 'admin:logs')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create data export menu keyboard
   */
  createExportMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('statistic.export_stats'), 'export:stats')
      .text(ctx.t('statistic.export_transactions'), 'export:transactions')
      .row()
      .text(ctx.t('statistic.export_orders'), 'export:orders')
      .text(ctx.t('statistic.export_profile'), 'export:profile')
      .row()
      .text(ctx.t('common.back'), 'menu:settings');
  }

  /**
   * Create withdrawal menu keyboard
   */
  createWithdrawalMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.withdraw'), 'withdrawal:create')
      .text(ctx.t('balance.history'), 'withdrawal:history')
      .row()
      .text(ctx.t('balance.withdrawal_methods'), 'withdrawal:methods')
      .text(ctx.t('balance.minimum_withdrawal'), 'withdrawal:limits')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create deposit menu keyboard
   */
  createDepositMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.deposit_info_title'), 'deposit:create')
      .text(ctx.t('balance.history'), 'deposit:history')
      .row()
      .text(ctx.t('payment.method'), 'deposit:methods')
      .text(ctx.t('bot.bonuses.title'), 'deposit:bonuses')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create back to menu button
   * @param returnTo - callback data for back navigation
   * @param text - button text (MUST be translated by caller using ctx.t())
   */
  createBackButton(returnTo: string, text: string): InlineKeyboard {
    return new InlineKeyboard().text(text, returnTo);
  }

  /**
   * Create pagination keyboard
   * @param ctx - Bot context for translation
   * @param currentPage - Current page number
   * @param totalPages - Total number of pages
   * @param actionPrefix - Action prefix for callback data
   */
  // eslint-disable-next-line sonarjs/no-invariant-returns
  createPaginationKeyboard(
    ctx: BotContext,
    currentPage: number,
    totalPages: number,
    actionPrefix: string,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (totalPages <= 1) {
      return keyboard;
    }

    const buttons: Array<{ text: string; data: string }> = [];

    if (currentPage > 1) {
      buttons.push({
        text: ctx.t('common.pagination.previous'),
        data: this.generateCallbackData(`${actionPrefix}:page`, { page: String(currentPage - 1) }),
      });
    }

    buttons.push({
      text: ctx.t('common.pagination.page_info', { current: currentPage, total: totalPages }),
      data: 'pagination:current',
    });

    if (currentPage < totalPages) {
      buttons.push({
        text: ctx.t('common.pagination.next'),
        data: this.generateCallbackData(`${actionPrefix}:page`, { page: String(currentPage + 1) }),
      });
    }

    buttons.forEach((btn) => keyboard.text(btn.text, btn.data));

    return keyboard;
  }

  /**
   * Create confirmation keyboard
   * @param ctx - Bot context for translation
   * @param action - Action for callback data
   * @param params - Additional params for callback data
   */
  createConfirmationKeyboard(ctx: BotContext, action: string, params: Record<string, string> = {}): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), this.generateCallbackData(`${action}:confirm`, params))
      .text(ctx.t('common.buttons.cancel'), this.generateCallbackData(`${action}:cancel`, params));
  }

  /**
   * Validate menu access for user
   */
  async validateMenuAccess(ctx: BotContext, requiredRole?: string): Promise<boolean> {
    if (!isAuthenticated(ctx)) {
      await this.messageService.sendNewMessage(ctx, {
        text: ctx.t('common.errors.authentication_required', {
          default: 'Authentication required. Please use /start to begin.',
        }),
      });

      return false;
    }

    // If no specific role required, allow access
    if (!requiredRole) {
      return true;
    }

    // Admin users have access to all menus
    const isAdmin = ctx.user.role === 'admin' || ctx.user.role === 'super_admin';
    if (isAdmin) {
      return true;
    }

    // Check if user has the required role
    const hasRequiredRole = ctx.user.role === requiredRole;

    if (!hasRequiredRole) {
      await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.no_permission') });
    }

    return hasRequiredRole;
  }

  /**
   * Handle menu navigation error
   */
  async handleMenuError(ctx: BotContext, error: Error): Promise<void> {
    this.logger.error('Menu navigation error', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id,
    });

    await this.messageService.sendNewMessage(ctx, { text: ctx.t('common.errors.operation_failed') });
  }

  /**
   * Format user-friendly error message
   */
  formatErrorMessage(ctx: BotContext, error: Error): string {
    // Map technical errors to user-friendly locale keys
    const errorKeyMap: Record<string, string> = {
      USER_NOT_FOUND: 'common.errors.user_not_found',
      INSUFFICIENT_BALANCE: 'common.errors.insufficient_funds',
      INVALID_INPUT: 'common.errors.invalid_input',
      OPERATION_FAILED: 'common.errors.operation_failed',
      UNAUTHORIZED: 'common.errors.unauthorized',
      RATE_LIMIT_EXCEEDED: 'common.errors.rate_limit',
    };

    const localeKey = errorKeyMap[error.message];

    return localeKey ? ctx.t(localeKey) : ctx.t('common.unknown_error');
  }
}
