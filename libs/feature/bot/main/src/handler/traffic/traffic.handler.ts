/**
 * Traffic Action Handler
 *
 * Handles all traffic-related actions including:
 * - Buy Traffic menu (for customers)
 * - Sell Traffic menu (for traffic source owners)
 * - Traffic management menu
 * - Traffic Sources (CRUD operations)
 * - Traffic Targets (CRUD operations)
 * - Traffic Analytics
 */

import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import {
  AuthenticatedBotContext,
  BotContext,
  BotSubscriptionService,
  ChatInformation,
  ChatType,
  TelegramModerationNotifier,
} from '@app/feature-bot-shared';
import {
  CurrencyCode,
  ModerationEntityType,
  ModerationRequestEntity,
  ModerationStatus,
  TopicCategory,
  TrafficActionType,
  TrafficOrderEntity,
  TrafficOrderSourceEntity,
  TrafficOrderSourceStatus,
  TrafficOrderStatus,
  TrafficOrderTargetEntity,
  TrafficOrderTargetStatus,
  TrafficSourceBalanceRepository,
  TrafficSourceCategoriesEntity,
  TrafficSourceCategoryEntity,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficSourceStatus,
  TrafficSourceType,
  TrafficTargetEntity,
  TrafficTargetStatus,
  TrafficTargetType,
} from '@app/database';
import { SourceBalanceService, TrafficActionService } from '@app/feature-traffic-shared';
import { decimal, sum, toDisplayString } from '@app/common-shared';
import { MessageService } from '../../service/message.service';
import { MenuActionHandler } from '../menu-action.handler';
import { v7 as uuidv7 } from 'uuid';
import { PaymentConfigService } from '@app/feature-payment-shared';
import { UserBalanceOperationService } from '@app/feature-balance-shared';
import { BotConfigService } from '../../config/bot-config.service';

const categoriesPerPage = 9;

@Injectable()
export class TrafficHandler {
  private readonly logger = new Logger(TrafficHandler.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly messageService: MessageService,
    private readonly menuHandler: MenuActionHandler,
    private readonly moderationNotifier: TelegramModerationNotifier,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly userBalanceService: UserBalanceOperationService,
    private readonly botConfigService: BotConfigService,
    private readonly botSubscriptionService: BotSubscriptionService,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly sourceBalanceService: SourceBalanceService,
    private readonly trafficSourceBalanceRepository: TrafficSourceBalanceRepository,
    private readonly trafficActionService: TrafficActionService,
  ) {}

  private get currencySymbol(): string {
    return this.paymentConfigService.getBaseCurrencySymbol();
  }

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em() {
    return this.orm.em.fork();
  }

  /**
   * Create back button with translated text
   */
  private createBackButton(ctx: BotContext, returnTo: string): InlineKeyboard {
    return this.menuHandler.createBackButton(returnTo, ctx.t('common.back'));
  }

  /**
   * Safely answer callback query (skips for simulated callbacks from commands)
   */
  private async safeAnswerCallback(ctx: BotContext, text?: string): Promise<void> {
    const callbackId = ctx.callbackQuery?.id;

    if (!callbackId || callbackId.startsWith('cmd_')) {
      return;
    }

    try {
      await ctx.answerCallbackQuery(text);
    } catch {
      // Silently ignore errors
    }
  }

  /**
   * Handle Buy Traffic menu - shows user's targets (channels, groups, bots) for buying traffic
   */
  async handleBuyTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const targets = await this.em.find(
      TrafficTargetEntity,
      { managedBy: { id: ctx.user.id }, status: { $ne: TrafficTargetStatus.Deleted } },
      { orderBy: { createdAt: 'DESC' }, limit: 20 },
    );

    let text = ctx.t('traffic.buy_target.targets_list_title');

    if (targets.length === 0) {
      text += ctx.t('traffic.buy_target.no_targets');
    } else {
      text += ctx.t('traffic.buy_target.targets_count', { count: targets.length });

      targets.forEach((target) => {
        const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
        const typeLabel = this.getBuyTargetTypeLabel(ctx, target.type);
        const statusKey = `traffic.status.${target.status}`;
        const statusLabel = ctx.t(statusKey);
        const usernameInfo = target.username ? ` @${target.username}` : '';
        text += `${statusEmoji} <b>${target.name}</b>${usernameInfo}\n`;
        text += `   ${ctx.t('traffic.target_type_label')}: ${typeLabel}\n`;
        text += `   ${ctx.t('traffic.source_status')}: ${statusLabel}\n\n`;
      });
    }

