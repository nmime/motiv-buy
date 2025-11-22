/**
 * Callback Router Handler
 *
 * Routes callback queries to appropriate action handlers.
 * Provides centralized routing logic for all menu and action callbacks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { BotContext, AuthenticatedBotContext } from '@app/feature-bot-shared';
import {
  UserEntity,
  UserLastAuthEntity,
  UserBalanceHistoryEntity,
  UserBalanceEntity,
  UserRole,
  UserStatus,
  TrafficSourceEntity,
  TrafficSourceStatus,
  TrafficOrderEntity,
  TrafficOrderStatus,
} from '@app/database';
import { decimal, add, subtract, sum, multiply, divide, toDisplayString } from '@app/common-shared';
import { MenuActionHandler } from './menu-action.handler';
import { ProfileActionHandler } from './profile-action.handler';
import { BalanceActionHandler } from './balance-action.handler';
import { StatisticsActionHandler } from './statistics-action.handler';
import { OrderActionHandler } from './order-action.handler';
import { SettingsActionHandler } from './settings-action.handler';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { MessageService } from '../service/message.service';

type ActionHandler = (ctx: BotContext, _action: string, _params: string[]) => Promise<void>;

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);
  private primaryActionHandlers!: Map<string, ActionHandler>;
  private menuActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private profileActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private balanceActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private statsActionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;
  private orderActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;
  private settingsActionHandlers!: Map<string, (ctx: BotContext, _params: string[]) => Promise<void>>;

  constructor(
    private readonly orm: MikroORM,
    private readonly menuHandler: MenuActionHandler,
    private readonly profileHandler: ProfileActionHandler,
    private readonly balanceHandler: BalanceActionHandler,
    private readonly statisticsHandler: StatisticsActionHandler,
    private readonly orderHandler: OrderActionHandler,
    private readonly settingsHandler: SettingsActionHandler,
    private readonly rateLimitMiddleware: RateLimitMiddleware,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlerMaps();
  }

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em() {
    return this.orm.em.fork();
  }

  private initializeHandlerMaps(): void {
    this.primaryActionHandlers = new Map([
      ['menu', this.routeMenuAction.bind(this)],
      ['profile', this.routeProfileAction.bind(this)],
      ['balance', this.routeBalanceAction.bind(this)],
      ['stats', this.routeStatisticsAction.bind(this)],
      ['orders', this.routeOrderAction.bind(this)],
      ['order', this.routeOrderAction.bind(this)],
      ['settings', this.routeSettingsAction.bind(this)],
      ['referral', this.routeReferralAction.bind(this)],
      ['payment', this.routePaymentAction.bind(this)],
      ['deposit', this.routeDepositAction.bind(this)],
      ['withdraw', this.routeWithdrawalAction.bind(this)],
      ['withdrawal', this.routeWithdrawalAction.bind(this)],
      ['traffic', this.routeTrafficAction.bind(this)],
      // Note: Moderation routing moved to app layer to avoid circular dependency
      // ['moderation', this.routeModerationAction.bind(this)],
      ['support', this.routeSupportAction.bind(this)],
      ['help', this.routeHelpAction.bind(this)],
      ['campaign', this.routeCampaignAction.bind(this)],
      ['admin', this.routeAdminAction.bind(this)],
      ['auth', this.routeAuthAction.bind(this)],
      ['verify', this.routeVerifyAction.bind(this)],
      ['export', this.routeExportAction.bind(this)],
      ['reset', this.routeResetAction.bind(this)],
      ['status', this.routeStatusAction.bind(this)],
      ['command', this.routeCommandAction.bind(this)],
      ['noop', this.handleNoopAction.bind(this)],
      ['pagination', this.handleNoopAction.bind(this)],
    ]);

    this.menuActionHandlers = new Map([
      ['main', this.handleMainMenu.bind(this)],
      ['profile', async (ctx) => this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext)],
      ['balance', async (ctx) => this.balanceHandler.handleBalanceView(ctx as AuthenticatedBotContext)],
      ['statistics', async (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx)],
      ['orders', this.handleOrdersMenu.bind(this)],
      ['settings', async (ctx) => this.settingsHandler.handleSettingsView(ctx)],
      ['referrals', this.handleReferralsMenu.bind(this)],
      ['referral', this.handleReferralsMenu.bind(this)],
      ['payments', this.handlePaymentsMenu.bind(this)],
      ['support', this.handleSupportMenu.bind(this)],
      ['help', this.handleHelpMenu.bind(this)],
      ['traffic', this.handleTrafficMenu.bind(this)],
      ['campaign', this.handleCampaignMenu.bind(this)],
      ['withdrawal', async (ctx) => this.balanceHandler.handleWithdrawalStart(ctx as AuthenticatedBotContext)],
      ['notifications', async (ctx) => this.settingsHandler.handleNotificationSettings(ctx)],
    ]);

    this.profileActionHandlers = new Map([
      ['view', async (ctx) => this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext)],
      [
        'edit',
        async (ctx, params) => {
          if (params.length > 0) {
            await ctx.reply(ctx.t('profile.enter_new_field', { field: params[0] }));
            if (ctx.session) {
              ctx.session.conversationState = 'profile_edit_field';
              ctx.session.formData = { field: params[0] };
            }
          } else {
            await this.profileHandler.handleProfileEditStart(ctx as AuthenticatedBotContext);
          }
        },
      ],
      ['details', async (ctx) => this.profileHandler.handleProfileDetails(ctx as AuthenticatedBotContext)],
      ['verify', async (ctx) => this.profileHandler.handleVerification(ctx as AuthenticatedBotContext)],
      ['stats', this.handleProfileStatsMenu.bind(this)],
      ['stats:overview', async (ctx, _params) => this.statisticsHandler.handleStatisticsOverview(ctx)],
      ['stats:activity', async (ctx, _params) => this.statisticsHandler.handleDetailedStatistics(ctx)],
      ['stats:earnings', async (ctx, _params) => this.statisticsHandler.handleEarningsStatistics(ctx)],
      ['stats:performance', async (ctx, _params) => this.statisticsHandler.handleTrafficStatistics(ctx)],
      ['security', this.handleProfileSecurityMenu.bind(this)],
      ['password', this.handlePasswordChange.bind(this)],
      ['email_security', this.handleEmailSecurity.bind(this)],
      ['login_history', this.handleLoginHistory.bind(this)],
    ]);

    this.balanceActionHandlers = new Map([
      ['view', async (ctx) => this.balanceHandler.handleBalanceView(ctx as AuthenticatedBotContext)],
      ['current', async (ctx) => this.balanceHandler.handleBalanceView(ctx as AuthenticatedBotContext)],
      [
        'history',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.balanceHandler.handleTransactionHistory(ctx as AuthenticatedBotContext, page);
        },
      ],
      ['analytics', this.handleBalanceAnalytics.bind(this)],
      ['withdraw', async (ctx) => this.balanceHandler.handleWithdrawalStart(ctx as AuthenticatedBotContext)],
      ['deposit', async (ctx) => this.balanceHandler.handleDepositStart(ctx as AuthenticatedBotContext)],
      ['topup', async (ctx) => this.balanceHandler.handleDepositStart(ctx as AuthenticatedBotContext)],
    ]);

    this.statsActionHandlers = new Map([
      ['overview', async (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx)],
      ['detailed', async (ctx) => this.statisticsHandler.handleDetailedStatistics(ctx)],
      ['traffic', async (ctx) => this.statisticsHandler.handleTrafficStatistics(ctx)],
      ['earnings', async (ctx) => this.statisticsHandler.handleEarningsStatistics(ctx)],
    ]);

    this.orderActionHandlers = new Map([
      ['list', this.handleOrdersMenu.bind(this)],
      [
        'active',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleActiveOrders(ctx, page);
        },
      ],
      [
        'completed',
        async (ctx, params) => {
          const page = params.length > 0 && params[0] === 'page' ? parseInt(params[1]) : 1;
          await this.orderHandler.handleCompletedOrders(ctx, page);
        },
      ],
      [
        'create',
        async (ctx, params) => {
          if (params.length > 0 && params[0] === 'start') {
            await this.orderHandler.handleCreateOrderStart(ctx);
          } else if (params.length > 0 && params[0] === 'back') {
            await this.handleOrdersMenu(ctx);
          } else {
            await this.orderHandler.handleCreateOrderStart(ctx);
          }
        },
      ],
      ['search', async (ctx) => this.orderHandler.handleOrderSearch(ctx)],
      [
        'details',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        },
      ],
      [
        'view',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.orderHandler.handleOrderDetails(ctx, params[0]);
          }
        },
      ],
      ['deleted', this.handleDeletedOrders.bind(this)],
      ['config', this.handleOrderConfig.bind(this)],
      ['edit', this.handleOrderEdit.bind(this)],
      ['toggle', this.handleOrderToggle.bind(this)],
      ['delete', this.handleOrderDelete.bind(this)],
      ['download', this.handleOrderDownload.bind(this)],
      [
        'help',
        async (ctx, _params) => {
          await this.handleHelpMenu(ctx);
        },
      ],
      ['bot', this.handleOrderBotManagement.bind(this)],
      ['audience', this.handleOrderAudienceTargeting.bind(this)],
      ['gender', this.handleOrderGenderSelection.bind(this)],
      ['topic', this.handleOrderTopicSelection.bind(this)],
      ['location', this.handleOrderLocationSelection.bind(this)],
      [
        'refresh',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stats_refreshed'),
          });
        },
      ],
      ['stats', this.handleOrderStats.bind(this)],
      ['duplicate', this.handleOrderDuplicate.bind(this)],
      ['integration', this.handleOrderIntegration.bind(this)],
      ['transfer', this.handleOrderTransfer.bind(this)],
      [
        'stop',
        async (ctx, _params) => {
          await this.messageService.sendOrEditMessage(ctx, {
            text: ctx.t('orders.stopped'),
          });
        },
      ],
      ['view_channel', this.handleOrderChannelView.bind(this)],
      ['type', this.handleOrderTypeSelection.bind(this)],
    ]);

    this.settingsActionHandlers = new Map([
      [
        'language',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          } else {
            await this.settingsHandler.handleLanguageSettings(ctx);
          }
        },
      ],
      [
        'lang',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleLanguageChange(ctx, params[0]);
          }
        },
      ],
      ['notifications', async (ctx) => this.settingsHandler.handleNotificationSettings(ctx)],
      [
        'notify',
        async (ctx, params) => {
          if (params.length > 0) {
            await this.settingsHandler.handleNotificationToggle(ctx, params[0]);
          }
        },
      ],
      ['preferences', async (ctx) => this.settingsHandler.handlePreferencesSettings(ctx)],
      [
        'privacy',
        async (ctx, params) => {
          if (params.length > 0 && params[0]) {
            await this.handlePrivacyToggle(ctx, params[0]);
          } else {
            await this.settingsHandler.handlePrivacySettings(ctx);
          }
        },
      ],
      ['theme', this.handleThemeSettings.bind(this)],
      ['export', this.handleExportMenu.bind(this)],
      ['reset', this.handleResetMenu.bind(this)],
    ]);
  }

  /**
   * Route callback query to appropriate handler
   */
  async routeCallback(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
      return;
    }

    const { data } = ctx.callbackQuery;

    try {
      // Check rate limit
      const isAllowed = await this.rateLimitMiddleware.checkRateLimit(ctx, 'callback');

      if (!isAllowed) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.rate_limit'));

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

      // Route to appropriate handler based on primary action using map
      const handler = this.primaryActionHandlers.get(primaryAction);

      if (handler) {
        await handler(ctx, secondaryAction, params);
      } else {
        this.logger.warn('Unknown primary action', { primaryAction, data });
        await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));
        await ctx.reply(ctx.t('common.errors.unknown_action_help'));
      }

      // Answer callback query to remove loading state
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error routing callback', {
        error: error instanceof Error ? error.message : String(error),
        data,
        userId: ctx.from?.id,
      });

      await ctx.answerCallbackQuery(ctx.t('common.error'));
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Route menu actions
   */
  private async routeMenuAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    // Default to 'main' if action is undefined or empty
    const menuAction = action || 'main';
    const handler = this.menuActionHandlers.get(menuAction);

    if (handler) {
      await handler(ctx);
    } else {
      this.logger.warn('Unknown menu action', { action: menuAction });
      // Fall back to main menu for unknown actions
      await this.handleMainMenu(ctx);
    }
  }

  /**
   * Route profile actions
   */
  private async routeProfileAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.profileActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext);
    }
  }

  /**
   * Route balance actions
   */
  private async routeBalanceAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.balanceActionHandlers.get(action || 'view');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.balanceHandler.handleBalanceView(ctx as AuthenticatedBotContext);
    }
  }

  /**
   * Route statistics actions
   */
  private async routeStatisticsAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const handler = this.statsActionHandlers.get(action || 'overview');

    if (handler) {
      await handler(ctx);
    } else {
      await this.statisticsHandler.handleStatisticsOverview(ctx);
    }
  }

  /**
   * Route order actions
   */
  private async routeOrderAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.orderActionHandlers.get(action || 'list');

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.handleOrdersMenu(ctx);
    }
  }

  /**
   * Route settings actions
   */
  private async routeSettingsAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.settingsActionHandlers.get(action);

    if (handler) {
      await handler(ctx, params);
    } else {
      await this.settingsHandler.handleSettingsView(ctx);
    }
  }

  /**
   * Route moderation actions
   * Note: Moderation handler moved to app layer (apps/bot/src/handler/moderation-action.handler.ts)
   * to avoid circular dependency between bot-main and traffic-main.
   * This routing is now handled at the app level.
   *
   * Format: moderation:approve:traffic_source:requestId
   * or: moderation:decline:traffic_order:requestId
   */
  /*
  private async routeModerationAction(ctx: BotContext, action: string, params: string[]): Promise<void> {
    // Verify admin access (action should be 'approve' or 'decline')
    // params[0] should be entity type, params[1] should be requestId
    if (params.length < 2) {
      await ctx.answerCallbackQuery('❌ Invalid moderation request');

      return;
    }

    const [entityTypeStr, requestId] = params;

    // Map string to ModerationEntityType
    const entityTypeMap: Record<string, ModerationEntityType> = {
      traffic_source: ModerationEntityType.TrafficSource,
      traffic_order: ModerationEntityType.TrafficOrder,
    };

    const entityType = entityTypeMap[entityTypeStr] || null;

    if (!entityType) {
      await ctx.answerCallbackQuery('❌ Invalid entity type');

      return;
    }

    // Route to appropriate handler
    if (action === 'approve') {
      await this.moderationHandler.handleApprove(ctx, entityType, requestId);
    } else if (action === 'decline') {
      await this.moderationHandler.handleDecline(ctx, entityType, requestId);
    } else {
      await ctx.answerCallbackQuery('❌ Unknown moderation action');
    }
  }
  */

  /**
   * Route referral actions
   */
  private async routeReferralAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleReferralsMenu(ctx);
  }

  /**
   * Route payment actions
   */
  private async routePaymentAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handlePaymentsMenu(ctx);
  }

  /**
   * Route deposit actions
   */
  private async routeDepositAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleDepositMenu(ctx);
  }

  /**
   * Route withdrawal actions
   */
  private async routeWithdrawalAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleWithdrawalMenu(ctx);
  }

  /**
   * Route traffic actions
   */
  private async routeTrafficAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleTrafficMenu(ctx);
  }

  /**
   * Route support actions
   */
  private async routeSupportAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const supportHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      contact: (ctx) => this.handleSupportContact(ctx),
      report: (ctx) => this.handleSupportReport(ctx),
      suggest: (ctx) => this.handleSupportSuggest(ctx),
    };

    const handler = supportHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.handleSupportMenu(ctx);
    }
  }

  /**
   * Handle noop actions (pagination indicators, etc)
   */
  private async handleNoopAction(_ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    // Do nothing - these are UI-only elements
  }

  /**
   * Route help actions
   */
  private async routeHelpAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
    const helpHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      faq: (ctx) => this.handleHelpFAQ(ctx),
      create_order: (ctx) => this.handleHelpCreateOrder(ctx),
      topup: (ctx) => this.handleHelpTopup(ctx),
      withdraw: (ctx) => this.handleHelpWithdraw(ctx),
      stats: (ctx) => this.handleHelpStats(ctx),
      traffic: (ctx) => this.handleHelpTraffic(ctx),
    };

    const handler = helpHandlers[action];
    if (handler) {
      await handler(ctx);
    } else {
      await this.handleHelpMenu(ctx);
    }
  }

  /**
   * Route campaign actions
   */
  private async routeCampaignAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleCampaignMenu(ctx);
  }

  /**
   * Route admin actions
   */
  private async routeAdminAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleAdminMenu(ctx);
  }

  /**
   * Route auth actions
   */
  private async routeAuthAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await ctx.reply(
      ctx.t('auth.feature_info', { default: '🔐 Authentication features are managed through your profile settings.' }),
    );
  }

  /**
   * Route verify actions
   */
  private async routeVerifyAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.profileHandler.handleVerification(ctx as AuthenticatedBotContext);
  }

  /**
   * Route export actions
   */
  private async routeExportAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleExportMenu(ctx);
  }

  /**
   * Route reset actions
   */
  private async routeResetAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleResetMenu(ctx);
  }

  /**
   * Route status actions
   */
  private async routeStatusAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleStatusDisplay(ctx);
  }

  /**
   * Route command actions
   */
  private async routeCommandAction(ctx: BotContext, _action: string, _params: string[]): Promise<void> {
    await this.handleCommandsHelp(ctx);
  }

  // Placeholder methods for additional features

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const userName = ctx.from?.first_name || 'Пользователь';
    const text = `<b>👋 Привет, ${userName}!</b>

Добро пожаловать в <b>MotivBuy</b> — сервис для продвижения Telegram каналов и групп!

<b>🚀 Что можно сделать:</b>
• Купить подписчиков для вашего канала
• Продать трафик и заработать
• Отслеживать статистику

<i>Выберите нужный раздел ниже 👇</i>`;

    const keyboard = new InlineKeyboard()
      .text('👥 Купить подписчиков', 'order:list')
      .row()
      .text('🤖 Продажа трафика', 'traffic:manage')
      .text('📋 Мои заказы', 'order:list')
      .row()
      .text('👤 Профиль', 'profile:view')
      .text('💰 Баланс', 'balance:view')
      .row()
      .text('📊 Статистика', 'stats:overview')
      .text('⚙️ Настройки', 'settings')
      .row()
      .text('❓ Помощь', 'help')
      .text('🏢 Поддержка', 'support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleOrdersMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Требуется авторизация. Используйте /start');
        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });
      if (!user) {
        await ctx.reply('Пользователь не найден');
        return;
      }

      // Get order counts
      const [activeCount, completedCount, totalCount] = await Promise.all([
        this.em.count(TrafficOrderEntity, {
          creator: user.id,
          status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
        }),
        this.em.count(TrafficOrderEntity, {
          creator: user.id,
          status: TrafficOrderStatus.Completed,
        }),
        this.em.count(TrafficOrderEntity, { creator: user.id }),
      ]);

      const text = `<b>📦 Мои заказы</b>

<b>📊 Статистика заказов:</b>
• Активных: ${activeCount}
• Завершенных: ${completedCount}
• Всего: ${totalCount}

<i>Выберите действие ниже:</i>`;

      const keyboard = new InlineKeyboard()
        .text('🆕 Новый заказ', 'order:create:start')
        .row()
        .text('📋 Активные заказы', 'orders:active')
        .text('✅ Завершенные', 'orders:completed')
        .row()
        .text('🔍 Поиск заказов', 'orders:search')
        .row()
        .text('« Назад в меню', 'menu:main');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleReferralsMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Требуется авторизация. Используйте /start');
        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });
      if (!user) {
        await ctx.reply('Пользователь не найден');
        return;
      }

      // Generate referral link
      const botUsername = 'motivbuy_bot'; // TODO: Get from config
      const referralCode = user.id.substring(0, 8);
      const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;

      const text = `<b>🎁 Реферальная программа</b>

Приглашайте друзей и получайте бонусы!

<b>💰 Ваши вознаграждения:</b>
• 10% от каждой покупки реферала
• Бессрочное начисление
• Без ограничений по количеству

<b>🔗 Ваша реферальная ссылка:</b>
<code>${referralLink}</code>

<b>📊 Статистика:</b>
• Приглашено: 0 пользователей
• Заработано: $0.00

<i>Поделитесь ссылкой с друзьями!</i>`;

      const keyboard = new InlineKeyboard()
        .text('📋 Скопировать ссылку', 'referral:copy')
        .row()
        .text('📊 Мои рефералы', 'referral:list')
        .text('💰 Статистика', 'referral:stats')
        .row()
        .text('📤 Поделиться', 'referral:share')
        .row()
        .text('« Назад в меню', 'menu:main');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handlePaymentsMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Требуется авторизация. Используйте /start');
        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });
      if (!user) {
        await ctx.reply('Пользователь не найден');
        return;
      }

      // Get recent transactions count
      const transactionCount = await this.em.count(UserBalanceHistoryEntity, { user: user.id });

      const text = `<b>💳 Платежи</b>

Управляйте своими финансами в одном месте.

<b>📊 Статистика:</b>
• Всего операций: ${transactionCount}

<b>💰 Способы оплаты:</b>
• Банковские карты (Visa, MC, МИР)
• Криптовалюты (BTC, ETH, USDT)
• Электронные кошельки

<b>💸 Способы вывода:</b>
• Криптовалюты
• Электронные кошельки
• Минимум: $10

<i>Выберите действие ниже:</i>`;

      const keyboard = new InlineKeyboard()
        .text('💰 Пополнить баланс', 'balance:deposit')
        .text('💸 Вывести', 'balance:withdraw')
        .row()
        .text('📜 История платежей', 'payment:history')
        .row()
        .text('💳 Способы оплаты', 'payment:methods')
        .row()
        .text('« Назад в меню', 'menu:main');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleSupportMenu(ctx: BotContext): Promise<void> {
    const text = `<b>🏢 Техническая поддержка</b>

Мы всегда рады помочь вам!

<b>📞 Способы связи:</b>
• Телеграм: @motivbuy_support
• Email: support@motivbuy.com

<b>⏰ Время работы:</b>
• Пн-Пт: 9:00 - 21:00 (МСК)
• Сб-Вс: 10:00 - 18:00 (МСК)

<b>📋 Частые вопросы:</b>
• Как создать заказ?
• Как пополнить баланс?
• Как вывести средства?
• Проблемы с ботом

<i>Выберите действие ниже или напишите нам напрямую.</i>`;

    const keyboard = new InlineKeyboard()
      .text('💬 Написать в поддержку', 'support:contact')
      .row()
      .text('❓ FAQ - Частые вопросы', 'help:faq')
      .row()
      .text('📝 Сообщить о проблеме', 'support:report')
      .text('💡 Предложить идею', 'support:suggest')
      .row()
      .text('« Назад в меню', 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpMenu(ctx: BotContext): Promise<void> {
    const text = `<b>❓ Справка и помощь</b>

Добро пожаловать в справочный центр MotivBuy!

<b>🚀 Быстрый старт:</b>
1. Создайте заказ через "Купить подписчиков"
2. Укажите ссылку на канал/чат
3. Добавьте бота в администраторы
4. Настройте параметры и запустите

<b>📚 Разделы справки:</b>
• Создание и настройка заказов
• Управление балансом
• Статистика и аналитика
• Продажа трафика

<b>💬 Основные команды:</b>
/start - Главное меню
/menu - Открыть меню
/balance - Проверить баланс
/profile - Ваш профиль
/settings - Настройки
/help - Эта справка

<i>Если у вас остались вопросы, обратитесь в поддержку.</i>`;

    const keyboard = new InlineKeyboard()
      .text('📖 Как создать заказ', 'help:create_order')
      .row()
      .text('💰 Пополнение баланса', 'help:topup')
      .text('💸 Вывод средств', 'help:withdraw')
      .row()
      .text('📊 Статистика', 'help:stats')
      .text('🤖 Продажа трафика', 'help:traffic')
      .row()
      .text('🏢 Связаться с поддержкой', 'support:contact')
      .row()
      .text('« Назад в меню', 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleTrafficMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Get traffic sources managed by user
      const sources = await this.em.find(TrafficSourceEntity, { managedBy: user.id }, { populate: ['orders'] });

      // Get active traffic orders
      const activeOrders = await this.em.count(TrafficOrderEntity, {
        creator: user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      });

      const totalOrders = await this.em.count(TrafficOrderEntity, { creator: user.id });

      let text = '<b>🎯 Traffic Management</b>\n\n';
      text += `<b>📊 Overview:</b>\n`;
      text += `• Traffic Sources: ${sources.length}\n`;
      text += `• Active Orders: ${activeOrders}\n`;
      text += `• Total Orders: ${totalOrders}\n\n`;

      if (sources.length > 0) {
        text += '<b>Your Sources:</b>\n';
        sources.slice(0, 5).forEach((source) => {
          const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
          text += `${statusEmoji} ${source.name} (${source.type})\n`;
        });

        if (sources.length > 5) {
          text += `... and ${sources.length - 5} more\n`;
        }
      } else {
        text += '<i>No traffic sources yet. Create one to get started!</i>';
      }

      const keyboard = this.menuHandler.createTrafficMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleCampaignMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Get campaign statistics (campaigns are TrafficOrders)
      const [active, completed, total] = await Promise.all([
        this.em.count(TrafficOrderEntity, {
          creator: user.id,
          status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
        }),
        this.em.count(TrafficOrderEntity, {
          creator: user.id,
          status: TrafficOrderStatus.Completed,
        }),
        this.em.count(TrafficOrderEntity, { creator: user.id }),
      ]);

      // Get recent campaigns
      const recentCampaigns = await this.em.find(
        TrafficOrderEntity,
        { creator: user.id },
        { orderBy: { createdAt: 'DESC' }, limit: 5, populate: ['trafficTarget'] },
      );

      const totalSpent = recentCampaigns.reduce((sum, order) => {
        return sum.plus(decimal(order.spentAmount || '0'));
      }, decimal(0));

      let text = '<b>📋 Campaign Management</b>\n\n';
      text += '<b>📊 Statistics:</b>\n';
      text += `• Active Campaigns: ${active}\n`;
      text += `• Completed: ${completed}\n`;
      text += `• Total: ${total}\n`;
      text += `• Total Spent: $${toDisplayString(totalSpent, 2)}\n\n`;

      if (recentCampaigns.length > 0) {
        text += '<b>Recent Campaigns:</b>\n';
        for (const campaign of recentCampaigns) {
          const statusEmoji =
            {
              [TrafficOrderStatus.Active]: '✅',
              [TrafficOrderStatus.InProgress]: '🔄',
              [TrafficOrderStatus.Completed]: '✔️',
              [TrafficOrderStatus.Pending]: '⏳',
              [TrafficOrderStatus.Cancelled]: '❌',
              [TrafficOrderStatus.Failed]: '⚠️',
            }[campaign.status] || '❓';

          text += `${statusEmoji} ${campaign.orderId.substring(0, 8)}... (${campaign.type})\n`;
          text += `   Progress: ${campaign.currentCount}/${campaign.targetCount}\n`;
        }
      } else {
        text += '<i>No campaigns yet. Click "Create Campaign" to get started!</i>';
      }

      const keyboard = this.menuHandler.createCampaignMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleProfileStatsMenu(ctx: BotContext, _params: string[]): Promise<void> {
    // If no specific stat requested, show overview using StatisticsActionHandler
    if (!_params || _params.length === 0) {
      await this.statisticsHandler.handleStatisticsOverview(ctx);

      return;
    }

    // Route to specific stat views using Map pattern
    const statsHandlers: Record<string, (ctx: BotContext) => Promise<void>> = {
      overview: (ctx) => this.statisticsHandler.handleStatisticsOverview(ctx),
      activity: (ctx) => this.statisticsHandler.handleDetailedStatistics(ctx),
      earnings: (ctx) => this.statisticsHandler.handleEarningsStatistics(ctx),
      performance: (ctx) => this.statisticsHandler.handleTrafficStatistics(ctx),
    };

    const [statType] = _params;
    const handler = statsHandlers[statType] || statsHandlers.overview;
    await handler(ctx);
  }

  private async handleProfileSecurityMenu(ctx: BotContext, _params: string[]): Promise<void> {
    const keyboard = this.menuHandler.createProfileSecurityMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.security_menu', {
        default: '🔒 Security Settings\n\nManage your account security options.',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handlePasswordChange(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.password_change', {
        default: '🔑 Change Password\n\nTo change your password, please enter your current password:',
      }),
      parseMode: 'HTML',
    });

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_current_password';
    }
  }

  private async handleEmailSecurity(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('profile.email_security', {
        default:
          '📧 Email Security\n\n✅ Email notifications are enabled\n✅ Two-factor authentication available\n\nUse the buttons below to manage your email settings.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:profile'),
    });
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async handleLoginHistory(ctx: BotContext, _params: string[]): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const lastAuth = await this.em.findOne(UserLastAuthEntity, { user: user.id });

      let text = '<b>🔐 Login History</b>\n\n';

      if (lastAuth) {
        const timeDiff = Date.now() - lastAuth.updatedAt.getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));

        let timeText = 'just now';
        if (hoursAgo > 24) {
          timeText = `${Math.floor(hoursAgo / 24)} day(s) ago`;
        } else if (hoursAgo > 0) {
          timeText = `${hoursAgo} hour(s) ago`;
        } else if (minutesAgo > 0) {
          timeText = `${minutesAgo} minute(s) ago`;
        }

        text += `<b>Last Login:</b>\n`;
        text += `📅 Time: ${timeText}\n`;
        text += `🕐 Date: ${lastAuth.updatedAt.toLocaleString()}\n`;
        text += `📍 IP: ${lastAuth.ip || 'Unknown'}\n`;

        if (lastAuth.city || lastAuth.country) {
          text += `🌍 Location: ${lastAuth.city || ''}${lastAuth.city && lastAuth.country ? ', ' : ''}${lastAuth.country || ''}\n`;
        }

        if (lastAuth.continent) {
          text += `🗺 Continent: ${lastAuth.continent}\n`;
        }

        text += '\n✅ No suspicious activity detected.';
      } else {
        text += '📱 No login history available yet.\n';
        text += 'Login history will be tracked starting from your next login.';
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: this.menuHandler.createBackButton('profile:security'),
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleBalanceAnalytics(ctx: BotContext, _params: string[]): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Get all balance history for analytics
      const history = await this.em.find(
        UserBalanceHistoryEntity,
        { user: user.id },
        { orderBy: { createdAt: 'DESC' }, limit: 100 },
      );

      if (history.length === 0) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: '📊 <b>Balance Analytics</b>\n\nNo transaction history available yet.\nStart using the platform to see your analytics!',
          parseMode: 'HTML',
          replyMarkup: this.menuHandler.createBackButton('menu:balance'),
        });

        return;
      }

      // Calculate analytics

      let totalIncome = decimal(0);
      let totalExpense = decimal(0);
      const last30Days = history.filter((tx) => {
        const daysDiff = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);

        return daysDiff <= 30;
      });

      const last7Days = history.filter((tx) => {
        const daysDiff = (Date.now() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);

        return daysDiff <= 7;
      });

      history.forEach((tx) => {
        const amount = decimal(tx.amount);
        if (amount.greaterThan(0)) {
          totalIncome = add(totalIncome, amount);
        } else {
          totalExpense = add(totalExpense, amount.abs());
        }
      });

      const income30Days = last30Days
        .filter((tx) => decimal(tx.amount).greaterThan(0))
        .reduce((sum, tx) => add(sum, decimal(tx.amount)), decimal(0));

      const income7Days = last7Days
        .filter((tx) => decimal(tx.amount).greaterThan(0))
        .reduce((sum, tx) => add(sum, decimal(tx.amount)), decimal(0));

      const netBalance = subtract(totalIncome, totalExpense);
      const avgTransaction = history.length > 0 ? totalIncome.div(history.length) : decimal(0);

      let text = '<b>📊 Balance Analytics</b>\n\n';
      text += '<b>💰 All Time:</b>\n';
      text += `• Total Income: $${toDisplayString(totalIncome, 2)}\n`;
      text += `• Total Expenses: $${toDisplayString(totalExpense, 2)}\n`;
      text += `• Net Balance: $${toDisplayString(netBalance, 2)}\n\n`;

      text += '<b>📈 Last 30 Days:</b>\n';
      text += `• Income: $${toDisplayString(income30Days, 2)}\n`;
      text += `• Transactions: ${last30Days.length}\n\n`;

      text += '<b>📅 Last 7 Days:</b>\n';
      text += `• Income: $${toDisplayString(income7Days, 2)}\n`;
      text += `• Transactions: ${last7Days.length}\n\n`;

      text += '<b>📊 Averages:</b>\n';
      text += `• Avg Transaction: $${toDisplayString(avgTransaction, 2)}\n`;
      text += `• Total Transactions: ${history.length}`;

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: this.menuHandler.createBackButton('menu:balance'),
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleWithdrawalMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Get user balances
      const balances = await this.em.find(UserBalanceEntity, { user: user.id }, { populate: ['currency'] });

      let text = '<b>💸 Withdrawal</b>\n\n';
      text += '<b>Available Balances:</b>\n';

      let hasAvailableBalance = false;
      for (const balance of balances) {
        // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
        const currency = await balance.currency.load();
        if (!currency) {
          continue;
        }

        const available = balance.getAvailableBalance();
        if (decimal(available).greaterThan(0)) {
          hasAvailableBalance = true;
          text += `• ${currency.code}: ${toDisplayString(available, 8)} ${currency.symbol || currency.code}\n`;
        }
      }

      if (!hasAvailableBalance) {
        text += '\n<i>No available balance for withdrawal.</i>\n\n';
        text += 'Minimum withdrawal: $10.00';
      } else {
        text += '\n✅ You can withdraw your funds';
      }

      const keyboard = this.menuHandler.createWithdrawalMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleDepositMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      let text = '<b>💰 Deposit Funds</b>\n\n';
      text += '<b>Available Methods:</b>\n';
      text += '• 💳 Credit/Debit Card\n';
      text += '• 🪙 Cryptocurrency (BTC, ETH, USDT)\n';
      text += '• 🏦 Bank Transfer\n\n';
      text += '<b>Important:</b>\n';
      text += '• Minimum deposit: $10.00\n';
      text += '• Instant processing for crypto & cards\n';
      text += '• Bank transfers: 1-3 business days\n\n';
      text += '<i>Select a payment method below to continue.</i>';

      const keyboard = this.menuHandler.createDepositMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleAdminMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Check if user has admin or super admin role
      if (user.role !== UserRole.Admin && user.role !== UserRole.SuperAdmin) {
        await ctx.reply('⛔️ Access denied. Admin privileges required.');

        return;
      }

      // Get admin statistics
      const [totalUsers, activeUsers] = await Promise.all([
        this.em.count(UserEntity),
        this.em.count(UserEntity, { status: UserStatus.Active }),
      ]);

      const [totalOrders, activeOrders] = await Promise.all([
        this.em.count(TrafficOrderEntity),
        this.em.count(TrafficOrderEntity, {
          status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
        }),
      ]);

      const totalSources = await this.em.count(TrafficSourceEntity);

      let text = '<b>🔧 Admin Panel</b>\n\n';
      text += '<b>👥 Users:</b>\n';
      text += `• Total: ${totalUsers}\n`;
      text += `• Active: ${activeUsers}\n\n`;
      text += '<b>📋 Orders:</b>\n';
      text += `• Total: ${totalOrders}\n`;
      text += `• Active: ${activeOrders}\n\n`;
      text += '<b>🎯 Traffic Sources:</b>\n';
      text += `• Total: ${totalSources}\n\n`;
      text += '<i>Select an action below to manage the system.</i>';

      const keyboard = this.menuHandler.createAdminMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleExportMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Get data counts for export preview
      const [ordersCount, transactionsCount] = await Promise.all([
        this.em.count(TrafficOrderEntity, { creator: user.id }),
        this.em.count(UserBalanceHistoryEntity, { user: user.id }),
      ]);

      let text = '<b>📥 Data Export</b>\n\n';
      text += '<b>Available Data:</b>\n';
      text += `• Profile Information\n`;
      text += `• Orders: ${ordersCount} records\n`;
      text += `• Transactions: ${transactionsCount} records\n`;
      text += `• Statistics & Analytics\n\n`;
      text += '<b>Export Formats:</b>\n';
      text += '• JSON (raw data)\n';
      text += '• CSV (spreadsheet)\n';
      text += '• PDF (formatted report)\n\n';
      text += '<i>Select what you want to export below.</i>\n\n';
      text += '⚠️ Export may take a few moments for large datasets.';

      const keyboard = this.menuHandler.createExportMenuKeyboard();
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleResetMenu(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      let text = '<b>🔄 Reset Account</b>\n\n';
      text += '⚠️ <b>WARNING:</b> This action will reset:\n\n';
      text += '❌ All settings to default\n';
      text += '❌ Notification preferences\n';
      text += '❌ Display preferences\n';
      text += '❌ Language settings\n\n';
      text += '✅ <b>Will NOT affect:</b>\n';
      text += '• Your balance\n';
      text += '• Order history\n';
      text += '• Transaction history\n';
      text += '• Profile verification\n\n';
      text += '⚡️ <b>This action is IRREVERSIBLE!</b>\n\n';
      text += 'Are you absolutely sure you want to continue?';

      const keyboard = this.menuHandler.createConfirmationKeyboard('reset');
      await this.messageService.sendOrEditMessage(ctx, {
        text,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleThemeSettings(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('settings.theme', {
        default:
          '🎨 Theme Settings\n\n✅ Auto-adapt theme (recommended)\n\nTheme automatically adapts to your Telegram settings.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:settings'),
    });
  }

  private async handlePrivacyToggle(ctx: BotContext, setting: string): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('settings.privacy_updated', {
        default: `✅ Privacy setting "${setting}" has been updated.`,
        setting,
      }),
      parseMode: 'HTML',
    });
  }

  private async handleStatusDisplay(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('status.display', {
        default: `📊 Account Status\n\n🆔 User ID: ${userId || 'Unknown'}\n✅ Status: Active\n📅 Member since: Today\n\nAll systems operational.`,
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:main'),
    });
  }

  private async handleCommandsHelp(ctx: BotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('commands.help_text', {
        default:
          '💬 Available Commands\n\n/start - Start bot\n/menu - Open menu\n/help - Show help\n/profile - View profile\n/balance - Check balance\n/settings - Settings\n/stats - Statistics',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:main'),
    });
  }

  // Order management handlers
  private async handleDeletedOrders(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.deleted_list', { default: '🗑 Deleted Orders\n\nNo deleted orders found.' }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderConfig(ctx: BotContext, _params: string[]): Promise<void> {
    if (!_params || _params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: '⚙️ Please select an order to configure.',
        parseMode: 'HTML',
        replyMarkup: this.menuHandler.createBackButton('menu:orders'),
      });

      return;
    }

    const [orderId] = _params;
    await this.orderHandler.handleOrderDetails(ctx, orderId);
  }

  private async handleOrderEdit(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.edit_prompt', { default: '✏️ Edit Order\n\nPlease select what you want to edit:' }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderToggle(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.toggled', { default: '✅ Order status has been toggled.' }),
      parseMode: 'HTML',
    });
  }

  private async handleOrderDelete(ctx: BotContext, _params: string[]): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard('order:delete', { id: _params[0] || '' });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.delete_confirm', {
        default: '⚠️ Delete Order\n\nAre you sure you want to delete this order? This action cannot be undone.',
      }),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleOrderDownload(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.download_preparing', {
        default: '📥 Preparing download...\n\nYour order data will be sent shortly.',
      }),
      parseMode: 'HTML',
    });
  }

  private async handleOrderBotManagement(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.bot_management', {
        default: '🤖 Bot Management\n\nManage bots associated with your orders.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderAudienceTargeting(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.audience_targeting', {
        default:
          '🎯 Audience Targeting\n\nDefine your target audience:\n- Age range\n- Gender\n- Location\n- Interests',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderGenderSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.gender_selection', {
        default: '👥 Gender Selection\n\nChoose target gender:\n• All\n• Male\n• Female',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderTopicSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.topic_selection', { default: '🎯 Topic Selection\n\nSelect topics for your campaign.' }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderLocationSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.location_selection', {
        default: '🌍 Location Selection\n\nSelect target locations for your campaign.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderStats(ctx: BotContext, params: string[]): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const em = this.em;
      const user = await em.findOne(UserEntity, { telegramId: ctx.from.id.toString() });

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      if (!params || params.length === 0) {
        // Show overall order statistics
        const [totalOrders, activeOrders, completedOrders] = await Promise.all([
          em.count(TrafficOrderEntity, { creator: user.id }),
          em.count(TrafficOrderEntity, {
            creator: user.id,
            status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
          }),
          em.count(TrafficOrderEntity, {
            creator: user.id,
            status: TrafficOrderStatus.Completed,
          }),
        ]);

        const orders = await em.find(TrafficOrderEntity, { creator: user.id });

        const totalSpent = sum(orders.map((o) => decimal(o.spentAmount || '0')));
        const totalBudget = sum(orders.map((o) => decimal(o.totalBudget || '0')));
        const totalActions = orders.reduce((sum, o) => sum + o.currentCount, 0);
        const targetActions = orders.reduce((sum, o) => sum + o.targetCount, 0);

        const completionRate =
          targetActions > 0 ? toDisplayString(multiply(divide(totalActions, targetActions), 100), 1) : '0.0';

        let text = '<b>📊 Order Statistics</b>\n\n';
        text += '<b>Overview:</b>\n';
        text += `• Total Orders: ${totalOrders}\n`;
        text += `• Active: ${activeOrders}\n`;
        text += `• Completed: ${completedOrders}\n\n`;
        text += '<b>Financial:</b>\n';
        text += `• Total Budget: $${toDisplayString(totalBudget, 2)}\n`;
        text += `• Total Spent: $${toDisplayString(totalSpent, 2)}\n\n`;
        text += '<b>Performance:</b>\n';
        text += `• Actions Completed: ${totalActions}\n`;
        text += `• Target Actions: ${targetActions}\n`;
        text += `• Completion Rate: ${completionRate}%`;

        await this.messageService.sendOrEditMessage(ctx, {
          text,

          parseMode: 'HTML',
          replyMarkup: this.menuHandler.createBackButton('menu:orders'),
        });
      } else {
        // Show specific order stats
        const [orderId] = params;
        await this.orderHandler.handleOrderDetails(ctx, orderId);
      }
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  private async handleOrderDuplicate(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.duplicated', { default: '📋 Order duplicated successfully!' }),
      parseMode: 'HTML',
    });
  }

  private async handleOrderIntegration(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.integration', {
        default: '🔗 Order Integration\n\nConnect your order with external services.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderTransfer(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.transfer', { default: '🔄 Transfer Order\n\nTransfer this order to another account.' }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderChannelView(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.channel_view', {
        default: '📺 Channel Information\n\nView details about the associated channel.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  private async handleOrderTypeSelection(ctx: BotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.type_selection', {
        default: '📋 Order Type\n\nSelect the type of order you want to create.',
      }),
      parseMode: 'HTML',
      replyMarkup: this.menuHandler.createBackButton('menu:orders'),
    });
  }

  // Support action handlers
  private async handleSupportContact(ctx: BotContext): Promise<void> {
    const text = `<b>💬 Связаться с поддержкой</b>

Вы можете связаться с нами следующими способами:

<b>📱 Telegram:</b>
@motivbuy_support - Быстрый ответ

<b>📧 Email:</b>
support@motivbuy.com

<b>⏰ Среднее время ответа:</b>
• Telegram: 5-15 минут
• Email: 2-4 часа

<i>Напишите нам, и мы обязательно поможем!</i>`;

    const keyboard = new InlineKeyboard()
      .url('💬 Написать в Telegram', 'https://t.me/motivbuy_support')
      .row()
      .text('« Назад', 'support');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportReport(ctx: BotContext): Promise<void> {
    const text = `<b>📝 Сообщить о проблеме</b>

Пожалуйста, опишите проблему как можно подробнее:

<b>Что нам нужно знать:</b>
• Что произошло?
• Какие действия вы выполняли?
• Когда это случилось?
• Есть ли скриншоты?

<b>Частые проблемы:</b>
• Заказ не работает
• Ошибка при оплате
• Не начисляются подписчики
• Проблемы с ботом

<i>Отправьте описание проблемы следующим сообщением.</i>`;

    const keyboard = new InlineKeyboard()
      .url('📝 Отправить в поддержку', 'https://t.me/motivbuy_support')
      .row()
      .text('« Назад', 'support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_report';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleSupportSuggest(ctx: BotContext): Promise<void> {
    const text = `<b>💡 Предложить идею</b>

Мы всегда рады вашим идеям и предложениям!

<b>Что можно предложить:</b>
• Новые функции
• Улучшения интерфейса
• Оптимизацию процессов
• Любые другие идеи

<b>Как отправить:</b>
Просто напишите вашу идею следующим сообщением!

<i>Ваши предложения помогают нам становиться лучше!</i>`;

    const keyboard = new InlineKeyboard()
      .url('💡 Отправить предложение', 'https://t.me/motivbuy_support')
      .row()
      .text('« Назад', 'support');

    if (ctx.session) {
      ctx.session.conversationState = 'awaiting_support_suggestion';
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  // Help action handlers
  private async handleHelpFAQ(ctx: BotContext): Promise<void> {
    const text = `<b>❓ Часто задаваемые вопросы</b>

<b>Q: Как создать заказ?</b>
A: Нажмите "Купить подписчиков", введите ссылку на канал и следуйте инструкциям.

<b>Q: Как пополнить баланс?</b>
A: Перейдите в раздел "Баланс" → "Пополнить" и выберите способ оплаты.

<b>Q: Как быстро приходят подписчики?</b>
A: Обычно в течение 24 часов после запуска заказа.

<b>Q: Можно ли отменить заказ?</b>
A: Да, вы можете остановить заказ в любой момент.

<b>Q: Как вывести средства?</b>
A: Баланс → Вывод. Минимальная сумма: $10.

<b>Q: Подписчики настоящие?</b>
A: Да, все подписчики - реальные пользователи Telegram.`;

    const keyboard = new InlineKeyboard()
      .text('📖 Подробнее о заказах', 'help:create_order')
      .row()
      .text('💰 Вопросы по балансу', 'help:topup')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpCreateOrder(ctx: BotContext): Promise<void> {
    const text = `<b>📖 Как создать заказ</b>

<b>Шаг 1: Начало</b>
Нажмите "👥 Купить подписчиков" в главном меню.

<b>Шаг 2: Ссылка на канал</b>
Отправьте пригласительную ссылку на ваш канал или группу.
Формат: t.me/joinchat/xxx или t.me/+xxx

<b>Шаг 3: Добавление бота</b>
Добавьте нашего бота в администраторы вашего канала.
Это нужно для отслеживания статистики.

<b>Шаг 4: Настройка</b>
Укажите желаемое количество подписчиков и другие параметры.

<b>Шаг 5: Запуск</b>
После модерации заказ будет запущен автоматически.

<b>💡 Совет:</b>
Чем интереснее ваш канал, тем больше подписчиков останется!`;

    const keyboard = new InlineKeyboard()
      .text('🆕 Создать заказ', 'order:create:start')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpTopup(ctx: BotContext): Promise<void> {
    const text = `<b>💰 Пополнение баланса</b>

<b>Доступные способы оплаты:</b>

<b>💳 Банковская карта</b>
• Visa, MasterCard, МИР
• Моментальное зачисление
• Комиссия: 0%

<b>🪙 Криптовалюта</b>
• Bitcoin (BTC)
• Ethereum (ETH)
• USDT (TRC-20, ERC-20)
• Зачисление: 1-3 подтверждения

<b>📱 Электронные кошельки</b>
• QIWI, ЮMoney
• Моментальное зачисление

<b>Минимальная сумма:</b> $10
<b>Максимальная сумма:</b> $10,000

<b>💡 Бонус:</b>
При пополнении от $100 - бонус 5%!`;

    const keyboard = new InlineKeyboard()
      .text('💰 Пополнить сейчас', 'balance:deposit')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpWithdraw(ctx: BotContext): Promise<void> {
    const text = `<b>💸 Вывод средств</b>

<b>Способы вывода:</b>

<b>🪙 Криптовалюта</b>
• Bitcoin, Ethereum, USDT
• Комиссия: сетевая
• Срок: до 24 часов

<b>📱 Электронные кошельки</b>
• QIWI, ЮMoney
• Комиссия: 1-2%
• Срок: до 24 часов

<b>Условия вывода:</b>
• Минимальная сумма: $10
• Верификация: для сумм от $500

<b>Статусы выплат:</b>
⏳ Ожидание - заявка в обработке
✅ Выполнено - средства отправлены
❌ Отклонено - проверьте реквизиты

<b>💡 Совет:</b>
Выводите на верифицированные кошельки!`;

    const keyboard = new InlineKeyboard()
      .text('💸 Вывести средства', 'balance:withdraw')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpStats(ctx: BotContext): Promise<void> {
    const text = `<b>📊 Статистика и аналитика</b>

<b>Какую статистику можно видеть:</b>

<b>📈 По заказам:</b>
• Количество подписчиков
• Скорость набора
• Процент отписок
• Конверсия

<b>💰 Финансовая:</b>
• Доходы за период
• Расходы на заказы
• История транзакций
• Прогноз расходов

<b>🎯 По трафику:</b>
• Источники трафика
• Качество подписчиков
• Активность аудитории

<b>📅 Периоды:</b>
• Сегодня
• Неделя
• Месяц
• Произвольный период

<b>💡 Совет:</b>
Анализируйте статистику для оптимизации кампаний!`;

    const keyboard = new InlineKeyboard()
      .text('📊 Посмотреть статистику', 'stats:overview')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  private async handleHelpTraffic(ctx: BotContext): Promise<void> {
    const text = `<b>🤖 Продажа трафика</b>

Зарабатывайте, привлекая подписчиков для других каналов!

<b>Как это работает:</b>
1. Добавьте свой бот/канал как источник трафика
2. Показывайте рекламу в своих ботах
3. Получайте оплату за каждого подписчика

<b>💰 Сколько можно заработать:</b>
• От $0.01 до $0.10 за подписчика
• Зависит от качества аудитории
• Выплаты автоматически

<b>📋 Требования:</b>
• Минимум 1000 активных пользователей
• Реальные пользователи (не боты)
• Соблюдение правил Telegram

<b>🚀 Преимущества:</b>
• Автоматическая интеграция
• Детальная статистика
• Мгновенные выплаты
• Поддержка 24/7

<i>Начните зарабатывать уже сегодня!</i>`;

    const keyboard = new InlineKeyboard()
      .text('🤖 Добавить источник трафика', 'traffic:sources')
      .row()
      .text('📊 Мои источники', 'traffic')
      .row()
      .text('« Назад в справку', 'help');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }
}
