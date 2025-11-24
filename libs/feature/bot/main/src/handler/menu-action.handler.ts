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
   * Create main menu keyboard - 5 buttons matching callback-router.handler.ts
   */
  createMainMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('menu.main_menu.btn_buy_subscribers'), 'menu:buy_traffic')
      .text(ctx.t('menu.main_menu.btn_sell_traffic'), 'menu:sell_traffic')
      .row()
      .text(ctx.t('menu.main_menu.btn_balance'), 'balance:view')
      .text(ctx.t('menu.main_menu.btn_profile'), 'profile:view')
      .row()
      .text(ctx.t('menu.main_menu.btn_support'), 'menu:support');
  }

  /**
   * Create profile menu keyboard
   */
  createProfileMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('profile.profile.edit'), 'profile:edit')
      .text(ctx.t('profile.profile.details'), 'profile:details')
      .row()
      .text(ctx.t('profile.profile.verify'), 'profile:verify')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create balance menu keyboard
   */
  createBalanceMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.balance.view'), 'balance:view')
      .text(ctx.t('balance.balance.history'), 'balance:history')
      .row()
      .text(ctx.t('balance.balance.withdraw'), 'balance:withdraw')
      .text(ctx.t('balance.balance.deposit'), 'balance:deposit')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create statistics menu keyboard
   */
  createStatisticsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('menu.menu.stats.overview'), 'stats:overview')
      .text(ctx.t('menu.menu.stats.detailed'), 'stats:detailed')
      .row()
      .text(ctx.t('menu.menu.stats.traffic'), 'stats:traffic')
      .text(ctx.t('menu.menu.stats.earnings'), 'stats:earnings')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create orders menu keyboard
   */
  createOrdersMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('orders.orders.active'), 'orders:active')
      .text(ctx.t('orders.orders.completed'), 'orders:completed')
      .row()
      .text(ctx.t('orders.orders.create'), 'orders:create')
      .text(ctx.t('orders.orders.search'), 'orders:search')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create settings menu keyboard
   */
  createSettingsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('settings.settings.language'), 'settings:language')
      .text(ctx.t('settings.settings.notifications'), 'settings:notifications')
      .row()
      .text(ctx.t('settings.settings.preferences'), 'settings:preferences')
      .text(ctx.t('settings.settings.privacy'), 'settings:privacy')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create referrals menu keyboard
   */
  createReferralsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('user.user.referral.list'), 'referral:list')
      .text(ctx.t('user.user.referral.link'), 'referral:link')
      .row()
      .text(ctx.t('user.user.referral.earnings'), 'referral:earnings')
      .text(ctx.t('user.user.referral.stats'), 'referral:stats')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create payments menu keyboard
   */
  createPaymentsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('payment.payment.methods'), 'payment:methods')
      .text(ctx.t('payment.payment.history'), 'payment:history')
      .row()
      .text(ctx.t('payment.payment.withdraw'), 'payment:withdraw')
      .text(ctx.t('payment.payment.topup'), 'payment:topup')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create traffic menu keyboard
   */
  createTrafficMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('traffic.traffic.sources'), 'traffic:sources')
      .text(ctx.t('traffic.traffic.targets'), 'traffic:targets')
      .row()
      .text(ctx.t('traffic.traffic.add_source'), 'traffic:sources:add')
      .text(ctx.t('traffic.traffic.add_target'), 'traffic:targets:add')
      .row()
      .text(ctx.t('traffic.traffic.analytics'), 'traffic:analytics')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create traffic sources list keyboard
   */
  createTrafficSourcesKeyboard(ctx: BotContext, sources: Array<{ id: string; name: string; status: string }>): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    sources.forEach((source) => {
      const statusEmoji = source.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${source.name}`, `traffic:source:view:${source.id}`).row();
    });

    keyboard.text(ctx.t('traffic.traffic.add_source'), 'traffic:sources:add').row();
    keyboard.text(ctx.t('common.common.back'), 'menu:traffic');

    return keyboard;
  }

  /**
   * Create traffic targets list keyboard
   */
  createTrafficTargetsKeyboard(ctx: BotContext, targets: Array<{ id: string; name: string; status: string }>): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    targets.forEach((target) => {
      const statusEmoji = target.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${target.name}`, `traffic:target:view:${target.id}`).row();
    });

    keyboard.text(ctx.t('traffic.traffic.add_target'), 'traffic:targets:add').row();
    keyboard.text(ctx.t('common.common.back'), 'menu:traffic');

    return keyboard;
  }

  /**
   * Create traffic source detail keyboard
   */
  createTrafficSourceDetailKeyboard(ctx: BotContext, sourceId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.buttons.edit'), `traffic:source:edit:${sourceId}`)
      .text(ctx.t('traffic.traffic.toggle_status'), `traffic:source:toggle:${sourceId}`)
      .row()
      .text(ctx.t('common.common.statistics'), `traffic:source:stats:${sourceId}`)
      .text(ctx.t('common.buttons.delete'), `traffic:source:delete:${sourceId}`)
      .row()
      .text(ctx.t('traffic.traffic.back_to_sources'), 'traffic:sources');
  }

  /**
   * Create traffic target detail keyboard
   */
  createTrafficTargetDetailKeyboard(ctx: BotContext, targetId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.buttons.edit'), `traffic:target:edit:${targetId}`)
      .text(ctx.t('traffic.traffic.toggle_status'), `traffic:target:toggle:${targetId}`)
      .row()
      .text(ctx.t('common.common.statistics'), `traffic:target:stats:${targetId}`)
      .text(ctx.t('common.buttons.delete'), `traffic:target:delete:${targetId}`)
      .row()
      .text(ctx.t('traffic.traffic.back_to_targets'), 'traffic:targets');
  }

  /**
   * Create campaign menu keyboard
   */
  createCampaignMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('orders.orders.active'), 'campaign:active')
      .text(ctx.t('orders.orders.completed'), 'campaign:completed')
      .row()
      .text(ctx.t('orders.orders.create'), 'campaign:create')
      .text(ctx.t('traffic.traffic.analytics'), 'campaign:analytics')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create profile stats menu keyboard
   */
  createProfileStatsMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('common.common.overview'), 'profile:stats:overview')
      .text(ctx.t('profile.profile.activity'), 'profile:stats:activity')
      .row()
      .text(ctx.t('profile.profile.earnings'), 'profile:stats:earnings')
      .text(ctx.t('profile.profile.performance'), 'profile:stats:performance')
      .row()
      .text(ctx.t('profile.profile.back_to_profile'), 'profile:view');
  }

  /**
   * Create profile security menu keyboard
   */
  createProfileSecurityMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('profile.profile.change_password'), 'profile:password')
      .text(ctx.t('profile.profile.email_security'), 'profile:email_security')
      .row()
      .text(ctx.t('profile.profile.two_fa'), 'profile:2fa')
      .text(ctx.t('profile.profile.login_history'), 'profile:login_history')
      .row()
      .text(ctx.t('profile.profile.back_to_profile'), 'menu:profile');
  }

  /**
   * Create admin menu keyboard
   */
  createAdminMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('user.user.users'), 'admin:users')
      .text(ctx.t('common.common.statistics'), 'admin:stats')
      .row()
      .text(ctx.t('settings.settings.title'), 'admin:settings')
      .text(ctx.t('settings.settings.logs'), 'admin:logs')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create data export menu keyboard
   */
  createExportMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('settings.settings.export_stats'), 'export:stats')
      .text(ctx.t('settings.settings.export_transactions'), 'export:transactions')
      .row()
      .text(ctx.t('settings.settings.export_orders'), 'export:orders')
      .text(ctx.t('settings.settings.export_profile'), 'export:profile')
      .row()
      .text(ctx.t('settings.settings.back_to_settings'), 'menu:settings');
  }

  /**
   * Create withdrawal menu keyboard
   */
  createWithdrawalMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.balance.new_withdrawal'), 'withdrawal:create')
      .text(ctx.t('balance.balance.history'), 'withdrawal:history')
      .row()
      .text(ctx.t('balance.balance.methods'), 'withdrawal:methods')
      .text(ctx.t('balance.balance.limits'), 'withdrawal:limits')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
  }

  /**
   * Create deposit menu keyboard
   */
  createDepositMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('balance.balance.add_funds'), 'deposit:create')
      .text(ctx.t('balance.balance.history'), 'deposit:history')
      .row()
      .text(ctx.t('balance.balance.methods'), 'deposit:methods')
      .text(ctx.t('balance.balance.bonuses'), 'deposit:bonuses')
      .row()
      .text(ctx.t('common.common.back_to_menu'), 'menu:main');
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
   */
  // eslint-disable-next-line sonarjs/no-invariant-returns
  createPaginationKeyboard(currentPage: number, totalPages: number, actionPrefix: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    if (totalPages <= 1) {
      return keyboard;
    }

    const buttons: Array<{ text: string; data: string }> = [];

    if (currentPage > 1) {
      buttons.push({
        text: '« Previous',
        data: this.generateCallbackData(`${actionPrefix}:page`, { page: String(currentPage - 1) }),
      });
    }

    buttons.push({
      text: `${currentPage}/${totalPages}`,
      data: 'pagination:current',
    });

    if (currentPage < totalPages) {
      buttons.push({
        text: 'Next »',
        data: this.generateCallbackData(`${actionPrefix}:page`, { page: String(currentPage + 1) }),
      });
    }

    buttons.forEach((btn) => keyboard.text(btn.text, btn.data));

    return keyboard;
  }

  /**
   * Create confirmation keyboard
   */
  createConfirmationKeyboard(action: string, params: Record<string, string> = {}): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Confirm', this.generateCallbackData(`${action}:confirm`, params))
      .text('❌ Cancel', this.generateCallbackData(`${action}:cancel`, params));
  }

  /**
   * Validate menu access for user
   */
  async validateMenuAccess(ctx: BotContext, requiredRole?: string): Promise<boolean> {
    if (!isAuthenticated(ctx)) {
      await ctx.reply(
        ctx.t('common.errors.authentication_required', {
          default: 'Authentication required. Please use /start to begin.',
        }),
      );

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
      await ctx.reply(
        ctx.t('common.errors.no_permission', { default: 'You do not have permission to access this menu.' }),
      );
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

    await ctx.reply(
      'Sorry, there was an error processing your request. Please try again or use /menu to return to the main menu.',
    );
  }

  /**
   * Format user-friendly error message
   */
  formatErrorMessage(error: Error): string {
    // Map technical errors to user-friendly messages
    const errorMessages: Record<string, string> = {
      USER_NOT_FOUND: 'User account not found. Please use /start to register.',
      INSUFFICIENT_BALANCE: 'Insufficient balance for this operation.',
      INVALID_INPUT: 'Invalid input provided. Please check and try again.',
      OPERATION_FAILED: 'Operation failed. Please try again later.',
      UNAUTHORIZED: 'You are not authorized to perform this action.',
      RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
    };

    return errorMessages[error.message] || 'An unexpected error occurred. Please try again.';
  }
}