    const keyboard = this.menuHandler.createBuyTrafficTargetsKeyboard(ctx, targets);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Sell Traffic menu - for users who want to monetize their bot/channel
   */
  async handleSellTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const baseCurrency = this.paymentConfigService.getBaseCurrency();
    const [sourcesCount, activeSourcesCount, balanceSummary] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: { id: ctx.user.id } }),
      this.em.count(TrafficSourceEntity, { managedBy: { id: ctx.user.id }, status: TrafficSourceStatus.Active }),
      this.userBalanceService.getBalanceSummary(ctx.user.id, baseCurrency),
    ]);

    const pendingEarnings = balanceSummary.locked;
    const availableBalance = balanceSummary.available;

    const text = `<b>💰 ${ctx.t('sell_traffic.title')}</b>

${ctx.t('sell_traffic.description')}

<b>📊 ${ctx.t('sell_traffic.your_stats')}:</b>
• ${ctx.t('sell_traffic.total_sources')}: ${sourcesCount}
• ${ctx.t('sell_traffic.active_sources')}: ${activeSourcesCount}
• ${ctx.t('sell_traffic.pending_earnings')}: ${this.currencySymbol}${pendingEarnings}
• ${ctx.t('sell_traffic.available_balance')}: ${this.currencySymbol}${availableBalance}

<b>💡 ${ctx.t('sell_traffic.how_to_earn')}:</b>
1. ${ctx.t('sell_traffic.step1')}
2. ${ctx.t('sell_traffic.step2')}
3. ${ctx.t('sell_traffic.step3')}
4. ${ctx.t('sell_traffic.step4')}

<i>${ctx.t('sell_traffic.select_action')} 👇</i>`;

    const keyboard = new InlineKeyboard();

    // Only show "My Sources" button if user has sources
    if (sourcesCount > 0) {
      keyboard.text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources');
    }

    keyboard
      .text(ctx.t('sell_traffic.btn_add_source'), 'traffic:sources:add')
      .row()
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic menu - main traffic management overview
   */
  async handleTrafficMenu(ctx: AuthenticatedBotContext): Promise<void> {
    const sources = await this.em.find(
      TrafficSourceEntity,
      { managedBy: { id: ctx.user.id } },
      { populate: ['orderAssignments'] },
    );

    const activeOrders = await this.em.count(TrafficOrderEntity, {
      creator: ctx.user.id,
      status: TrafficOrderStatus.Active,
    });

    const totalOrders = await this.em.count(TrafficOrderEntity, { creator: ctx.user.id });

    let text = `<b>${ctx.t('traffic.management_title')}</b>\n\n`;
    text += `<b>${ctx.t('common.overview')}:</b>\n`;
    text += `• ${ctx.t('traffic.sources')}: ${sources.length}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('orders.total')}: ${totalOrders}\n\n`;

    if (sources.length > 0) {
      text += `<b>${ctx.t('traffic.your_sources')}:</b>\n`;
      sources.slice(0, 5).forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        text += `${statusEmoji} ${source.name} (${source.type})\n`;
      });

      if (sources.length > 5) {
        text += `... ${ctx.t('common.and_more')} ${sources.length - 5} ${ctx.t('common.more')}\n`;
      }
    } else {
      text += `<i>${ctx.t('traffic.no_sources')}</i>`;
    }

    const keyboard = this.menuHandler.createTrafficMenuKeyboard(ctx);
    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Traffic Source CRUD Operations
   */

  async handleTrafficSourcesList(ctx: AuthenticatedBotContext): Promise<void> {
    const sources = await this.em.find(
      TrafficSourceEntity,
      { managedBy: { id: ctx.user.id }, status: { $ne: TrafficSourceStatus.Deleted } },
      { orderBy: { createdAt: 'DESC' }, limit: 10, populate: ['categories.category'] },
    );

    let text = ctx.t('traffic.sources_list_title');

    if (sources.length === 0) {
      text += ctx.t('traffic.no_sources', {
        default: '<i>No traffic sources yet. Click "Add New Source" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.sources_count', {
        default: `Total: ${sources.length} source(s)\n\n`,
        count: sources.length,
      });

      sources.forEach((source) => {
        const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
        const typeLabel =
          source.type === TrafficSourceType.Bot ? ctx.t('traffic.type_bot') : ctx.t('traffic.type_bot_with_token');

        const statusLabel = ctx.t(`traffic.status.${source.status}`);

        // Get all categories
        const categoryLinks = source.categories?.getItems() || [];
        const sortedCategories = [...categoryLinks].sort((a, b) => a.sortOrder - b.sortOrder);
        const categoryNames = sortedCategories.map((c) => this.getCategoryLocalizedName(ctx, c.category.getEntity()));
        const categoryLabel =
          categoryNames.length > 0 ? categoryNames.join(', ') : ctx.t('traffic.category.no_category');

        const categoryHeaderKey =
          categoryNames.length > 1 ? 'traffic.category.source_categories' : 'traffic.category.source_category';

        text += `${statusEmoji} <b>${source.name}</b>\n`;
        text += `   ${ctx.t('traffic.source_type')}: ${typeLabel}\n`;
        text += `   ${ctx.t(categoryHeaderKey)}: ${categoryLabel}\n`;
        text += `   ${ctx.t('traffic.source_status')}: ${statusLabel}\n\n`;
      });
    }

    const sourcesList = sources.map((s) => ({ id: s.id, name: s.name, status: s.status }));
    const keyboard = this.menuHandler.createTrafficSourcesKeyboard(ctx, sourcesList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceAdd(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceCreate';
      ctx.session.formData = { step: 'select_type' };
    }

    const text = ctx.t('traffic.select_source_type');
    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.type_bot'), 'traffic:source:type:bot')
      .row()
      .text(ctx.t('traffic.type_bot_with_token'), 'traffic:source:type:bot_with_token')
      .row()
      .text(ctx.t('common.back'), 'traffic:sources');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceTypeSelect(ctx: AuthenticatedBotContext, type: 'bot' | 'bot_with_token'): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceCreate';
      ctx.session.formData = {
        step: type === 'bot' ? 'enter_username' : 'enter_token',
        type: type === 'bot' ? TrafficSourceType.Bot : TrafficSourceType.BotWithToken,
      };
    }

    const text = type === 'bot' ? ctx.t('traffic.enter_bot_username') : ctx.t('traffic.enter_bot_token');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'traffic:sources:add'),
    });
  }

  async handleTrafficSourceView(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(
      TrafficSourceEntity,
      { id: sourceId, managedBy: { id: ctx.user.id } },
      { populate: ['categories.category'] },
    );

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderSourceEntity, { trafficSource: source.id });
    const statusEmoji = source.status === TrafficSourceStatus.Active ? '✅' : '❌';
    const typeLabel =
      source.type === TrafficSourceType.Bot ? ctx.t('traffic.type_bot') : ctx.t('traffic.type_bot_with_token');

    const statusLabel = ctx.t(`traffic.status.${source.status}`);

    // Get all categories (sorted by sortOrder)
    const categoryLinks = source.categories?.getItems() || [];
    const sortedCategories = [...categoryLinks].sort((a, b) => a.sortOrder - b.sortOrder);
    const categoryNames = sortedCategories.map((c) => this.getCategoryLocalizedName(ctx, c.category.getEntity()));
    const categoryLabel = categoryNames.length > 0 ? categoryNames.join(', ') : ctx.t('traffic.category.no_category');

    const categoryHeaderKey =
      categoryNames.length > 1 ? 'traffic.category.source_categories' : 'traffic.category.source_category';

    let text = ctx.t('traffic.source_details_title');
    text += `<b>${ctx.t('traffic.source_name')}:</b> ${source.name}\n`;
    text += `<b>${ctx.t('traffic.source_type')}:</b> ${typeLabel}\n`;
    text += `<b>${ctx.t('traffic.source_status')}:</b> ${statusEmoji} ${statusLabel}\n`;
    text += `<b>${ctx.t(categoryHeaderKey)}:</b> ${categoryLabel}\n`;

    if (source.botUsername) {
      text += `<b>${ctx.t('traffic.bot_username')}:</b> @${source.botUsername}\n`;
    }

    if (source.description) {
      text += `<b>${ctx.t('traffic.source_description')}:</b> ${source.description}\n`;
    }

    text += `\n<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('traffic.total_orders_label')}: ${ordersCount}\n`;
    text += `• ${ctx.t('traffic.created_at')}: ${this.messageService.formatDate(ctx, source.createdAt)}\n`;

    const keyboard = this.menuHandler.createTrafficSourceDetailKeyboard(ctx, sourceId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceEdit(ctx: BotContext, sourceId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceEdit';
      ctx.session.formData = { sourceId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_source'),
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  async handleTrafficSourceToggle(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Only allow toggling for approved sources (Active/Inactive)
    // Pending and Declined sources require moderation
    if (source.status === TrafficSourceStatus.Pending || source.status === TrafficSourceStatus.Declined) {
      await this.safeAnswerCallback(ctx, ctx.t('traffic.source_toggle_not_allowed'));

      return;
    }

    source.status =
      source.status === TrafficSourceStatus.Active ? TrafficSourceStatus.Inactive : TrafficSourceStatus.Active;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.source_status_toggled'));

    await this.handleTrafficSourceView(ctx, sourceId);
  }

  async handleTrafficSourceDelete(ctx: BotContext, sourceId: string): Promise<void> {
    // Use shorter callback format to stay within Telegram's 64-byte limit
    // Format: traf:src:del:Y:<id> (confirm) or traf:src:del:N:<id> (cancel)
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `traf:src:del:Y:${sourceId}`)
      .text(ctx.t('common.buttons.cancel'), `traf:src:del:N:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_source_confirm', {
        default:
          '<b>⚠️ Delete Traffic Source</b>\n\nAre you sure you want to delete this traffic source?\n\n<b>This action cannot be undone!</b>',
      }),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic Source Delete Confirm
   * Uses soft delete via status change - no data is actually deleted
   */
  async handleTrafficSourceDeleteConfirm(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const sourceName = source.name;

    // Cancel all order-source assignments and cancel related orders
    const orderSources = await this.em.find(
      TrafficOrderSourceEntity,
      { trafficSource: source.id },
      { populate: ['trafficOrder'] },
    );

    for (const os of orderSources) {
      // Cancel the order-source junction entry
      os.status = TrafficOrderSourceStatus.Cancelled;

      // Cancel active/paused orders for this source
      const order = os.trafficOrder.getEntity();
      if (order.status === TrafficOrderStatus.Active || order.status === TrafficOrderStatus.Paused) {
        order.status = TrafficOrderStatus.Cancelled;
      }
    }

    // Soft delete the source by changing status
    source.status = TrafficSourceStatus.Deleted;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.source_deleted'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.source_deleted_success', {
        default: `<b>✅ Traffic Source Deleted</b>\n\nSource "${sourceName}" has been successfully deleted.`,
        name: sourceName,
      }),
      replyMarkup: this.createBackButton(ctx, 'traffic:sources'),
    });
  }

  async handleTrafficSourceStats(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Query via junction table to get order counts for this source
    const orderSources = await this.em.find(
      TrafficOrderSourceEntity,
      { trafficSource: source.id },
      { populate: ['trafficOrder'] },
    );

    const totalOrders = orderSources.length;
    const activeOrders = orderSources.filter((os) => {
      const order = os.trafficOrder.getEntity();

      return order.status === TrafficOrderStatus.Active;
    }).length;

    const completedOrders = orderSources.filter((os) => {
      const order = os.trafficOrder.getEntity();

      return order.status === TrafficOrderStatus.Completed;
    }).length;

    const text =
      ctx.t('traffic.source_stats_title', { name: source.name }) +
      ctx.t('traffic.source_stats_orders', {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
      }) +
      ctx.t('traffic.source_stats_dates', {
        created: this.messageService.formatDate(ctx, source.createdAt),
        updated: this.messageService.formatDate(ctx, source.updatedAt),
      });

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  /**
   * Handle Source Earnings - shows source balance with transfer option
   */
  async handleSourceEarnings(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const balance = await this.sourceBalanceService.getSourceBalance(sourceId, CurrencyCode.Rub);

    let text = ctx.t('traffic.source_earnings.title');
    text += ctx.t('traffic.source_earnings.source_name', { name: source.name });

    if (!balance || (balance.available === 0 && balance.pending === 0 && balance.totalEarned === 0)) {
      text += ctx.t('traffic.source_earnings.no_earnings');
    } else {
      text += `<b>${ctx.t('traffic.source_earnings.available')}:</b> ${this.currencySymbol}${toDisplayString(balance.available.toString(), 2)}\n`;
      text += `<b>${ctx.t('traffic.source_earnings.pending')}:</b> ${this.currencySymbol}${toDisplayString(balance.pending.toString(), 2)}\n`;
      text += `<b>${ctx.t('traffic.source_earnings.total_earned')}:</b> ${this.currencySymbol}${toDisplayString(balance.totalEarned.toString(), 2)}\n`;
      text += `<b>${ctx.t('traffic.source_earnings.total_withdrawn')}:</b> ${this.currencySymbol}${toDisplayString(balance.totalWithdrawn.toString(), 2)}\n`;
    }

    const keyboard = new InlineKeyboard();

    if (balance && balance.available > 0) {
      keyboard.text(ctx.t('traffic.source_earnings.transfer_all_btn'), `traf:earn:xfer:${sourceId}`);
      keyboard.row();
    }

    keyboard.text(ctx.t('common.back'), `traffic:source:view:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Source Earnings Transfer - confirm and execute transfer to user wallet
   */
  async handleSourceEarningsTransfer(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const balance = await this.sourceBalanceService.getSourceBalance(sourceId, CurrencyCode.Rub);

    if (!balance || balance.available <= 0) {
      await this.safeAnswerCallback(ctx, ctx.t('traffic.source_earnings.no_balance_to_transfer'));
      await this.handleSourceEarnings(ctx, sourceId);

      return;
    }

    const result = await this.sourceBalanceService.transferAllToUserBalance(sourceId, ctx.user.id, CurrencyCode.Rub);

    if (result.err) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_earnings.transfer_failed'),
        replyMarkup: this.createBackButton(ctx, `traffic:source:earnings:${sourceId}`),
      });

      return;
    }

    const transfer = result.val;
    const text = ctx.t('traffic.source_earnings.transfer_success', {
      currency: this.currencySymbol,
      amount: toDisplayString(transfer.amount.toString(), 2),
      sourceBalance: toDisplayString(transfer.sourceBalanceAfter.toString(), 2),
      walletBalance: toDisplayString(transfer.userBalanceAfter.toString(), 2),
    });

    await this.safeAnswerCallback(
      ctx,
      ctx.t('traffic.source_earnings.transfer_success', {
        currency: '',
        amount: toDisplayString(transfer.amount.toString(), 2),
        sourceBalance: '',
        walletBalance: '',
      }),
    );

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `traffic:source:view:${sourceId}`),
    });
  }

  /**
   * Complete a traffic action for a user
   * Called by source bots when verifying task completion
   *
   * MONEY FLOW:
   * TrafficOrderBalanceEntity (escrow) → TrafficSourceBalanceEntity
   *
   * @param orderId - The order ID
   * @param sourceId - The traffic source ID
   * @param userId - The Telegram user ID who completed the action
   * @param actionType - The type of action (join, subscribe, etc.)
   * @returns Result with reward amount or error
   */
  async completeTrafficAction(
    orderId: string,
    sourceId: string,
    userId: number,
    actionType: TrafficActionType = TrafficActionType.Join,
  ): Promise<{ success: boolean; reward?: string; error?: string }> {
    this.logger.log(`Completing traffic action for order ${orderId}, source ${sourceId}, user ${userId}`);

    const result = await this.trafficActionService.completeAction({
      orderId,
      sourceId,
      userId,
      actionType,
    });

    if (result.err) {
      this.logger.error(`Failed to complete action: ${result.val.message}`);

      return { success: false, error: result.val.message };
    }

    this.logger.log(`Action completed successfully. Reward: ${result.val.reward}`);

    return { success: true, reward: result.val.reward };
  }

  /**
   * Check if a user has completed a traffic action
   */
  async hasCompletedTrafficAction(orderId: string, sourceId: string, userId: number): Promise<boolean> {
    return this.trafficActionService.hasCompletedAction(orderId, sourceId, userId);
  }

  /**
   * Handle Traffic Source Integration - shows API key and integration guide
   */
  async handleTrafficSourceIntegration(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    const hasApiKey = Boolean(source.apiKeyHash);
    const docsUrl = this.botConfigService.getApiDocsUrl();

    let text = ctx.t('traffic.integration.title');
    text += `<b>${ctx.t('traffic.source_name')}:</b> ${source.name}\n\n`;

    if (hasApiKey) {
      // Show masked API key info (prefix + asterisks)
      const maskedKey = source.apiKeyPrefix ? `${source.apiKeyPrefix}${'*'.repeat(56)}` : '********';
      text += `${ctx.t('traffic.integration.api_key_label')}\n`;
      text += ctx.t('traffic.integration.api_key_spoiler', { apiKey: maskedKey });
    } else {
      text += ctx.t('traffic.integration.no_api_key');
    }

    text += ctx.t('traffic.integration.quick_guide_title');
    text += `\n${ctx.t('traffic.integration.quick_guide_step1')}`;
    text += `\n${ctx.t('traffic.integration.quick_guide_step2')}`;
    text += `\n${ctx.t('traffic.integration.quick_guide_step3')}`;

    if (docsUrl) {
      text += ctx.t('traffic.integration.docs_link', { docsUrl });
    }

    text += ctx.t('traffic.integration.copy_hint');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.integration.regenerate_btn'), `traffic:source:regen:${sourceId}`)
      .row()
      .text(ctx.t('common.back'), `traffic:source:view:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic Source Regenerate API Key - confirmation dialog
   */
  async handleTrafficSourceRegenerateConfirm(ctx: BotContext, sourceId: string): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `traf:rg:Y:${sourceId}`)
      .text(ctx.t('common.buttons.cancel'), `traf:rg:N:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.integration.regenerate_confirm'),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic Source Regenerate API Key - execute regeneration
   */
  async handleTrafficSourceRegenerateKey(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Generate new API key using repository method
    const newApiKey = await this.trafficSourceRepository.regenerateApiKey(sourceId);

    const docsUrl = this.botConfigService.getApiDocsUrl();

    let text = ctx.t('traffic.integration.title');
    text += `<b>${ctx.t('traffic.source_name')}:</b> ${source.name}\n\n`;
    text += `${ctx.t('traffic.integration.regenerate_success')}\n\n`;
    text += `${ctx.t('traffic.integration.api_key_label')}\n`;
    text += ctx.t('traffic.integration.api_key_spoiler', { apiKey: newApiKey });

    text += ctx.t('traffic.integration.quick_guide_title');
    text += `\n${ctx.t('traffic.integration.quick_guide_step1')}`;
    text += `\n${ctx.t('traffic.integration.quick_guide_step2')}`;
    text += `\n${ctx.t('traffic.integration.quick_guide_step3')}`;

    if (docsUrl) {
      text += ctx.t('traffic.integration.docs_link', { docsUrl });
    }

    text += ctx.t('traffic.integration.copy_hint');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.integration.regenerate_btn'), `traffic:source:regen:${sourceId}`)
      .row()
      .text(ctx.t('common.back'), `traffic:source:view:${sourceId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });

    await this.safeAnswerCallback(ctx, ctx.t('traffic.integration.regenerate_success'));
  }

  /**
   * Traffic Target CRUD Operations
   */

  async handleTrafficTargetsList(ctx: AuthenticatedBotContext): Promise<void> {
    const targets = await this.em.find(
      TrafficTargetEntity,
      { managedBy: { id: ctx.user.id }, status: { $ne: TrafficTargetStatus.Deleted } },
      { orderBy: { createdAt: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.targets_list_title');

    if (targets.length === 0) {
      text += ctx.t('traffic.no_targets', {
        default: '<i>No traffic targets yet. Click "Add New Target" to create one!</i>',
      });
    } else {
      text += ctx.t('traffic.targets_count', {
        default: `Total: ${targets.length} target(s)\n\n`,
        count: targets.length,
      });

      targets.forEach((target) => {
        const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
        const typeLabel = this.getBuyTargetTypeLabel(ctx, target.type);
        const statusLabel = ctx.t(`traffic.status.${target.status}`);
        text += `${statusEmoji} <b>${target.name}</b>\n`;
        text += `   ${ctx.t('traffic.target_type_label')}: ${typeLabel}\n`;
        text += `   ${ctx.t('traffic.source_status')}: ${statusLabel}\n\n`;
      });
    }

    const targetsList = targets.map((t) => ({ id: t.id, name: t.name, status: t.status }));
    const keyboard = this.menuHandler.createTrafficTargetsKeyboard(ctx, targetsList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficTargetAdd(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficTargetCreate';
      ctx.session.formData = { step: 'enter_name' };
    }

    const text = ctx.t('traffic.add_target_title') + ctx.t('traffic.add_target_instructions');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'traffic:targets'),
    });
  }

  async handleTrafficTargetView(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const ordersCount = await this.em.count(TrafficOrderTargetEntity, { trafficTarget: target.id });
    const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
    const typeLabel = this.getBuyTargetTypeLabel(ctx, target.type);
    const statusLabel = ctx.t(`traffic.status.${target.status}`);

    let text = ctx.t('traffic.target_details_title');
    text += `<b>${ctx.t('traffic.target_name')}:</b> ${target.name}\n`;
    text += `<b>${ctx.t('traffic.target_type_label')}:</b> ${typeLabel}\n`;
    text += `<b>${ctx.t('traffic.source_status')}:</b> ${statusEmoji} ${statusLabel}\n`;

    if (target.username) {
      text += `<b>${ctx.t('traffic.target_username')}:</b> @${target.username}\n`;
    }

    if (target.inviteLink) {
      text += `<b>${ctx.t('traffic.target_invite_link')}:</b> ${target.inviteLink}\n`;
    }

    if (target.description) {
      text += `<b>${ctx.t('traffic.source_description')}:</b> ${target.description}\n`;
    }

    if (target.pricePerMember) {
      text += `<b>${ctx.t('traffic.target_price_per_member')}:</b> ${this.currencySymbol}${toDisplayString(target.pricePerMember, 2)}\n`;
    }

    text += `\n<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('traffic.total_orders_label')}: ${ordersCount}\n`;
    text += `• ${ctx.t('traffic.created_at')}: ${this.messageService.formatDate(ctx, target.createdAt)}\n`;

    const keyboard = this.menuHandler.createTrafficTargetDetailKeyboard(ctx, targetId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficTargetEdit(ctx: BotContext, targetId: string): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'trafficTargetEdit';
      ctx.session.formData = { targetId, step: 'select_field' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.edit_target'),
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  async handleTrafficTargetToggle(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    target.status =
      target.status === TrafficTargetStatus.Active ? TrafficTargetStatus.Inactive : TrafficTargetStatus.Active;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.target_status_toggled'));

    await this.handleTrafficTargetView(ctx, targetId);
  }

  async handleTrafficTargetDelete(ctx: BotContext, targetId: string): Promise<void> {
    // Use shorter callback format to stay within Telegram's 64-byte limit
    // Format: traf:tgt:del:Y:<id> (confirm) or traf:tgt:del:N:<id> (cancel)
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `traf:tgt:del:Y:${targetId}`)
      .text(ctx.t('common.buttons.cancel'), `traf:tgt:del:N:${targetId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.delete_target_confirm', {
        default:
          '<b>⚠️ Delete Traffic Target</b>\n\nAre you sure you want to delete this traffic target?\n\n<b>This action cannot be undone!</b>',
      }),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Traffic Target Delete Confirm
   * Uses soft delete via status change - no data is actually deleted
   */
  async handleTrafficTargetDeleteConfirm(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const targetName = target.name;

    // Cancel all order-target assignments and cancel related orders
    const orderTargets = await this.em.find(
      TrafficOrderTargetEntity,
      { trafficTarget: target.id },
      { populate: ['trafficOrder'] },
    );

    for (const ot of orderTargets) {
      // Cancel the order-target junction entry
      ot.status = TrafficOrderTargetStatus.Cancelled;

      // Cancel active/paused orders for this target
      const order = ot.trafficOrder.getEntity();
      if (order.status === TrafficOrderStatus.Active || order.status === TrafficOrderStatus.Paused) {
        order.status = TrafficOrderStatus.Cancelled;
      }
    }

    // Soft delete the target by changing status
    target.status = TrafficTargetStatus.Deleted;

    await this.em.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.target_deleted'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.target_deleted_success', {
        default: `<b>✅ Traffic Target Deleted</b>\n\nTarget "${targetName}" has been successfully deleted.`,
        name: targetName,
      }),
      replyMarkup: this.createBackButton(ctx, 'traffic:targets'),
    });
  }

  async handleTrafficTargetStats(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    // Query via junction table to get order counts for this target
    const orderTargets = await this.em.find(
      TrafficOrderTargetEntity,
      { trafficTarget: target.id },
      { populate: ['trafficOrder'] },
    );

    const totalOrders = orderTargets.length;
    const activeOrders = orderTargets.filter((ot) => {
      const order = ot.trafficOrder.getEntity();

      return order.status === TrafficOrderStatus.Active;
    }).length;

    const completedOrders = orderTargets.filter((ot) => {
      const order = ot.trafficOrder.getEntity();

      return order.status === TrafficOrderStatus.Completed;
    }).length;

    let text = ctx.t('traffic.target_stats_title', {
      default: `<b>📊 Target Statistics: ${target.name}</b>\n\n`,
      name: target.name,
    });

    text += `<b>${ctx.t('traffic.orders')}:</b>\n`;
    text += `• ${ctx.t('orders.total')}: ${totalOrders}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('orders.completed')}: ${completedOrders}\n\n`;
    text += `<b>${ctx.t('traffic.created_at')}:</b> ${this.messageService.formatDate(ctx, target.createdAt)}\n`;
    text += `<b>${ctx.t('traffic.last_updated')}:</b> ${this.messageService.formatDate(ctx, target.updatedAt)}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `traffic:target:view:${targetId}`),
    });
  }

  /**
   * Buy Traffic Target CRUD Operations
   */

  /**
   * Handle Add Buy Traffic Target - show type selection
   */
  async handleBuyTrafficTargetAdd(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'buyTargetCreate';
      ctx.session.formData = { step: 'select_type' };
    }

    const text = ctx.t('traffic.buy_target.select_target_type');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.buy_target.type_channel'), 'buy:target:type:channel')
      .row()
      .text(ctx.t('traffic.buy_target.type_group'), 'buy:target:type:group')
      .row()
      .text(ctx.t('traffic.buy_target.type_bot'), 'buy:target:type:bot')
      .row()
      .text(ctx.t('common.back'), 'menu:buy_traffic');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic Target Type Selection - go to mode selection
   */
  async handleBuyTrafficTargetTypeSelect(
    ctx: AuthenticatedBotContext,
    type: 'channel' | 'group' | 'bot',
  ): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'buyTargetCreate';
      ctx.session.formData = {
        step: 'select_mode',
        type,
      };
    }

    const text = ctx.t('traffic.buy_target.select_delivery_mode');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.buy_target.mode_direct'), 'buy:target:mode:direct')
      .row()
      .text(ctx.t('traffic.buy_target.mode_moderated'), 'buy:target:mode:moderated')
      .row()
      .text(ctx.t('common.back'), 'buy:target:add');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic Target Mode Selection - go to link/token input
   */
  async handleBuyTrafficTargetModeSelect(ctx: AuthenticatedBotContext, mode: 'direct' | 'moderated'): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const type = 'type' in formData ? String(formData.type) : 'channel';

    if (ctx.session) {
      ctx.session.formData = {
        step: 'enter_link',
        type,
        mode,
      };
    }

    const textKeyMap: Record<string, string> = {
      channel: 'traffic.buy_target.enter_channel_link',
      group: 'traffic.buy_target.enter_group_link',
      bot: 'traffic.buy_target.enter_bot_token',
    };

    const text = ctx.t(textKeyMap[type]);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, `buy:target:type:${type}`),
    });
  }

  /**
   * Handle Buy Traffic Target View - show target details with orders
   */
  async handleBuyTrafficTargetView(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    // Get orders count for this target
    const orderTargets = await this.em.find(
      TrafficOrderTargetEntity,
      { trafficTarget: target.id },
      { populate: ['trafficOrder'] },
    );

    const totalOrders = orderTargets.length;
    const activeOrders = orderTargets.filter((ot) => {
      const order = ot.trafficOrder.getEntity();

      return order.status === TrafficOrderStatus.Active;
    }).length;

    const statusEmoji = target.status === TrafficTargetStatus.Active ? '✅' : '❌';
    const typeLabel = this.getBuyTargetTypeLabel(ctx, target.type);
    const statusKey = `traffic.status.${target.status}`;
    const statusLabel = ctx.t(statusKey);
    const modeLabel = target.requiresApproval
      ? ctx.t('traffic.buy_target.mode_moderated')
      : ctx.t('traffic.buy_target.mode_direct');

    let text = ctx.t('traffic.buy_target.target_details_title');
    text += `<b>${ctx.t('traffic.target_name')}:</b> ${target.name}\n`;
    text += `<b>${ctx.t('traffic.target_type_label')}:</b> ${typeLabel}\n`;
    text += `<b>${ctx.t('traffic.buy_target.delivery_mode_label')}:</b> ${modeLabel}\n`;
    text += `<b>${ctx.t('traffic.source_status')}:</b> ${statusEmoji} ${statusLabel}\n`;

    if (target.username) {
      text += `<b>Username:</b> @${target.username}\n`;
    }

    if (target.inviteLink) {
      text += `<b>Link:</b> ${target.inviteLink}\n`;
    }

    text += `\n<b>${ctx.t('common.statistics')}:</b>\n`;
    text += `• ${ctx.t('traffic.total_orders_label')}: ${totalOrders}\n`;
    text += `• ${ctx.t('orders.active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('traffic.created_at')}: ${this.messageService.formatDate(ctx, target.createdAt)}\n`;

    const keyboard = this.menuHandler.createBuyTrafficTargetDetailKeyboard(ctx, targetId);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic Target Orders - list orders for a specific target
   */
  async handleBuyTrafficTargetOrders(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    // Get orders for this target via junction table (exclude deleted/cancelled)
    const orderTargets = await this.em.find(
      TrafficOrderTargetEntity,
      {
        trafficTarget: target.id,
        trafficOrder: {
          status: { $nin: [TrafficOrderStatus.Deleted, TrafficOrderStatus.Cancelled] },
        },
      },
      { populate: ['trafficOrder'], orderBy: { id: 'DESC' }, limit: 10 },
    );

    let text = ctx.t('traffic.buy_target.orders_for_target', { name: target.name });

    if (orderTargets.length === 0) {
      text += ctx.t('traffic.buy_target.no_orders_for_target');
    } else {
      text += ctx.t('traffic.buy_target.orders_count', { count: orderTargets.length });

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
        const orderStatusKey = `orders.status.${order.status}`;
        const orderStatusLabel = ctx.t(orderStatusKey);
        text += `${emoji} <b>#${order.orderId}</b>\n`;
        text += `   ${ctx.t('orders.progress')}: ${order.currentCount}/${order.targetCount}\n`;
        text += `   ${ctx.t('traffic.source_status')}: ${orderStatusLabel}\n\n`;
      });
    }

    const keyboard = this.menuHandler.createBuyTrafficTargetOrdersKeyboard(ctx, targetId, orderTargets);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic Target Remove - confirmation dialog
   */
  async handleBuyTrafficTargetRemove(ctx: BotContext, targetId: string): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text(ctx.t('common.buttons.confirm'), `buy:tgt:del:Y:${targetId}`)
      .text(ctx.t('common.buttons.cancel'), `buy:tgt:del:N:${targetId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.buy_target.remove_target_confirm'),
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle Buy Traffic Target Remove Confirm
   * Uses soft delete via status change - no data is actually deleted
   */
  async handleBuyTrafficTargetRemoveConfirm(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const entityManager = this.em; // Use single fork for consistency
    const target = await entityManager.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    const targetName = target.name;

    // Cancel all order-target assignments and pause/cancel related orders
    const orderTargets = await entityManager.find(
      TrafficOrderTargetEntity,
      { trafficTarget: target.id },
      { populate: ['trafficOrder'] },
    );

    for (const ot of orderTargets) {
      // Cancel the order-target junction entry
      ot.status = TrafficOrderTargetStatus.Cancelled;

      // Cancel active orders for this target
      const order = ot.trafficOrder.getEntity();
      if (order.status === TrafficOrderStatus.Active || order.status === TrafficOrderStatus.Paused) {
        order.status = TrafficOrderStatus.Cancelled;
      }
    }

    // Soft delete the target by changing status
    target.status = TrafficTargetStatus.Deleted;

    await entityManager.flush();

    await this.safeAnswerCallback(ctx, ctx.t('traffic.buy_target.target_removed'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.buy_target.target_removed_success', { name: targetName }),
      replyMarkup: this.createBackButton(ctx, 'menu:buy_traffic'),
    });
  }

  /**
   * Handle Buy Traffic Target Create Input - process user input for target creation
   */
  async handleBuyTrafficTargetCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';
    const type = 'type' in formData ? String(formData.type) : 'channel';
    const mode = 'mode' in formData ? String(formData.mode) : 'direct';

    if (step === 'enter_link') {
      await this.createBuyTrafficTarget(
        ctx,
        input,
        type as 'channel' | 'group' | 'bot',
        mode as 'direct' | 'moderated',
      );
    }
  }

  /**
   * Create a buy traffic target from user input
   */
  private async createBuyTrafficTarget(
    ctx: AuthenticatedBotContext,
    input: string,
    type: 'channel' | 'group' | 'bot',
    mode: 'direct' | 'moderated',
  ): Promise<void> {
    const cleanInput = input.trim();
    const requiresApproval = mode === 'moderated';

    // Handle bot type - validate by token
    if (type === 'bot') {
      await this.createBotTarget(ctx, cleanInput, requiresApproval);

      return;
    }

    // Handle channel/group type - validate by username/link
    await this.createChannelOrGroupTarget(ctx, cleanInput, type, requiresApproval);
  }

  /**
   * Create bot target by validating token via Telegram API
   */
  private async createBotTarget(ctx: AuthenticatedBotContext, token: string, requiresApproval: boolean): Promise<void> {
    // Validate bot token format
    if (!/^\d+:[A-Za-z0-9_-]{35}$/.test(token)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.buy_target.invalid_bot_token'),
        replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
      });

      return;
    }

    try {
      // Verify bot via Telegram API
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();

      if (!data.ok || !data.result) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('traffic.buy_target.bot_not_found'),
          replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
        });

        return;
      }

      const botInfo = data.result;
      const name = botInfo.first_name || botInfo.username;
      const { username } = botInfo;
      const telegramId = String(botInfo.id);

      // Create the target
      const newTarget = new TrafficTargetEntity({
        name,
        username,
        telegramId,
        managedById: ctx.user.id,
        type: TrafficTargetType.Bot,
        status: TrafficTargetStatus.Active,
        requiresApproval,
        config: { botToken: token },
      });

      await this.em.persistAndFlush(newTarget);
      this.clearSessionState(ctx);

      const typeLabel = this.getBuyTargetTypeLabel(ctx, TrafficTargetType.Bot);
      const text = ctx.t('traffic.buy_target.target_created', { name, type: typeLabel });

      const keyboard = new InlineKeyboard()
        .text(ctx.t('traffic.view_target'), `buy:target:view:${newTarget.id}`)
        .row()
        .text(ctx.t('traffic.buy_target.btn_my_targets'), 'menu:buy_traffic')
        .text(ctx.t('common.back'), 'menu:main');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: keyboard,
      });
    } catch (error) {
      this.logger.error('Failed to verify bot token', { error });
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.buy_target.invalid_bot_token'),
        replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
      });
    }
  }

  /**
   * Create channel or group target by validating via Telegram API
   */
  private async createChannelOrGroupTarget(
    ctx: AuthenticatedBotContext,
    input: string,
    type: 'channel' | 'group',
    requiresApproval: boolean,
  ): Promise<void> {
    const chatIdentifier = this.parseChatInput(input);

    if (!chatIdentifier) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.buy_target.invalid_link'),
        replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
      });

      return;
    }

    // Verify via bot's getChat API
    await this.verifyAndCreateChatTarget(ctx, chatIdentifier, type, requiresApproval);
  }

  /**
   * Parse chat input and return chat identifier (username or ID)
   * Returns null if input is invalid or is a private invite link
   */
  private parseChatInput(input: string): string | null {
    // @username format
    if (input.startsWith('@')) {
      return input;
    }

    // Private invite links are NOT supported - must use chat ID instead
    if (/^https?:\/\/t\.me\/\+/.test(input)) {
      return null;
    }

    // Public links - extract username
    if (/^https?:\/\/t\.me\//.test(input)) {
      const [extractedUsername] = input.replace(/https?:\/\/t\.me\//, '').split('/');

      return `@${extractedUsername}`;
    }

    // Numeric chat ID (can be negative for groups/channels)
    if (/^-?\d+$/.test(input)) {
      return input;
    }

    // Plain username without @
    if (/^[a-zA-Z]\w{4,31}$/.test(input)) {
      return `@${input}`;
    }

    return null;
  }

  /**
   * Verify chat via Telegram API and create target
   */
  private async verifyAndCreateChatTarget(
    ctx: AuthenticatedBotContext,
    chatIdentifier: string,
    type: 'channel' | 'group',
    requiresApproval: boolean,
  ): Promise<void> {
    try {
      const botToken = this.botConfigService.getBotToken();
      const chatInfo = await this.botSubscriptionService.getChatInfo(botToken, chatIdentifier);

      const isValidType = this.isValidChatType(chatInfo.type, type);

      if (!isValidType) {
        await this.showChatTypeMismatchError(ctx, type, chatInfo.type);

        return;
      }

      // Check bot permissions
      const permissions = await this.botSubscriptionService.getBotPermissions(botToken, chatInfo.id);

      if (!permissions.isMember) {
        await this.showChatAccessError(ctx, type);

        return;
      }

      if (!permissions.canInviteUsers) {
        await this.showBotPermissionError(ctx, type);

        return;
      }

      await this.persistVerifiedChatTarget(ctx, chatInfo, type, requiresApproval);
    } catch (error) {
      this.logger.error('Failed to verify channel/group', { error, type, chatIdentifier });
      await this.showChatAccessError(ctx, type);
    }
  }

  /**
   * Check if chat type matches expected type
   */
  private isValidChatType(chatType: ChatType, expectedType: 'channel' | 'group'): boolean {
    const expectedTypes: Record<string, ChatType[]> = {
      channel: [ChatType.Channel],
      group: [ChatType.Group, ChatType.Supergroup],
    };

    return expectedTypes[expectedType].includes(chatType);
  }

  /**
   * Get bot username from BotConfigService (set after bot.init())
   */
  private getBotUsername(): string {
    return this.botConfigService.getBotUsername();
  }

  /**
   * Show chat not found error
   */
  private async showChatNotFoundError(ctx: AuthenticatedBotContext, type: 'channel' | 'group'): Promise<void> {
    const errorKey = type === 'channel' ? 'traffic.buy_target.channel_not_found' : 'traffic.buy_target.group_not_found';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t(errorKey),
      replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
    });
  }

  /**
   * Show chat type mismatch error (user selected channel but entered group, or vice versa)
   */
  private async showChatTypeMismatchError(
    ctx: AuthenticatedBotContext,
    expectedType: 'channel' | 'group',
    actualType: ChatType,
  ): Promise<void> {
    const actualTypeLabels: Record<ChatType, string> = {
      [ChatType.Channel]: ctx.t('traffic.target_type.channel'),
      [ChatType.Group]: ctx.t('traffic.target_type.group'),
      [ChatType.Supergroup]: ctx.t('traffic.target_type.group'),
      [ChatType.Private]: ctx.t('traffic.target_type.private'),
    };

    const actualTypeName = actualTypeLabels[actualType];

    const errorKey =
      expectedType === 'channel'
        ? 'traffic.buy_target.channel_type_mismatch'
        : 'traffic.buy_target.group_type_mismatch';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t(errorKey, { actualType: actualTypeName }),
      replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
    });
  }

  /**
   * Show chat access error
   */
  private async showChatAccessError(ctx: AuthenticatedBotContext, type: 'channel' | 'group'): Promise<void> {
    const errorKey =
      type === 'channel' ? 'traffic.buy_target.channel_not_accessible' : 'traffic.buy_target.group_not_accessible';

    const botUsername = this.getBotUsername();

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t(errorKey, { botUsername }),
      replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
    });
  }

  /**
   * Show bot permission error (bot is member but lacks invite permission)
   */
  private async showBotPermissionError(ctx: AuthenticatedBotContext, type: 'channel' | 'group'): Promise<void> {
    const errorKey =
      type === 'channel' ? 'traffic.buy_target.channel_no_permission' : 'traffic.buy_target.group_no_permission';

    const botUsername = this.getBotUsername();

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t(errorKey, { botUsername }),
      replyMarkup: this.createBackButton(ctx, 'buy:target:add'),
    });
  }

  /**
   * Persist verified chat target to database
   */
  private async persistVerifiedChatTarget(
    ctx: AuthenticatedBotContext,
    chatInfo: ChatInformation,
    type: 'channel' | 'group',
    requiresApproval: boolean,
  ): Promise<void> {
    const name = chatInfo.title ?? chatInfo.username ?? 'Unnamed';
    const { username } = chatInfo;
    const telegramId = String(chatInfo.id);
    const targetType = type === 'channel' ? TrafficTargetType.Channel : TrafficTargetType.Group;

    const newTarget = new TrafficTargetEntity({
      name,
      username,
      telegramId,
      managedById: ctx.user.id,
      type: targetType,
      status: TrafficTargetStatus.Active,
      requiresApproval,
    });

    await this.em.persistAndFlush(newTarget);
    this.clearSessionState(ctx);

    const typeLabel = this.getBuyTargetTypeLabel(ctx, targetType);
    const text = ctx.t('traffic.buy_target.target_created', { name, type: typeLabel });

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.view_target'), `buy:target:view:${newTarget.id}`)
      .row()
      .text(ctx.t('traffic.buy_target.btn_my_targets'), 'menu:buy_traffic')
      .text(ctx.t('common.back'), 'menu:main');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Get localized target type label for buy traffic
   */
  private getBuyTargetTypeLabel(ctx: BotContext, type: TrafficTargetType): string {
    const typeKeyMap: Record<TrafficTargetType, string> = {
      [TrafficTargetType.Channel]: 'traffic.target_type.channel',
      [TrafficTargetType.Group]: 'traffic.target_type.group',
      [TrafficTargetType.Bot]: 'traffic.target_type.bot',
      [TrafficTargetType.WithChecking]: 'traffic.target_type.channel',
    };

    return ctx.t(typeKeyMap[type]);
  }

  /**
   * Traffic Analytics
   */
  async handleTrafficAnalytics(ctx: AuthenticatedBotContext): Promise<void> {
    const [sourcesCount, targetsCount, totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficSourceEntity, { managedBy: { id: ctx.user.id } }),
      this.em.count(TrafficTargetEntity, { managedBy: { id: ctx.user.id } }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id }),
      this.em.count(TrafficOrderEntity, {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Active,
      }),
      this.em.count(TrafficOrderEntity, { creator: ctx.user.id, status: TrafficOrderStatus.Completed }),
    ]);

    const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
    const totalSpent = sum(orders.map((o) => decimal(o.spentAmount || '0')));
    const totalBudget = sum(orders.map((o) => decimal(o.totalBudget || '0')));

    let text = ctx.t('traffic.analytics_title');
    text += `<b>${ctx.t('traffic.analytics_resources')}:</b>\n`;
    text += `• ${ctx.t('traffic.analytics_traffic_sources')}: ${sourcesCount}\n`;
    text += `• ${ctx.t('traffic.analytics_traffic_targets')}: ${targetsCount}\n\n`;
    text += `<b>${ctx.t('traffic.analytics_orders')}:</b>\n`;
    text += `• ${ctx.t('traffic.analytics_total')}: ${totalOrders}\n`;
    text += `• ${ctx.t('traffic.analytics_active')}: ${activeOrders}\n`;
    text += `• ${ctx.t('traffic.analytics_completed')}: ${completedOrders}\n\n`;
    text += `<b>${ctx.t('traffic.analytics_financial')}:</b>\n`;
    text += `• ${ctx.t('traffic.analytics_total_budget')}: ${this.currencySymbol}${toDisplayString(totalBudget, 2)}\n`;
    text += `• ${ctx.t('traffic.analytics_total_spent')}: ${this.currencySymbol}${toDisplayString(totalSpent, 2)}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: this.createBackButton(ctx, 'menu:traffic'),
    });
  }

  /**
   * Input handlers for conversation flows
   */

  async handleTrafficSourceCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';

    if (step === 'enter_username') {
      await this.createSourceFromUsername(ctx, input);
    } else if (step === 'enter_token') {
      await this.createSourceFromToken(ctx, input);
    }
  }

  /**
   * Create traffic source from bot username - stores data and shows category selection
   */
  private async createSourceFromUsername(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    // Store source data in session for later creation
    if (ctx.session) {
      ctx.session.formData = {
        step: 'select_category',
        type: TrafficSourceType.Bot,
        name: input,
        botUsername: input.replace('@', ''),
        categoryPage: 0,
      };
    }

    await this.showCategorySelection(ctx, 0);
  }

  /**
   * Create traffic source from bot token - validates token and shows category selection
   */
  private async createSourceFromToken(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${input}/getMe`);
      const data = await response.json();

      if (!data.ok || !data.result) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('traffic.invalid_bot_token'),
        });

        return;
      }

      const botInfo = data.result;

      // Store source data in session for later creation
      if (ctx.session) {
        ctx.session.formData = {
          step: 'select_category',
          type: TrafficSourceType.BotWithToken,
          name: botInfo.first_name,
          botUsername: botInfo.username,
          botToken: input,
          categoryPage: 0,
        };
      }

      await this.showCategorySelection(ctx, 0);
    } catch (error) {
      this.logger.error('Failed to get bot info from token', { error });
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.invalid_bot_token'),
      });
    }
  }

  /**
   * Show category selection keyboard with pagination
   */
  async showCategorySelection(ctx: AuthenticatedBotContext, page: number): Promise<void> {
    const categories = await this.em.find(
      TrafficSourceCategoryEntity,
      { isActive: true, categoryType: { $ne: TopicCategory.All } },
      { orderBy: { sortOrder: 'ASC', name: 'ASC' } },
    );

    const totalPages = Math.ceil(categories.length / categoriesPerPage);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const startIdx = currentPage * categoriesPerPage;
    const pageCategories = categories.slice(startIdx, startIdx + categoriesPerPage);

    const keyboard = new InlineKeyboard();

    // Add category buttons in rows of 3
    pageCategories.forEach((category, idx) => {
      const categoryName = this.getCategoryLocalizedName(ctx, category);
      keyboard.text(categoryName, `traffic:source:category:${category.categoryType}`);

      if ((idx + 1) % 3 === 0) {
        keyboard.row();
      }
    });

    // Ensure we're on a new row for navigation
    if (pageCategories.length % 3 !== 0) {
      keyboard.row();
    }

    // Pagination buttons
    const navButtons: Array<{ text: string; callback: string }> = [];

    if (currentPage > 0) {
      navButtons.push({
        text: ctx.t('traffic.category.btn_prev'),
        callback: `traffic:source:catpage:${currentPage - 1}`,
      });
    }

    if (currentPage < totalPages - 1) {
      navButtons.push({
        text: ctx.t('traffic.category.btn_next'),
        callback: `traffic:source:catpage:${currentPage + 1}`,
      });
    }

    navButtons.forEach((btn) => keyboard.text(btn.text, btn.callback));

    if (navButtons.length > 0) {
      keyboard.row();
    }

    // Skip and back buttons
    keyboard.text(ctx.t('traffic.category.btn_skip'), 'traffic:source:category:skip');
    keyboard.row();
    keyboard.text(ctx.t('common.back'), 'traffic:sources:add');

    const text = `${ctx.t('traffic.category.select_prompt')}\n\n${ctx.t('traffic.category.page_info', {
      current: currentPage + 1,
      total: totalPages,
    })}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Get localized category name from entity or fallback to locale key
   */
  private getCategoryLocalizedName(ctx: BotContext, category: TrafficSourceCategoryEntity): string {
    const locale = ctx.from?.language_code === 'ru' ? 'ru' : 'en';

    // First try entity's localized name
    if (category.name && typeof category.name === 'object') {
      const localizedName = category.name[locale] || category.name.en;

      if (localizedName) {
        return localizedName;
      }
    }

    // Fallback to locale key
    return ctx.t(`traffic.categories.${category.categoryType}`);
  }

  /**
   * Handle category page change
   */
  async handleCategoryPageChange(ctx: AuthenticatedBotContext, page: number): Promise<void> {
    if (ctx.session?.formData && typeof ctx.session.formData === 'object') {
      (ctx.session.formData as Record<string, unknown>).categoryPage = page;
    }

    await this.showCategorySelection(ctx, page);
  }

  /**
   * Handle category selection and create source
   */
  async handleCategorySelect(ctx: AuthenticatedBotContext, categoryType: string): Promise<void> {
    const formData = ctx.session?.formData;

    if (!formData || typeof formData !== 'object') {
      await this.handleTrafficSourcesList(ctx);

      return;
    }

    const { em } = this;
    const type = 'type' in formData ? (formData.type as TrafficSourceType) : TrafficSourceType.Bot;
    const name = 'name' in formData ? String(formData.name) : '';
    const botUsername = 'botUsername' in formData ? String(formData.botUsername) : '';
    const botToken = 'botToken' in formData ? String(formData.botToken) : undefined;

    const newSource = new TrafficSourceEntity({
      name,
      botUsername,
      botToken,
      managedById: ctx.user.id,
      type,
      status: TrafficSourceStatus.Pending,
    });

    newSource.id = uuidv7();

    em.persist(newSource);

    // Link category if not skipped
    if (categoryType !== 'skip') {
      const category = await em.findOne(TrafficSourceCategoryEntity, { categoryType: categoryType as TopicCategory });

      if (category) {
        const categoryLink = new TrafficSourceCategoriesEntity({
          trafficSourceId: newSource.id,
          categoryId: category.id,
          isPrimary: true,
          sortOrder: 0,
        });

        em.persist(categoryLink);
      }
    }

    // Create moderation request
    const moderationRequest = new ModerationRequestEntity({
      entityType: ModerationEntityType.TrafficSource,
      entityId: newSource.id,
      status: ModerationStatus.Pending,
    });

    em.persist(moderationRequest);
    await em.flush();

    // Notify moderators
    const notificationResult = await this.moderationNotifier.notifySourceCreated(newSource, moderationRequest);

    if (notificationResult) {
      moderationRequest.telegramChatId = notificationResult.chatId;
      moderationRequest.telegramMessageId = notificationResult.messageId.toString();
      await em.flush();
    }

    this.clearSessionState(ctx);
    await this.showSourceCreatedMessage(ctx, newSource, botUsername || name);
  }

  /**
   * Start category change flow for existing source
   */
  async handleCategoryChangeStart(ctx: AuthenticatedBotContext, sourceId: string): Promise<void> {
    const source = await this.em.findOne(
      TrafficSourceEntity,
      { id: sourceId, managedBy: { id: ctx.user.id } },
      { populate: ['categories.category'] },
    );

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Get current category types from source
    const categoryItems = source.categories?.getItems() || [];
    const currentCategoryTypes = categoryItems
      .map((c) => c.category.getEntity().categoryType)
      .filter((ct): ct is TopicCategory => ct !== null);

    // Store source ID and selected categories in session
    if (ctx.session) {
      ctx.session.conversationState = 'trafficSourceCategoryChange';
      ctx.session.formData = {
        step: 'select_category',
        sourceId,
        categoryPage: 0,
        selectedCategories: currentCategoryTypes,
      };
    }

    await this.showCategorySelectionForEdit(ctx, sourceId, 0, currentCategoryTypes);
  }

  /**
   * Show category selection for editing existing source (multi-select, max 5)
   */
  async showCategorySelectionForEdit(
    ctx: AuthenticatedBotContext,
    sourceId: string,
    page: number,
    selectedCategories: string[] = [],
  ): Promise<void> {
    const categories = await this.em.find(
      TrafficSourceCategoryEntity,
      { isActive: true, categoryType: { $ne: TopicCategory.All } },
      { orderBy: { sortOrder: 'ASC', name: 'ASC' } },
    );

    const maxCategories = 5;
    const totalPages = Math.ceil(categories.length / categoriesPerPage);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const startIdx = currentPage * categoriesPerPage;
    const pageCategories = categories.slice(startIdx, startIdx + categoriesPerPage);

    const keyboard = new InlineKeyboard();

    // Add category buttons in rows of 3 with checkmarks for selected
    // Use short callback format: traf:ct:<categoryType> (toggle category)
    pageCategories.forEach((category, idx) => {
      const isSelected = selectedCategories.includes(category.categoryType ?? '');
      const checkmark = isSelected ? '✓ ' : '';
      const categoryName = this.getCategoryLocalizedName(ctx, category);
      keyboard.text(`${checkmark}${categoryName}`, `traf:ct:${category.categoryType}`);

      if ((idx + 1) % 3 === 0) {
        keyboard.row();
      }
    });

    // Ensure we're on a new row for navigation
    if (pageCategories.length % 3 !== 0) {
      keyboard.row();
    }

    // Pagination buttons - use short format: traf:cp:<page>
    const navButtons: Array<{ text: string; callback: string }> = [];

    if (currentPage > 0) {
      navButtons.push({
        text: ctx.t('traffic.category.btn_prev'),
        callback: `traf:cp:${currentPage - 1}`,
      });
    }

    if (currentPage < totalPages - 1) {
      navButtons.push({
        text: ctx.t('traffic.category.btn_next'),
        callback: `traf:cp:${currentPage + 1}`,
      });
    }

    navButtons.forEach((btn) => keyboard.text(btn.text, btn.callback));

    if (navButtons.length > 0) {
      keyboard.row();
    }

    // Done button (save categories)
    keyboard.text(ctx.t('common.buttons.done'), 'traf:cd');

    // Cancel button - go back to source view
    keyboard.text(ctx.t('common.buttons.cancel'), `traf:cv:${sourceId}`);

    const selectedCount = selectedCategories.length;
    const text = `${ctx.t('traffic.category.select_multi_prompt', { max: maxCategories })}\n\n${ctx.t('traffic.category.selected_count', { count: selectedCount, max: maxCategories })}\n\n${ctx.t(
      'traffic.category.page_info',
      {
        current: currentPage + 1,
        total: totalPages,
      },
    )}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  /**
   * Handle category page change for editing
   */
  async handleCategoryEditPageChange(ctx: AuthenticatedBotContext, sourceId: string, page: number): Promise<void> {
    const formData = ctx.session?.formData as { selectedCategories?: string[]; categoryPage?: number } | undefined;
    const selectedCategories = formData?.selectedCategories ?? [];

    if (ctx.session?.formData && typeof ctx.session.formData === 'object') {
      (ctx.session.formData as Record<string, unknown>).categoryPage = page;
    }

    await this.showCategorySelectionForEdit(ctx, sourceId, page, selectedCategories);
  }

  /**
   * Toggle category selection (add/remove from session)
   */
  async handleCategoryToggle(ctx: AuthenticatedBotContext, categoryType: string): Promise<void> {
    const maxCategories = 5;
    const formData = ctx.session?.formData as
      | {
          sourceId?: string;
          selectedCategories?: string[];
          categoryPage?: number;
        }
      | undefined;

    if (!formData?.sourceId) {
      return;
    }

    const selectedCategories = formData.selectedCategories ?? [];
    const currentPage = formData.categoryPage ?? 0;

    // Toggle category
    const categoryIndex = selectedCategories.indexOf(categoryType);

    if (categoryIndex > -1) {
      // Remove category
      selectedCategories.splice(categoryIndex, 1);
    } else {
      // Add category (if under limit)
      if (selectedCategories.length >= maxCategories) {
        await this.safeAnswerCallback(ctx, ctx.t('traffic.category.max_reached', { max: maxCategories }));

        return;
      }

      selectedCategories.push(categoryType);
    }

    // Update session
    if (ctx.session?.formData && typeof ctx.session.formData === 'object') {
      (ctx.session.formData as Record<string, unknown>).selectedCategories = selectedCategories;
    }

    // Refresh the category selection UI
    await this.showCategorySelectionForEdit(ctx, formData.sourceId, currentPage, selectedCategories);
  }

  /**
   * Save selected categories to source
   */
  async handleCategorySave(ctx: AuthenticatedBotContext): Promise<void> {
    const { em } = this;
    const formData = ctx.session?.formData as
      | {
          sourceId?: string;
          selectedCategories?: string[];
        }
      | undefined;

    if (!formData?.sourceId) {
      return;
    }

    const { sourceId } = formData;
    const selectedCategories = formData.selectedCategories ?? [];

    const source = await em.findOne(
      TrafficSourceEntity,
      { id: sourceId, managedBy: { id: ctx.user.id } },
      { populate: ['categories.category'] },
    );

    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    // Remove all existing category links
    const existingLinks = source.categories?.getItems() || [];

    for (const link of existingLinks) {
      em.remove(link);
    }

    // Fetch all categories in parallel
    const categoryPromises = selectedCategories.map((categoryType) =>
      em.findOne(TrafficSourceCategoryEntity, {
        categoryType: categoryType as TopicCategory,
      }),
    );

    const categories = await Promise.all(categoryPromises);

    // Add new category links
    categories.forEach((category, i) => {
      if (category) {
        const categoryLink = new TrafficSourceCategoriesEntity({
          trafficSourceId: source.id,
          categoryId: category.id,
          isPrimary: i === 0, // First category is primary
          sortOrder: i,
        });

        em.persist(categoryLink);
      }
    });

    await em.flush();

    this.clearSessionState(ctx);

    const count = selectedCategories.length;
    await this.safeAnswerCallback(ctx, ctx.t('traffic.category.saved', { count }));

    // Refresh the source view
    await this.handleTrafficSourceView(ctx, sourceId);
  }

  /**
   * Persist source and create moderation request
   */
  private async persistSourceWithModeration(em: EntityManager, source: TrafficSourceEntity): Promise<void> {
    em.persist(source);

    const moderationRequest = new ModerationRequestEntity({
      entityType: ModerationEntityType.TrafficSource,
      entityId: source.id,
      status: ModerationStatus.Pending,
    });

    em.persist(moderationRequest);
    await em.flush();

    const notificationResult = await this.moderationNotifier.notifySourceCreated(source, moderationRequest);

    if (notificationResult) {
      moderationRequest.telegramChatId = notificationResult.chatId;
      moderationRequest.telegramMessageId = notificationResult.messageId.toString();
      await em.flush();
    }
  }

  /**
   * Clear session state after source creation
   */
  private clearSessionState(ctx: AuthenticatedBotContext): void {
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }
  }

  /**
   * Show source created success message
   */
  private async showSourceCreatedMessage(
    ctx: AuthenticatedBotContext,
    source: TrafficSourceEntity,
    displayName: string,
  ): Promise<void> {
    const text = ctx.t('traffic.source_created', { name: displayName });

    const keyboard = new InlineKeyboard()
      .text(ctx.t('traffic.view_source'), `traffic:source:view:${source.id}`)
      .row()
      .text(ctx.t('sell_traffic.btn_my_sources'), 'traffic:sources')
      .text(ctx.t('common.back'), 'menu:sell_traffic');

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });
  }

  async handleTrafficSourceEditInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const sourceId = 'sourceId' in formData ? String(formData.sourceId) : '';

    if (!sourceId) {
      return;
    }

    const source = await this.em.findOne(TrafficSourceEntity, { id: sourceId, managedBy: { id: ctx.user.id } });
    if (!source) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.source_not_found'),
      });

      return;
    }

    source.name = input;
    await this.em.flush();

    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.source_updated', { name: input }),
    });

    await this.handleTrafficSourceView(ctx, sourceId);
  }

  async handleTrafficTargetCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';

    if (step === 'enter_name') {
      const newTarget = new TrafficTargetEntity({
        name: input,
        managedById: ctx.user.id,
        type: TrafficTargetType.Channel,
        status: TrafficTargetStatus.Active,
        requiresApproval: false,
      });

      await this.em.persistAndFlush(newTarget);

      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = undefined;
      }

      const text = ctx.t('traffic.target_created', { name: input });

      const keyboard = new InlineKeyboard()
        .text(ctx.t('traffic.view_target'), `traffic:target:view:${newTarget.id}`)
        .row()
        .text(ctx.t('traffic.targets'), 'traffic:targets')
        .text(ctx.t('common.back'), 'menu:sell_traffic');

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: keyboard,
      });
    }
  }

  async handleTrafficTargetEditInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const targetId = 'targetId' in formData ? String(formData.targetId) : '';

    if (!targetId) {
      return;
    }

    const target = await this.em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });
    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
      });

      return;
    }

    target.name = input;
    await this.em.flush();

    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('traffic.target_updated', { name: input }),
    });

    await this.handleTrafficTargetView(ctx, targetId);
  }
}
