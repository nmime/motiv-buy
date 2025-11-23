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
   * Create main menu keyboard
   */
  createMainMenuKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard()
      .text('👤 Profile', 'menu:profile')
      .text('💰 Balance', 'menu:balance')
      .row()
      .text('📊 Statistics', 'menu:statistics')
      .text('📦 Orders', 'menu:orders')
      .row()
      .text('⚙️ Settings', 'menu:settings')
      .text('🎁 Referrals', 'menu:referrals')
      .row()
      .text('💳 Payments', 'menu:payments')
      .text('📞 Support', 'menu:support');

    return keyboard;
  }

  /**
   * Create profile menu keyboard
   */
  createProfileMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✏️ Edit Profile', 'profile:edit')
      .text('🔍 View Details', 'profile:details')
      .row()
      .text('🔐 Verify Account', 'profile:verify')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create balance menu keyboard
   */
  createBalanceMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💵 View Balance', 'balance:view')
      .text('📜 Transaction History', 'balance:history')
      .row()
      .text('💸 Withdraw', 'balance:withdraw')
      .text('💰 Deposit', 'balance:deposit')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create statistics menu keyboard
   */
  createStatisticsMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📈 Overview', 'stats:overview')
      .text('📊 Detailed Stats', 'stats:detailed')
      .row()
      .text('🎯 Traffic Stats', 'stats:traffic')
      .text('💎 Earnings', 'stats:earnings')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create orders menu keyboard
   */
  createOrdersMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📋 Active Orders', 'orders:active')
      .text('✅ Completed', 'orders:completed')
      .row()
      .text('➕ Create Order', 'orders:create')
      .text('🔍 Search Orders', 'orders:search')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create settings menu keyboard
   */
  createSettingsMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🌐 Language', 'settings:language')
      .text('🔔 Notifications', 'settings:notifications')
      .row()
      .text('🎨 Preferences', 'settings:preferences')
      .text('🔒 Privacy', 'settings:privacy')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create referrals menu keyboard
   */
  createReferralsMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 My Referrals', 'referral:list')
      .text('🔗 Referral Link', 'referral:link')
      .row()
      .text('💰 Earnings', 'referral:earnings')
      .text('📈 Statistics', 'referral:stats')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create payments menu keyboard
   */
  createPaymentsMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💳 Payment Methods', 'payment:methods')
      .text('📜 History', 'payment:history')
      .row()
      .text('💸 Withdraw', 'payment:withdraw')
      .text('💰 Top Up', 'payment:topup')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create traffic menu keyboard
   */
  createTrafficMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Traffic Sources', 'traffic:sources')
      .text('🎯 Traffic Targets', 'traffic:targets')
      .row()
      .text('➕ Add Source', 'traffic:sources:add')
      .text('➕ Add Target', 'traffic:targets:add')
      .row()
      .text('📈 Analytics', 'traffic:analytics')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create traffic sources list keyboard
   */
  createTrafficSourcesKeyboard(sources: Array<{ id: string; name: string; status: string }>): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    sources.forEach((source) => {
      const statusEmoji = source.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${source.name}`, `traffic:source:view:${source.id}`).row();
    });

    keyboard.text('➕ Add New Source', 'traffic:sources:add').row();
    keyboard.text('« Back', 'menu:traffic');

    return keyboard;
  }

  /**
   * Create traffic targets list keyboard
   */
  createTrafficTargetsKeyboard(targets: Array<{ id: string; name: string; status: string }>): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    targets.forEach((target) => {
      const statusEmoji = target.status === 'active' ? '✅' : '❌';
      keyboard.text(`${statusEmoji} ${target.name}`, `traffic:target:view:${target.id}`).row();
    });

    keyboard.text('➕ Add New Target', 'traffic:targets:add').row();
    keyboard.text('« Back', 'menu:traffic');

    return keyboard;
  }

  /**
   * Create traffic source detail keyboard
   */
  createTrafficSourceDetailKeyboard(sourceId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✏️ Edit', `traffic:source:edit:${sourceId}`)
      .text('🔄 Toggle Status', `traffic:source:toggle:${sourceId}`)
      .row()
      .text('📊 Statistics', `traffic:source:stats:${sourceId}`)
      .text('🗑 Delete', `traffic:source:delete:${sourceId}`)
      .row()
      .text('« Back to Sources', 'traffic:sources');
  }

  /**
   * Create traffic target detail keyboard
   */
  createTrafficTargetDetailKeyboard(targetId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✏️ Edit', `traffic:target:edit:${targetId}`)
      .text('🔄 Toggle Status', `traffic:target:toggle:${targetId}`)
      .row()
      .text('📊 Statistics', `traffic:target:stats:${targetId}`)
      .text('🗑 Delete', `traffic:target:delete:${targetId}`)
      .row()
      .text('« Back to Targets', 'traffic:targets');
  }

  /**
   * Create campaign menu keyboard
   */
  createCampaignMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📋 Active Campaigns', 'campaign:active')
      .text('✅ Completed', 'campaign:completed')
      .row()
      .text('➕ Create Campaign', 'campaign:create')
      .text('📊 Analytics', 'campaign:analytics')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create profile stats menu keyboard
   */
  createProfileStatsMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Overview', 'profile:stats:overview')
      .text('📈 Activity', 'profile:stats:activity')
      .row()
      .text('💰 Earnings', 'profile:stats:earnings')
      .text('🎯 Performance', 'profile:stats:performance')
      .row()
      .text('« Back to Profile', 'profile:view');
  }

  /**
   * Create profile security menu keyboard
   */
  createProfileSecurityMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔑 Change Password', 'profile:password')
      .text('📧 Email Security', 'profile:email_security')
      .row()
      .text('📱 2FA Settings', 'profile:2fa')
      .text('🔐 Login History', 'profile:login_history')
      .row()
      .text('« Back to Profile', 'menu:profile');
  }

  /**
   * Create admin menu keyboard
   */
  createAdminMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('👥 Users', 'admin:users')
      .text('📊 Stats', 'admin:stats')
      .row()
      .text('⚙️ Settings', 'admin:settings')
      .text('📝 Logs', 'admin:logs')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create data export menu keyboard
   */
  createExportMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📊 Export Statistics', 'export:stats')
      .text('💰 Export Transactions', 'export:transactions')
      .row()
      .text('📋 Export Orders', 'export:orders')
      .text('👤 Export Profile', 'export:profile')
      .row()
      .text('« Back to Settings', 'menu:settings');
  }

  /**
   * Create withdrawal menu keyboard
   */
  createWithdrawalMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💸 New Withdrawal', 'withdrawal:create')
      .text('📜 History', 'withdrawal:history')
      .row()
      .text('⚙️ Methods', 'withdrawal:methods')
      .text('📊 Limits', 'withdrawal:limits')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create deposit menu keyboard
   */
  createDepositMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💰 Add Funds', 'deposit:create')
      .text('📜 History', 'deposit:history')
      .row()
      .text('💳 Payment Methods', 'deposit:methods')
      .text('🎁 Bonuses', 'deposit:bonuses')
      .row()
      .text('« Back to Menu', 'menu:main');
  }

  /**
   * Create back to menu button
   */
  createBackButton(returnTo = 'menu:main'): InlineKeyboard {
    return new InlineKeyboard().text('« Back', returnTo);
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
        ctx.t('common.errors.auth_required', { default: 'Authentication required. Please use /start to begin.' }),
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
