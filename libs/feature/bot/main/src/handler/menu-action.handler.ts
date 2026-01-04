/**
 * Menu Action Handler
 *
 * Handles all bot menu actions and callback queries.
 * Provides routing and orchestration for menu interactions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext, isAuthenticated } from '@app/feature-bot-shared';
import { InlineKeyboard } from 'grammy';
import { supportedLanguageOptions } from '@app/common-shared';
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
    return new InlineKeyboard()
      .text(ctx.t('referral.my_referrals'), 'profile:referrals')
      .row()
      .text(ctx.t('profile.change_language'), 'profile:language')
      .row()
      .text(ctx.t('common.back'), 'menu:main');
  }

  /**
   * Create profile language keyboard (back to profile)
   */
  createProfileLanguageKeyboard(ctx: BotContext, currentLang: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    supportedLanguageOptions.forEach((lang) => {
      const marker = lang.code === currentLang ? '✅ ' : '';
      keyboard.text(`${marker}${lang.name}`, `profile:lang:${lang.code}`).row();
    });

    keyboard.text(ctx.t('common.back'), 'profile:view');

    return keyboard;
  }

  /**
   * Create referrals view keyboard with share button
   */
  createReferralsViewKeyboard(ctx: BotContext, referralLink: string): InlineKeyboard {
    return new InlineKeyboard()
      .url(ctx.t('referral.share'), `https://t.me/share/url?url=${encodeURIComponent(referralLink)}`)
      .row()
      .text(ctx.t('common.back'), 'profile:view');
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
   * Create orders list keyboard (like traffic sources)
   */
  createOrdersListKeyboard(
    ctx: BotContext,
    orders: Array<{ orderId: string; type: string; status: string; targetName: string }>,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const statusEmojis: Record<string, string> = {
      pending: '⏳',
      active: '✅',
      paused: '⏸️',
      completed: '✔️',
      failed: '💥',
    };

    orders.forEach((order) => {
      const emoji = statusEmojis[order.status] ?? '❓';
      keyboard.text(`${emoji} ${order.targetName}`, `order:details:${order.orderId}`).row();
    });

    keyboard.text(ctx.t('orders.btn_new'), 'order:create:start').row();
    keyboard.text(ctx.t('common.back'), 'menu:buy_traffic');

    return keyboard;
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
      .text(ctx.t('traffic.integration.btn'), `traffic:source:integrate:${sourceId}`)
      .text(ctx.t('traffic.source_earnings.btn'), `traffic:source:earnings:${sourceId}`)
      .row()
      .text(ctx.t('common.buttons.edit'), `traffic:source:edit:${sourceId}`)
      .text(ctx.t('traffic.toggle_status'), `traffic:source:toggle:${sourceId}`)
      .row()
      .text(ctx.t('traffic.category.change_category'), `traffic:source:chgcat:${sourceId}`)
      .text(ctx.t('common.statistics'), `traffic:source:stats:${sourceId}`)
      .row()
      .text(ctx.t('common.buttons.delete'), `traffic:source:delete:${sourceId}`)
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
   * Create buy traffic targets list keyboard
   */
  createBuyTrafficTargetsKeyboard(
    ctx: BotContext,
    targets: Array<{ id: string; name: string; type: string; status: string }>,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const typeEmojis: Record<string, string> = {
      channel: '📢',
      group: '👥',
      bot: '🤖',
      with_checking: '✅',
    };

    targets.forEach((target) => {
      const statusEmoji = target.status === 'active' ? '✅' : '❌';
      const typeEmoji = typeEmojis[target.type] ?? '📌';
      keyboard.text(`${statusEmoji} ${typeEmoji} ${target.name}`, `buy:target:view:${target.id}`).row();
    });

    keyboard.text(ctx.t('traffic.buy_target.btn_add_target'), 'buy:target:add').row();
    keyboard.text(ctx.t('common.back'), 'menu:main');

    return keyboard;
  }

  /**
   * Create buy traffic target detail keyboard
   */
  createBuyTrafficTargetDetailKeyboard(ctx: BotContext, targetId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(ctx.t('traffic.buy_target.btn_new_order'), `order:create:target:${targetId}`)
      .text(ctx.t('traffic.buy_target.btn_view_orders'), `buy:target:orders:${targetId}`)
      .row()
      .text(ctx.t('traffic.toggle_status'), `buy:target:toggle:${targetId}`)
      .text(ctx.t('traffic.buy_target.btn_remove_target'), `buy:target:remove:${targetId}`)
      .row()
      .text(ctx.t('common.back'), 'menu:buy_traffic');
  }

  /**
   * Create buy traffic target orders keyboard
   */
  createBuyTrafficTargetOrdersKeyboard(
    ctx: BotContext,
    targetId: string,
    orderTargets: Array<{ trafficOrder: { getEntity: () => { id: string; orderId: string; status: string } } }>,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    const statusEmojis: Record<string, string> = {
      pending: '⏳',
      active: '✅',
      paused: '⏸️',
      completed: '✔️',
      failed: '💥',
    };

    orderTargets.forEach((ot) => {
      const order = ot.trafficOrder.getEntity();
      const emoji = statusEmojis[order.status] ?? '❓';
      keyboard.text(`${emoji} #${order.orderId}`, `order:view:${order.id}`).row();
    });

    keyboard.text(ctx.t('traffic.buy_target.btn_new_order'), `order:create:target:${targetId}`).row();
    keyboard.text(ctx.t('common.back'), `buy:target:view:${targetId}`);

    return keyboard;
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
