/**
 * Order Action Handler
 *
 * Handles traffic order-related actions including viewing,
 * creating, and managing orders.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext, TelegramModerationNotifier } from '@app/feature-bot-shared';
import { MikroORM, EntityManager } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import {
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficOrderSourceEntity,
  TrafficOrderSourceStatus,
  TrafficOrderTargetEntity,
  TrafficOrderTargetStatus,
  TrafficTargetEntity,
  TrafficTargetType,
  TrafficTargetStatus,
  ModerationRequestEntity,
  ModerationEntityType,
  ModerationStatus,
} from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, multiply, toDbString, toDisplayString, lessThan } from '@app/common-shared';
import { MessageService } from '../service/message.service';
import { v7 as uuidv7 } from 'uuid';
import { PaymentConfigService } from '@app/feature-payment-shared';
import { UserBalanceOperationService } from '@app/feature-balance-shared';

@Injectable()
export class OrderActionHandler {
  private readonly logger = new Logger(OrderActionHandler.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly moderationNotifier: TelegramModerationNotifier,
    private readonly userBalanceService: UserBalanceOperationService,
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
   * Handle orders list view (all orders, like sources list)
   */
  async handleOrdersList(ctx: AuthenticatedBotContext): Promise<void> {
    const orders = await this.em.find(
      TrafficOrderEntity,
      {
        creator: ctx.user.id,
        status: { $nin: [TrafficOrderStatus.Deleted, TrafficOrderStatus.Cancelled] },
      },
      {
        orderBy: { createdAt: 'DESC' },
        limit: 10,
        populate: ['orderTargets', 'orderTargets.trafficTarget'],
      },
    );

    let text = ctx.t('orders.list_title', { default: '<b>📋 My Orders</b>\n\n' });

    if (orders.length === 0) {
      text += ctx.t('orders.no_orders', {
        default: '<i>No orders yet. Click "New Order" to create one!</i>',
      });
    } else {
      text += ctx.t('orders.list_count', {
        default: `Total: ${orders.length} order(s)\n\n`,
        count: orders.length,
      });

      const statusEmojis: Record<string, string> = {
        [TrafficOrderStatus.Pending]: '⏳',
        [TrafficOrderStatus.Moderation]: '🔍',
        [TrafficOrderStatus.Active]: '✅',
        [TrafficOrderStatus.Paused]: '⏸️',
        [TrafficOrderStatus.Completed]: '✔️',
        [TrafficOrderStatus.Failed]: '💥',
      };

      orders.forEach((order) => {
        const emoji = statusEmojis[order.status] ?? '❓';
        const orderTargets = order.orderTargets?.getItems() ?? [];
        const primaryTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
        const targetName = primaryTarget?.trafficTarget?.getEntity()?.name ?? order.orderId;
        const statusLabel = ctx.t(`orders.status.${order.status}`, { default: order.status });

        text += `${emoji} <b>${targetName}</b>\n`;
        text += `   ${ctx.t('orders.type')}: ${order.type}\n`;
        text += `   ${ctx.t('orders.status_label')}: ${statusLabel}\n\n`;
      });
    }

    const ordersList = orders.map((o) => {
      const orderTargets = o.orderTargets?.getItems() ?? [];
      const primaryTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
      const targetName = primaryTarget?.trafficTarget?.getEntity()?.name ?? o.orderId;

      return {
        orderId: o.orderId,
        type: o.type,
        status: o.status,
        targetName,
      };
    });

    const keyboard = this.menuHandler.createOrdersListKeyboard(ctx, ordersList);

    await this.messageService.sendOrEditMessage(ctx, {
      text,
      replyMarkup: keyboard,
    });

    this.logger.log('Orders list viewed', { userId: ctx.user.id, count: orders.length });
  }

  /**
   * Handle order creation start
   */
  async handleCreateOrderStart(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'orderCreate';
      ctx.session.formData = { step: 'select_type' };
    }

    const typeKeyboard = this.createOrderTypeKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: `➕ <b>${ctx.t('orders.create_title')}</b>\n\n${ctx.t('orders.select_type')}`,

      replyMarkup: typeKeyboard,
    });
  }

  /**
   * Handle order details view
   */
  async handleOrderDetails(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(
      TrafficOrderEntity,
      { orderId },
      {
        populate: [
          'orderSources',
          'orderTargets',
          'orderSources.trafficSource',
          'orderTargets.trafficTarget',
          'creator',
        ],
      },
    );

    if (!order) {
      const keyboard = new InlineKeyboard().text(ctx.t('common.back'), 'orders:list');
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: keyboard,
      });

      return;
    }

    const detailsText = await this.formatOrderDetails(order, ctx);
    const keyboard = this.createOrderDetailsKeyboard(orderId, order.status, ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: detailsText,

      replyMarkup: keyboard,
    });

    this.logger.log('Order details viewed', { orderId });
  }

  /**
   * Handle order search
   */
  async handleOrderSearch(ctx: AuthenticatedBotContext): Promise<void> {
    if (ctx.session) {
      ctx.session.conversationState = 'order_search';
      ctx.session.formData = { step: 'enter_query' };
    }

    await this.messageService.sendOrEditMessage(ctx, {
      text: `🔍 <b>${ctx.t('orders.search_title')}</b>\n\n` + ctx.t('orders.search_prompt'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
    });
  }

  /**
   * Format orders list
   */
  private formatOrdersList(
    ctx: AuthenticatedBotContext,
    orders: TrafficOrderEntity[],
    title: string,
    page: number,
    totalPages: number,
  ): string {
    let text = `<b>📦 ${title}</b> (${ctx.t('common.page', { page, total: totalPages })})\n\n`;

    for (const order of orders) {
      const progress = decimal(order.currentCount).div(order.targetCount).mul(100);
      const progressDisplay = toDisplayString(progress, 1);
      const statusEmoji = this.getStatusEmoji(order.status);
      const budgetDisplay = toDisplayString(order.totalBudget, 2);

      text +=
        `${statusEmoji} <b>${order.type}</b> - <code>${order.orderId}</code>\n` +
        `${ctx.t('orders.progress')}: ${order.currentCount}/${order.targetCount} (${progressDisplay}%)\n` +
        `${ctx.t('orders.budget')}: ${this.currencySymbol}${budgetDisplay}\n` +
        `${ctx.t('orders.status.active')}: ${order.status}\n\n`;
    }

    return text;
  }

  /**
   * Format order details
   */
  private async formatOrderDetails(order: TrafficOrderEntity, ctx: AuthenticatedBotContext): Promise<string> {
    const progress = decimal(order.currentCount).div(order.targetCount).mul(100);
    const progressDisplay = toDisplayString(progress, 1);
    const statusEmoji = this.getStatusEmoji(order.status);

    // Get primary target from junction table
    const orderTargets = order.orderTargets?.getItems() ?? [];
    const primaryOrderTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
    const target = primaryOrderTarget?.trafficTarget?.getEntity();

    if (!target) {
      return ctx.t('orders.details_not_found');
    }

    const totalBudgetDisplay = toDisplayString(order.totalBudget, 2);
    const spentAmountDisplay = toDisplayString(order.spentAmount, 2);
    const pricePerActionDisplay = toDisplayString(order.pricePerAction, 4);

    const symbol = this.currencySymbol;

    const statusLabel = ctx.t(`orders.status.${order.status}`, { default: order.status });

    // Get audience targeting info
    const requirements = order.requirements ?? {};
    const genderKey = requirements.gender ?? 'any';
    const genderLabel = ctx.t(`orders.gender.${genderKey}`);
    const hasAgeRestriction = requirements.minAge !== undefined || requirements.maxAge !== undefined;
    const ageLabel = hasAgeRestriction
      ? `${requirements.minAge ?? 0}-${requirements.maxAge ?? 100}`
      : ctx.t('orders.age.any');

    return (
      `${statusEmoji} <b>${ctx.t('orders.details_title')}</b>\n\n` +
      `<b>${ctx.t('orders.order_id')}:</b> <code>${order.orderId}</code>\n` +
      `<b>${ctx.t('orders.type')}:</b> ${order.type}\n` +
      `<b>${ctx.t('orders.status_label')}:</b> ${statusLabel}\n\n` +
      `<b>${ctx.t('orders.progress')}:</b>\n` +
      `• ${ctx.t('orders.current')}: ${order.currentCount}\n` +
      `• ${ctx.t('orders.target')}: ${order.targetCount}\n` +
      `• ${ctx.t('orders.completion')}: ${progressDisplay}%\n\n` +
      `<b>${ctx.t('orders.budget')}:</b>\n` +
      `• ${ctx.t('orders.total')}: ${symbol}${totalBudgetDisplay}\n` +
      `• ${ctx.t('orders.spent')}: ${symbol}${spentAmountDisplay}\n` +
      `• ${ctx.t('orders.price_per_action')}: ${symbol}${pricePerActionDisplay}\n\n` +
      `<b>${ctx.t('orders.audience.btn_gender')}:</b> ${genderLabel}\n` +
      `<b>${ctx.t('orders.audience.btn_age')}:</b> ${ageLabel}\n\n` +
      `<b>${ctx.t('orders.target_label')}:</b> ${target.name}\n\n` +
      (order.description ? `<b>${ctx.t('orders.description')}:</b>\n${order.description}\n\n` : '') +
      `<b>${ctx.t('orders.created')}:</b> ${this.messageService.formatDateTime(ctx, order.createdAt)}\n` +
      (order.completedAt
        ? `<b>${ctx.t('orders.completed')}:</b> ${this.messageService.formatDateTime(ctx, order.completedAt)}`
        : '')
    );
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: TrafficOrderStatus): string {
    const emojiMap: Record<TrafficOrderStatus, string> = {
      [TrafficOrderStatus.Pending]: '⏳',
      [TrafficOrderStatus.Moderation]: '🔍',
      [TrafficOrderStatus.Active]: '✅',
      [TrafficOrderStatus.Paused]: '⏸️',
      [TrafficOrderStatus.Completed]: '✅',
      [TrafficOrderStatus.Cancelled]: '❌',
      [TrafficOrderStatus.Failed]: '⚠️',
      [TrafficOrderStatus.Deleted]: '🗑️',
    };

    return emojiMap[status] || '❓';
  }

  /**
   * Create order type keyboard
   */
  private createOrderTypeKeyboard(ctx: AuthenticatedBotContext) {
    return new InlineKeyboard()
      .text(ctx.t('orders.type_join'), 'order:type:join')
      .text(ctx.t('orders.type_subscribe'), 'order:type:subscribe')
      .row()
      .text(ctx.t('common.cancel'), 'orders:list');
  }

  /**
   * Create order details keyboard based on status
   *
   * Status → Buttons mapping:
   * - Pending:   Settings, Delete, Back (awaiting moderation, can edit or cancel)
   * - Active:    Refresh, Settings, Pause, Delete, Back (running, full control)
   * - Paused:    Refresh, Settings, Start, Delete, Back (stopped, can resume)
   * - Completed: Back (done, view only)
   * - Cancelled: Back (cancelled, view only)
   * - Failed:    Retry, Delete, Back (error, can retry or remove)
   */
  private createOrderDetailsKeyboard(orderId: string, status: TrafficOrderStatus, ctx: AuthenticatedBotContext) {
    const keyboard = new InlineKeyboard();

    const keyboardBuilders: Record<TrafficOrderStatus, () => void> = {
      [TrafficOrderStatus.Pending]: () => {
        keyboard
          .text(ctx.t('orders.view.btn_settings'), `order:config:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_delete'), `order:delete:${orderId}`);
      },
      [TrafficOrderStatus.Moderation]: () => {
        // Awaiting moderation - can view settings or cancel
        keyboard
          .text(ctx.t('orders.view.btn_settings'), `order:config:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_delete'), `order:delete:${orderId}`);
      },
      [TrafficOrderStatus.Active]: () => {
        keyboard
          .text(ctx.t('common.refresh'), `order:details:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_settings'), `order:config:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_stop'), `order:toggle:${orderId}`)
          .text(ctx.t('orders.view.btn_delete'), `order:delete:${orderId}`);
      },
      [TrafficOrderStatus.Paused]: () => {
        keyboard
          .text(ctx.t('common.refresh'), `order:details:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_settings'), `order:config:${orderId}`)
          .row()
          .text(ctx.t('orders.view.btn_start'), `order:toggle:${orderId}`)
          .text(ctx.t('orders.view.btn_delete'), `order:delete:${orderId}`);
      },
      [TrafficOrderStatus.Completed]: () => {
        // View only - no actions
      },
      [TrafficOrderStatus.Cancelled]: () => {
        // View only - no actions
      },
      [TrafficOrderStatus.Failed]: () => {
        keyboard
          .text(ctx.t('orders.view.btn_start'), `order:toggle:${orderId}`)
          .text(ctx.t('orders.view.btn_delete'), `order:delete:${orderId}`);
      },
      [TrafficOrderStatus.Deleted]: () => {
        // View only - no actions (should not be visible in lists)
      },
    };

    const builder = keyboardBuilders[status];
    if (builder) {
      builder();
    }

    keyboard.row().text(ctx.t('orders.back_to_orders'), 'orders:list');

    return keyboard;
  }

  // ===== Additional Methods (extracted from callback-router) =====

  async handleDeletedOrders(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.deleted_list'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
    });
  }

  async handleOrderConfig(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.select_to_configure'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const [orderId] = params;
    const order = await this.em.findOne(
      TrafficOrderEntity,
      { orderId, creator: ctx.user.id },
      { populate: ['orderTargets', 'orderTargets.trafficTarget'] },
    );

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Get target info
    const orderTargets = order.orderTargets?.getItems() ?? [];
    const primaryTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
    const target = primaryTarget?.trafficTarget?.getEntity();
    const targetName = target?.name ?? target?.username ?? orderId;

    const priceDisplay = toDisplayString(order.pricePerAction, 4);
    const budgetDisplay = toDisplayString(order.totalBudget, 2);

    // Get audience targeting info
    const requirements = order.requirements ?? {};
    const genderKey = requirements.gender ?? 'any';
    const genderLabel = ctx.t(`orders.gender.${genderKey}`);
    const hasAgeRestriction = requirements.minAge !== undefined || requirements.maxAge !== undefined;
    const ageLabel = hasAgeRestriction
      ? `${requirements.minAge ?? 0}-${requirements.maxAge ?? 100}`
      : ctx.t('orders.age.any');

    const configText =
      `⚙️ <b>${ctx.t('orders.edit_prompt')}</b>\n\n` +
      `<b>${ctx.t('orders.order_id')}:</b> <code>${orderId}</code>\n` +
      `<b>${ctx.t('orders.target_label')}:</b> ${targetName}\n\n` +
      `<b>${ctx.t('orders.target')}:</b> ${order.targetCount.toLocaleString()} ${ctx.t('orders.users')}\n` +
      `<b>${ctx.t('orders.price_per_action')}:</b> ${this.currencySymbol}${priceDisplay}\n` +
      `<b>${ctx.t('orders.budget')}:</b> ${this.currencySymbol}${budgetDisplay}\n\n` +
      `<b>${ctx.t('orders.audience.btn_gender')}:</b> ${genderLabel}\n` +
      `<b>${ctx.t('orders.audience.btn_age')}:</b> ${ageLabel}\n`;

    const keyboard = this.createTrafficOrderConfigKeyboard(ctx, orderId, order.status);

    await this.messageService.sendOrEditMessage(ctx, {
      text: configText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    await this.messageService.safeAnswerCallbackQuery(ctx);
  }

  /**
   * Create config keyboard for TrafficOrder
   */
  private createTrafficOrderConfigKeyboard(
    ctx: AuthenticatedBotContext,
    orderId: string,
    status: TrafficOrderStatus,
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Allow editing for non-terminal orders
    const terminalStatuses = [TrafficOrderStatus.Cancelled, TrafficOrderStatus.Completed, TrafficOrderStatus.Failed];
    const isTerminal = terminalStatuses.includes(status);

    if (!isTerminal) {
      keyboard
        .text(ctx.t('orders.config.btn_total_users'), `order:edit:amount:${orderId}`)
        .row()
        .text(ctx.t('orders.config.btn_price_per_sub'), `order:edit:price:${orderId}`)
        .row()
        .text(ctx.t('orders.audience.btn_gender'), `order:edit:gender:${orderId}`)
        .text(ctx.t('orders.audience.btn_age'), `order:edit:age:${orderId}`)
        .row();
    }

    keyboard.text(ctx.t('common.back'), `order:details:${orderId}`);

    return keyboard;
  }

  async handleOrderEdit(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length < 2) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit_prompt'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const [editType, ...rest] = params;

    // Handle nested routing for gender:set and age:set/clear
    if (editType === 'gender' && rest[0] === 'set') {
      // Format: gender:set:{value}:{orderId}
      await this.handleGenderSave(ctx, rest.slice(1));

      return;
    }

    if (editType === 'age' && (rest[0] === 'set' || rest[0] === 'clear')) {
      // Format: age:set:{min}:{max}:{orderId} or age:clear:{orderId}
      await this.handleAgeSave(ctx, rest);

      return;
    }

    const [orderId] = rest;

    const editTypeHandlers: Record<string, () => Promise<void>> = {
      amount: () => this.showEditAmountPrompt(ctx, orderId),
      price: () => this.showEditPricePrompt(ctx, orderId),
      gender: () => this.showGenderSelection(ctx, orderId),
      age: () => this.showAgeSelection(ctx, orderId),
    };

    const handler = editTypeHandlers[editType];
    if (handler) {
      await handler();
    } else {
      await this.handleOrderConfig(ctx, [orderId]);
    }
  }

  /**
   * Show prompt for editing target amount
   */
  private async showEditAmountPrompt(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Store editing state in session
    if (ctx.session) {
      ctx.session.conversationState = 'orderEdit';
      ctx.session.formData = { step: 'editAmount', orderId };
    }

    const message =
      `📈 <b>${ctx.t('orders.edit.total_title')}</b>\n\n` +
      `${ctx.t('orders.edit.current_value')}: <b>${order.targetCount.toLocaleString()}</b>\n\n` +
      `${ctx.t('orders.edit.total_prompt')}\n` +
      `<i>${ctx.t('orders.edit.numeric_hint')}</i>`;

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
    });

    await ctx.answerCallbackQuery();
  }

  /**
   * Show prompt for editing price per action
   */
  private async showEditPricePrompt(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Store editing state in session
    if (ctx.session) {
      ctx.session.conversationState = 'orderEdit';
      ctx.session.formData = { step: 'editPrice', orderId };
    }

    const currentPrice = toDisplayString(order.pricePerAction, 4);
    const message =
      `💰 <b>${ctx.t('orders.edit.price_title')}</b>\n\n` +
      `${ctx.t('orders.edit.current_value')}: <b>${this.currencySymbol}${currentPrice}</b>\n\n` +
      `${ctx.t('orders.edit.price_prompt')}\n` +
      `<i>${ctx.t('orders.edit.price_hint')}</i>`;

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
    });

    await ctx.answerCallbackQuery();
  }

  /**
   * Handle text input for order editing
   */
  async handleOrderEditInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';
    const orderId = 'orderId' in formData ? String(formData.orderId) : '';

    if (!orderId) {
      return;
    }

    const stepHandlers: Record<string, () => Promise<void>> = {
      editAmount: () => this.processAmountEdit(ctx, orderId, input),
      editPrice: () => this.processPriceEdit(ctx, orderId, input),
    };

    const handler = stepHandlers[step];
    if (handler) {
      await handler();
    }
  }

  /**
   * Process amount edit input
   */
  private async processAmountEdit(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const amount = parseInt(input.trim(), 10);

    if (isNaN(amount) || amount < 1) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit.invalid_number'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
      });

      return;
    }

    if (amount > 1000000) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit.number_too_large'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
      });

      return;
    }

    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Update amount and recalculate budget
    order.targetCount = amount;
    order.totalBudget = toDbString(multiply(order.pricePerAction, amount.toString()), 4);
    await em.flush();

    // Clear session state
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    this.logger.log('Order amount updated', { orderId, newAmount: amount, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.edit.total_updated', { value: amount.toLocaleString() }),
    });

    // Return to config screen
    await this.handleOrderConfig(ctx, [orderId]);
  }

  /**
   * Process price edit input
   */
  private async processPriceEdit(ctx: AuthenticatedBotContext, orderId: string, input: string): Promise<void> {
    const priceValue = decimal(input.trim());

    if (priceValue.isNaN() || priceValue.lessThanOrEqualTo(0)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit.invalid_price'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
      });

      return;
    }

    if (priceValue.greaterThan(1000)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.edit.price_too_high'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `order:config:${orderId}`),
      });

      return;
    }

    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Update price and recalculate budget
    const newPrice = toDbString(priceValue, 4);
    order.pricePerAction = newPrice;
    order.totalBudget = toDbString(multiply(newPrice, order.targetCount.toString()), 4);
    await em.flush();

    // Clear session state
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    const priceDisplay = toDisplayString(newPrice, 4);
    this.logger.log('Order price updated', { orderId, newPrice, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.edit.price_updated', { price: priceDisplay }),
    });

    // Return to config screen
    await this.handleOrderConfig(ctx, [orderId]);
  }

  /**
   * Show gender selection keyboard
   */
  private async showGenderSelection(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const requirements = order.requirements ?? {};
    const currentGender = requirements.gender ?? 'any';
    const genderLabel = ctx.t(`orders.gender.${currentGender}`);

    const message =
      `👤 <b>${ctx.t('orders.gender.title')}</b>\n\n` +
      `${ctx.t('orders.gender.current', { gender: genderLabel })}\n\n` +
      `${ctx.t('orders.gender.prompt')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.gender.any'), `order:edit:gender:set:any:${orderId}`)
      .row()
      .text(ctx.t('orders.gender.male'), `order:edit:gender:set:male:${orderId}`)
      .text(ctx.t('orders.gender.female'), `order:edit:gender:set:female:${orderId}`)
      .row()
      .text(ctx.t('common.back'), `order:config:${orderId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    await ctx.answerCallbackQuery();
  }

  /**
   * Save gender selection
   */
  async handleGenderSave(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (params.length < 2) {
      await this.handleOrderConfig(ctx, []);

      return;
    }

    const [gender, orderId] = params;
    const validGenders = ['any', 'male', 'female'];

    if (!validGenders.includes(gender)) {
      await this.handleOrderConfig(ctx, [orderId]);

      return;
    }

    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Update requirements with new gender
    const requirements = order.requirements ?? {};
    requirements.gender = gender as 'any' | 'male' | 'female';
    order.requirements = requirements;
    await em.flush();

    const genderLabel = ctx.t(`orders.gender.${gender}`);
    this.logger.log('Order gender updated', { orderId, gender, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: `✅ ${ctx.t('orders.gender.updated', { gender: genderLabel })}`,
    });

    // Return to config screen
    await this.handleOrderConfig(ctx, [orderId]);
  }

  /**
   * Show age selection keyboard
   */
  private async showAgeSelection(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const requirements = order.requirements ?? {};
    const hasAgeRestriction = requirements.minAge !== undefined || requirements.maxAge !== undefined;
    const currentAgeDisplay = hasAgeRestriction
      ? ctx.t('orders.age.current', { min: requirements.minAge ?? 0, max: requirements.maxAge ?? 100 })
      : ctx.t('orders.age.any');

    const message =
      `🎂 <b>${ctx.t('orders.age.title')}</b>\n\n` + `${currentAgeDisplay}\n\n` + `${ctx.t('orders.age.prompt')}`;

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.age.btn_12_18'), `order:edit:age:set:12:18:${orderId}`)
      .text(ctx.t('orders.age.btn_18_25'), `order:edit:age:set:18:25:${orderId}`)
      .text(ctx.t('orders.age.btn_25_35'), `order:edit:age:set:25:35:${orderId}`)
      .row()
      .text(ctx.t('orders.age.btn_35_50'), `order:edit:age:set:35:50:${orderId}`)
      .text(ctx.t('orders.age.btn_50_plus'), `order:edit:age:set:50:100:${orderId}`)
      .row()
      .text(ctx.t('orders.age.btn_clear'), `order:edit:age:clear:${orderId}`)
      .row()
      .text(ctx.t('common.back'), `order:config:${orderId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: message,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    await ctx.answerCallbackQuery();
  }

  /**
   * Save age selection
   */
  async handleAgeSave(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (params.length < 1) {
      await this.handleOrderConfig(ctx, []);

      return;
    }

    // Check if it's a clear action: params = ['clear', orderId]
    if (params[0] === 'clear') {
      const clearOrderId = params[1] ?? '';
      await this.clearAgeRestriction(ctx, clearOrderId);

      return;
    }

    // Expect: params = ['set', min, max, orderId]
    if (params.length < 4) {
      await this.handleOrderConfig(ctx, []);

      return;
    }

    const [, minStr, maxStr, orderId] = params;
    const minAge = parseInt(minStr, 10);
    const maxAge = parseInt(maxStr, 10);

    if (isNaN(minAge) || isNaN(maxAge) || minAge < 0 || maxAge > 120 || minAge > maxAge) {
      await this.handleOrderConfig(ctx, [orderId]);

      return;
    }

    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Update requirements with new age range
    const requirements = order.requirements ?? {};
    requirements.minAge = minAge;
    requirements.maxAge = maxAge;
    order.requirements = requirements;
    await em.flush();

    this.logger.log('Order age updated', { orderId, minAge, maxAge, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: `✅ ${ctx.t('orders.age.updated', { min: minAge, max: maxAge })}`,
    });

    // Return to config screen
    await this.handleOrderConfig(ctx, [orderId]);
  }

  /**
   * Clear age restriction
   */
  private async clearAgeRestriction(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, { orderId, creator: ctx.user.id });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Remove age restrictions
    const requirements = order.requirements ?? {};
    delete requirements.minAge;
    delete requirements.maxAge;
    order.requirements = requirements;
    await em.flush();

    this.logger.log('Order age cleared', { orderId, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: `✅ ${ctx.t('orders.age.cleared')}`,
    });

    // Return to config screen
    await this.handleOrderConfig(ctx, [orderId]);
  }

  async handleOrderToggle(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Use a single forked EntityManager for the entire transaction
    const { em } = this;

    const [orderId] = params;
    const order = await em.findOne(
      TrafficOrderEntity,
      { orderId, creator: ctx.user.id },
      { populate: ['orderSources', 'orderTargets'] },
    );

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Toggle between Active and Paused/Cancelled
    const statusToggleMap: Record<TrafficOrderStatus, TrafficOrderStatus> = {
      [TrafficOrderStatus.Active]: TrafficOrderStatus.Paused,
      [TrafficOrderStatus.Paused]: TrafficOrderStatus.Active,
      [TrafficOrderStatus.Cancelled]: TrafficOrderStatus.Cancelled, // Can't toggle cancelled
      [TrafficOrderStatus.Pending]: TrafficOrderStatus.Pending, // Can't toggle pending
      [TrafficOrderStatus.Moderation]: TrafficOrderStatus.Moderation, // Can't toggle while in moderation
      [TrafficOrderStatus.Completed]: TrafficOrderStatus.Completed, // Can't toggle completed
      [TrafficOrderStatus.Failed]: TrafficOrderStatus.Active, // Restart failed
      [TrafficOrderStatus.Deleted]: TrafficOrderStatus.Deleted, // Can't toggle deleted
    };

    const newStatus = statusToggleMap[order.status];

    if (newStatus === order.status) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.toggle_not_allowed'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), `order:details:${orderId}`),
      });

      return;
    }

    order.status = newStatus;

    // Sync junction table statuses with the main order status
    // When pausing: set all active sources/targets to paused
    // When resuming: set all paused sources/targets back to active
    const sourceStatusMap: Record<TrafficOrderStatus, TrafficOrderSourceStatus> = {
      [TrafficOrderStatus.Active]: TrafficOrderSourceStatus.Active,
      [TrafficOrderStatus.Paused]: TrafficOrderSourceStatus.Paused,
      [TrafficOrderStatus.Pending]: TrafficOrderSourceStatus.Pending,
      [TrafficOrderStatus.Moderation]: TrafficOrderSourceStatus.Pending, // On moderation maps to pending
      [TrafficOrderStatus.Completed]: TrafficOrderSourceStatus.Completed,
      [TrafficOrderStatus.Cancelled]: TrafficOrderSourceStatus.Cancelled,
      [TrafficOrderStatus.Failed]: TrafficOrderSourceStatus.Failed,
      [TrafficOrderStatus.Deleted]: TrafficOrderSourceStatus.Cancelled, // Map deleted to cancelled for junction tables
    };

    const targetStatusMap: Record<TrafficOrderStatus, TrafficOrderTargetStatus> = {
      [TrafficOrderStatus.Active]: TrafficOrderTargetStatus.Active,
      [TrafficOrderStatus.Paused]: TrafficOrderTargetStatus.Paused,
      [TrafficOrderStatus.Pending]: TrafficOrderTargetStatus.Pending,
      [TrafficOrderStatus.Moderation]: TrafficOrderTargetStatus.Pending, // On moderation maps to pending
      [TrafficOrderStatus.Completed]: TrafficOrderTargetStatus.Completed,
      [TrafficOrderStatus.Cancelled]: TrafficOrderTargetStatus.Cancelled,
      [TrafficOrderStatus.Failed]: TrafficOrderTargetStatus.Failed,
      [TrafficOrderStatus.Deleted]: TrafficOrderTargetStatus.Cancelled, // Map deleted to cancelled for junction tables
    };

    // Update all order sources that are in a toggleable state
    const orderSources = order.orderSources?.getItems() ?? [];
    const toggleableSourceStatuses = [TrafficOrderSourceStatus.Active, TrafficOrderSourceStatus.Paused];

    for (const orderSource of orderSources) {
      if (toggleableSourceStatuses.includes(orderSource.status)) {
        orderSource.status = sourceStatusMap[newStatus];
      }
    }

    // Update all order targets that are in a toggleable state
    const orderTargets = order.orderTargets?.getItems() ?? [];
    const toggleableTargetStatuses = [TrafficOrderTargetStatus.Active, TrafficOrderTargetStatus.Paused];

    for (const orderTarget of orderTargets) {
      if (toggleableTargetStatuses.includes(orderTarget.status)) {
        orderTarget.status = targetStatusMap[newStatus];
      }
    }

    await em.flush();

    this.logger.log('Order status toggled with junction sync', {
      orderId,
      newStatus,
      sourcesUpdated: orderSources.length,
      targetsUpdated: orderTargets.length,
      userId: ctx.user.id,
    });

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.toggled'),
    });

    // Show updated order details
    await this.handleOrderDetails(ctx, orderId);
  }

  /**
   * Extract orderId from delete action params
   */
  private extractOrderIdFromParams(params: string[]): string {
    const idParam = params.find((p) => p.startsWith('id='));

    return idParam ? idParam.replace('id=', '') : '';
  }

  /**
   * Handle confirmed order deletion with refund
   */
  private async handleDeleteConfirm(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    if (!orderId) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const { em } = this;
    const order = await em.findOne(TrafficOrderEntity, {
      orderId,
      creator: ctx.user.id,
    });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Refund locked funds back to user
    const refundedAmount = await this.refundOrderFundsWithEm(em, order, ctx.user.id);

    order.status = TrafficOrderStatus.Cancelled;
    order.completedAt = new Date();
    await em.flush();

    this.logger.log('Order deleted', { orderId, userId: ctx.user.id, refundedAmount });

    // Show success message with refund info if applicable
    const hasRefund = decimal(refundedAmount).greaterThan('0');
    const refundInfo = hasRefund
      ? `\n${ctx.t('orders.funds_refunded', { amount: this.currencySymbol + toDisplayString(refundedAmount, 2) })}`
      : '';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.deleted_success') + refundInfo,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard().text(ctx.t('orders.btn_view_orders'), 'orders:list'),
    });
  }

  /**
   * Refund locked funds for an order back to user
   * @returns The refunded amount as string
   */
  private async refundOrderFundsWithEm(em: EntityManager, order: TrafficOrderEntity, userId: string): Promise<string> {
    // Refund remaining funds in TrafficOrderBalance and get the refunded amount
    const refundedAmount = await this.userBalanceService.refundOrderBalanceWithEm(em, order.id);

    if (!decimal(refundedAmount).greaterThan('0')) {
      return '0';
    }

    // Unlock funds back to user balance
    const baseCurrency = this.paymentConfigService.getBaseCurrency();
    await this.userBalanceService.unlockBalanceWithEm(em, userId, baseCurrency, refundedAmount);

    this.logger.log('Order funds refunded', {
      orderId: order.orderId,
      userId,
      refundedAmount,
    });

    return refundedAmount;
  }

  async handleOrderDelete(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.showOrderNotFound(ctx);

      return;
    }

    const actionHandlers: Record<string, () => Promise<void>> = {
      confirm: () => this.handleDeleteConfirm(ctx, this.extractOrderIdFromParams(params)),
      cancel: () => this.handleDeleteCancel(ctx, this.extractOrderIdFromParams(params)),
    };

    const handler = actionHandlers[params[0]];
    if (handler) {
      await handler();

      return;
    }

    // Show confirmation dialog
    await this.showDeleteConfirmation(ctx, params[0]);
  }

  /**
   * Show order not found message
   */
  private async showOrderNotFound(ctx: AuthenticatedBotContext): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.not_found'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
    });
  }

  /**
   * Handle delete cancel action
   */
  private async handleDeleteCancel(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    if (orderId) {
      await this.handleOrderDetails(ctx, orderId);
    } else {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('common.errors.operation_cancelled'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });
    }
  }

  /**
   * Show delete confirmation dialog
   */
  private async showDeleteConfirmation(ctx: AuthenticatedBotContext, orderId: string): Promise<void> {
    const order = await this.em.findOne(TrafficOrderEntity, {
      orderId,
      creator: ctx.user.id,
    });

    if (!order) {
      await this.showOrderNotFound(ctx);

      return;
    }

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.delete.btn_confirm'), `order:delete:confirm:id=${orderId}`)
      .text(ctx.t('orders.delete.btn_cancel'), `order:delete:cancel:id=${orderId}`);

    await this.messageService.sendOrEditMessage(ctx, {
      text: `${ctx.t('orders.delete_confirm')}\n\n<b>${ctx.t('orders.order_id')}:</b> <code>${orderId}</code>`,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  async handleOrderDownload(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.download_coming_soon'),
      replyMarkup: orderId
        ? new InlineKeyboard().text(ctx.t('common.back'), `order:details:${orderId}`)
        : new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
    });
  }

  async handleOrderBotManagement(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.bot_admin.btn_add_to_channel'), `order:bot:add:${orderId}`)
      .row()
      .text(ctx.t('orders.bot_admin.btn_added_confirm'), `order:bot:confirm:${orderId}`)
      .row()
      .text(ctx.t('common.back'), orderId ? `order:details:${orderId}` : 'orders:list');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.bot_management'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderAudienceTargeting(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.audience.btn_gender'), `order:gender:${orderId}`)
      .text(ctx.t('orders.audience.btn_region'), `order:location:${orderId}`)
      .row()
      .text(ctx.t('orders.audience.btn_age'), `order:audience:age:${orderId}`)
      .text(ctx.t('orders.audience.btn_activity'), `order:audience:activity:${orderId}`)
      .row()
      .text(ctx.t('common.back'), orderId ? `order:details:${orderId}` : 'orders:list');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.audience_targeting'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderGenderSelection(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.gender.any'), `order:gender:set:any:${orderId}`)
      .row()
      .text(ctx.t('orders.gender.male'), `order:gender:set:male:${orderId}`)
      .text(ctx.t('orders.gender.female'), `order:gender:set:female:${orderId}`)
      .row()
      .text(ctx.t('common.back'), orderId ? `order:audience:${orderId}` : 'orders:list');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.gender_selection'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderTopicSelection(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'orders:list';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.topic_selection'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), backCallback),
    });
  }

  async handleOrderLocationSelection(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.location.my_bots_only'), `order:location:set:my:${orderId}`)
      .row()
      .text(ctx.t('orders.location.other_bots_only'), `order:location:set:other:${orderId}`)
      .row()
      .text(ctx.t('orders.location.both'), `order:location:set:both:${orderId}`)
      .row()
      .text(ctx.t('common.back'), orderId ? `order:audience:${orderId}` : 'orders:list');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.location_selection'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderStats(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
      const totalOrders = orders.length;
      const activeOrders = orders.filter((o) => o.status === TrafficOrderStatus.Active).length;

      let text = ctx.t('orders.stats_title');
      text += `\n• ${ctx.t('orders.total')}: ${totalOrders}`;
      text += `\n• ${ctx.t('orders.active')}: ${activeOrders}`;

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });
    } else {
      const [orderId] = params;
      await this.handleOrderDetails(ctx, orderId);
    }
  }

  async handleOrderDuplicate(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Use a single forked EntityManager for the entire transaction
    const { em } = this;

    const [orderId] = params;
    const originalOrder = await em.findOne(
      TrafficOrderEntity,
      { orderId, creator: ctx.user.id },
      { populate: ['orderSources', 'orderTargets', 'orderSources.trafficSource', 'orderTargets.trafficTarget'] },
    );

    if (!originalOrder) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Get source and target from original order's junction tables
    const originalOrderSources = originalOrder.orderSources?.getItems() ?? [];
    const originalOrderTargets = originalOrder.orderTargets?.getItems() ?? [];
    const primaryOriginalSource = originalOrderSources.find((os) => os.isPrimary) ?? originalOrderSources[0];
    const primaryOriginalTarget = originalOrderTargets.find((ot) => ot.isPrimary) ?? originalOrderTargets[0];

    if (!primaryOriginalTarget) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.duplicate_error'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Create a duplicate order
    const newOrderId = `ORD-${uuidv7().slice(0, 8).toUpperCase()}`;
    const duplicateOrder = new TrafficOrderEntity({
      orderId: newOrderId,
      type: originalOrder.type,
      status: TrafficOrderStatus.Pending,
      targetCount: originalOrder.targetCount,
      pricePerAction: originalOrder.pricePerAction,
      totalBudget: originalOrder.totalBudget,
      description: originalOrder.description,
      creatorId: ctx.user.id,
    });

    em.persist(duplicateOrder);
    await em.flush();

    // Create junction table entries for the duplicate order
    const duplicateOrderTarget = new TrafficOrderTargetEntity({
      trafficOrderId: duplicateOrder.id,
      trafficTargetId: primaryOriginalTarget.trafficTarget?.id ?? '',
      allocatedCount: originalOrder.targetCount,
      allocatedBudget: originalOrder.totalBudget,
      pricePerAction: originalOrder.pricePerAction,
      isPrimary: true,
      status: TrafficOrderTargetStatus.Pending,
    });

    em.persist(duplicateOrderTarget);

    if (primaryOriginalSource) {
      const duplicateOrderSource = new TrafficOrderSourceEntity({
        trafficOrderId: duplicateOrder.id,
        trafficSourceId: primaryOriginalSource.trafficSource?.id ?? '',
        allocatedCount: originalOrder.targetCount,
        allocatedBudget: originalOrder.totalBudget,
        pricePerAction: originalOrder.pricePerAction,
        isPrimary: true,
        status: TrafficOrderSourceStatus.Pending,
      });

      em.persist(duplicateOrderSource);
    }

    await em.flush();

    this.logger.log('Order duplicated', {
      originalOrderId: orderId,
      newOrderId,
      userId: ctx.user.id,
    });

    const successText =
      `✅ <b>${ctx.t('orders.duplicated')}</b>\n\n` +
      `<b>${ctx.t('orders.duplicate_new_id')}:</b> <code>${newOrderId}</code>\n\n` +
      `<i>${ctx.t('orders.duplicate_hint')}</i>`;

    await this.messageService.sendOrEditMessage(ctx, {
      text: successText,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard()
        .text(ctx.t('orders.view.btn_settings'), `order:config:${newOrderId}`)
        .row()
        .text(ctx.t('orders.btn_view_orders'), 'orders:list'),
    });
  }

  async handleOrderIntegration(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'orders:list';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.integration_coming_soon'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), backCallback),
    });
  }

  async handleOrderTransfer(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'orders:list';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.transfer_coming_soon'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), backCallback),
    });
  }

  async handleOrderChannelView(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const [orderId] = params;
    const order = await this.em.findOne(
      TrafficOrderEntity,
      { orderId },
      { populate: ['orderTargets', 'orderTargets.trafficTarget'] },
    );

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Get primary target from junction table
    const orderTargets = order.orderTargets?.getItems() ?? [];
    const primaryOrderTarget = orderTargets.find((ot) => ot.isPrimary) ?? orderTargets[0];
    const target = primaryOrderTarget?.trafficTarget?.getEntity();

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.details_not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), `order:details:${orderId}`),
      });

      return;
    }

    const channelInfo =
      `📺 <b>${ctx.t('orders.channel_view')}</b>\n\n` +
      `<b>${ctx.t('orders.target_label')}:</b> ${target.name}\n` +
      (target.username ? `<b>Username:</b> @${target.username}\n` : '') +
      `<b>${ctx.t('orders.type')}:</b> ${target.type}\n` +
      `<b>Status:</b> ${target.status}`;

    await this.messageService.sendOrEditMessage(ctx, {
      text: channelInfo,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), `order:details:${orderId}`),
    });
  }

  /**
   * Handle order confirmation
   * params: [type, target, amount]
   *
   * This method:
   * 1. Validates order parameters
   * 2. Checks user has sufficient balance
   * 3. Locks funds in UserBalance
   * 4. Creates the order
   * 5. Creates TrafficOrderBalance to track locked funds
   */
  async handleOrderConfirm(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (params.length < 3) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_order_data', { default: '❌ Invalid order data. Please try again.' }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    const [orderTypeStr, targetUsername, amountStr] = params;
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount < 1) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_amount', { default: '❌ Invalid amount.' }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Map string to TrafficOrderType
    const orderTypeMap: Record<string, TrafficOrderType> = {
      join: TrafficOrderType.Join,
      leave: TrafficOrderType.Leave,
      view: TrafficOrderType.View,
      subscribe: TrafficOrderType.Subscribe,
      react: TrafficOrderType.React,
      comment: TrafficOrderType.Comment,
    };

    const orderType = orderTypeMap[orderTypeStr];
    if (!orderType) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_order_type', { default: '❌ Invalid order type.' }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Use a single forked EntityManager for the entire transaction
    const { em } = this;

    // Calculate the total budget
    const pricePerAction = '0.01'; // Default price, should be configurable
    const totalBudget = toDbString(multiply(pricePerAction, amount.toString()), 8);
    const baseCurrency = this.paymentConfigService.getBaseCurrency();

    // Check user balance using centralized getBalanceSummary (sums all currencies to USD)
    const balanceSummary = await this.userBalanceService.getBalanceSummaryWithEm(em, ctx.user.id, baseCurrency);
    const availableBalance = decimal(balanceSummary.available);
    const requiredAmount = decimal(totalBudget);

    if (lessThan(availableBalance, requiredAmount)) {
      const formattedAvailable = balanceSummary.available;
      const formattedRequired = toDisplayString(requiredAmount, 2);

      // Restore session state to allow user to enter a different amount
      if (ctx.session) {
        ctx.session.conversationState = 'orderCreate';
        ctx.session.formData = { step: 'enter_amount', type: orderTypeStr, target: targetUsername };
      }

      await this.messageService.sendOrEditMessage(ctx, {
        text:
          ctx.t('orders.insufficient_balance', {
            available: formattedAvailable,
            required: formattedRequired,
            currency: this.currencySymbol,
          }) +
          '\n\n' +
          ctx.t('orders.enter_amount_prompt'),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard()
          .text(ctx.t('orders.btn_topup_balance'), 'balance:deposit')
          .row()
          .text(ctx.t('common.back'), 'order:create:start'),
      });

      return;
    }

    // Lock funds in UserBalance (locks from any currency, converts USD amount)
    const lockResult = await this.userBalanceService.lockBalanceWithEm(em, ctx.user.id, baseCurrency, totalBudget);
    if (!lockResult.success) {
      this.logger.error('Failed to lock balance', { userId: ctx.user.id, amount: totalBudget });
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.balance_lock_failed'),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    try {
      // Find or create traffic target
      let trafficTarget = await em.findOne(TrafficTargetEntity, {
        username: targetUsername,
      });

      if (!trafficTarget) {
        trafficTarget = new TrafficTargetEntity({
          name: `@${targetUsername}`,
          type: TrafficTargetType.Channel,
          status: TrafficTargetStatus.PendingVerification,
          username: targetUsername,
          managedById: ctx.user.id,
        });

        // Generate UUIDv7 to match database defaultRaw: 'uuidv7()'
        trafficTarget.id = uuidv7();
        em.persist(trafficTarget);
      }

      // Create the order (status is Moderation since it goes to moderation review)
      const order = new TrafficOrderEntity({
        orderId: `ORD-${uuidv7().slice(0, 8).toUpperCase()}`,
        type: orderType,
        status: TrafficOrderStatus.Moderation,
        targetCount: amount,
        pricePerAction,
        totalBudget,
        creatorId: ctx.user.id,
      });

      em.persist(order);
      await em.flush();

      // Create TrafficOrderBalance to track locked funds
      await this.userBalanceService.createOrderBalanceWithEm(em, order.id, baseCurrency, totalBudget);

      // Create junction table entry for target
      const orderTarget = new TrafficOrderTargetEntity({
        trafficOrderId: order.id,
        trafficTargetId: trafficTarget.id,
        allocatedCount: amount,
        allocatedBudget: totalBudget,
        pricePerAction,
        isPrimary: true,
        status: TrafficOrderTargetStatus.Pending,
      });

      em.persist(orderTarget);
      await em.flush();

      // Create moderation request and send notification
      await this.createModerationNotification(order);

      // Get localized type name
      const typeKey = `orders.type_${orderTypeStr}`;
      const typeName = ctx.t(typeKey);

      // Clear session state
      if (ctx.session) {
        ctx.session.conversationState = undefined;
        ctx.session.formData = undefined;
      }

      const successText =
        `✅ <b>${ctx.t('orders.order_created')}</b>\n\n` +
        `<b>${ctx.t('orders.order_id')}:</b> <code>${order.orderId}</code>\n` +
        `<b>${ctx.t('orders.type')}:</b> ${typeName}\n` +
        `<b>${ctx.t('orders.target_label')}:</b> @${targetUsername}\n` +
        `<b>${ctx.t('orders.amount')}:</b> ${amount.toLocaleString()} ${ctx.t('orders.users')}\n` +
        `<b>${ctx.t('orders.budget')}:</b> ${this.currencySymbol}${toDisplayString(totalBudget, 2)}\n\n` +
        ctx.t('orders.order_pending') +
        '\n' +
        ctx.t('orders.funds_locked');

      await this.messageService.sendOrEditMessage(ctx, {
        text: successText,
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard()
          .text(ctx.t('orders.btn_view_orders'), 'orders:list')
          .row()
          .text(ctx.t('orders.btn_create_another'), 'order:create:start')
          .row()
          .text(ctx.t('common.back'), 'menu:main'),
      });

      this.logger.log('Order created with locked funds', {
        userId: ctx.user.id,
        orderId: order.orderId,
        orderType,
        target: targetUsername,
        amount,
        budget: totalBudget,
      });
    } catch (error) {
      // If order creation fails, unlock the funds
      this.logger.error('Order creation failed, unlocking funds', { error, userId: ctx.user.id });
      await this.userBalanceService.unlockBalanceWithEm(em, ctx.user.id, baseCurrency, totalBudget);

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.create_failed'),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });
    }
  }

  /**
   * Handle order creation text input
   */
  async handleOrderCreateInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    const formData = ctx.session?.formData;
    if (!formData || typeof formData !== 'object') {
      return;
    }

    const step = 'step' in formData ? String(formData.step) : '';
    const orderType = 'type' in formData ? String(formData.type) : '';
    const target = 'target' in formData ? String(formData.target) : '';

    // Map step names to handler functions (using snake_case from session state)
    const stepMap: Record<string, string> = {
      enter_target: 'enterTarget',
      enter_amount: 'enterAmount',
    };

    const mappedStep = stepMap[step];
    if (mappedStep === 'enterTarget') {
      await this.handleTargetInput(ctx, input);
    } else if (mappedStep === 'enterAmount') {
      await this.handleAmountInput(ctx, input, orderType, target);
    }
  }

  /**
   * Handle target channel/group input
   */
  private async handleTargetInput(ctx: AuthenticatedBotContext, input: string): Promise<void> {
    // Validate input - should be a username or link
    const trimmedInput = input.trim();

    // Basic validation for Telegram username or link
    const isValidUsername = /^@?[a-zA-Z]\w{4,31}$/.test(trimmedInput);
    const isValidLink = /^https?:\/\/(t\.me|telegram\.me)\/[a-zA-Z]\w{4,31}$/.test(trimmedInput);

    if (!isValidUsername && !isValidLink) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_target', {
          default:
            '❌ Invalid target. Please enter a valid channel/group username (e.g., @channelname) or Telegram link (e.g., https://t.me/channelname)',
        }),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'order:create:start'),
      });

      return;
    }

    // Extract username from link if needed
    const username = isValidLink ? trimmedInput.split('/').pop() || trimmedInput : trimmedInput.replace('@', '');

    // Store target and move to next step
    if (ctx.session) {
      ctx.session.formData = {
        ...ctx.session.formData,
        step: 'enter_amount',
        target: username,
      };
    }

    const targetText = ctx.t('orders.target_set', { target: username });
    const enterAmountPrompt = ctx.t('orders.enter_amount_prompt');

    await this.messageService.sendOrEditMessage(ctx, {
      text: `✅ ${targetText}\n\n${enterAmountPrompt}`,
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'order:type'),
    });
  }

  /**
   * Handle amount input
   */
  private async handleAmountInput(
    ctx: AuthenticatedBotContext,
    input: string,
    orderType: string,
    target: string,
  ): Promise<void> {
    const trimmedInput = input.trim();
    const amount = parseInt(trimmedInput, 10);

    // Validate amount
    if (isNaN(amount) || amount < 1) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_amount', { default: '❌ Invalid amount. Please enter a positive number.' }),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'order:type'),
      });

      return;
    }

    if (amount > 1000000) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.amount_too_large', { default: '❌ Amount too large. Maximum is 1,000,000 users.' }),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'order:type'),
      });

      return;
    }

    // Get localized type name
    const typeKey = `orders.type_${orderType}`;
    const typeName = ctx.t(typeKey);

    // Store amount and show confirmation
    if (ctx.session) {
      ctx.session.formData = {
        ...ctx.session.formData,
        step: 'confirm',
        amount,
      };
    }

    const confirmText =
      `📋 <b>${ctx.t('orders.confirm_title', { default: 'Order Summary' })}</b>\n\n` +
      `<b>${ctx.t('orders.type', { default: 'Type' })}:</b> ${typeName}\n` +
      `<b>${ctx.t('orders.target_label', { default: 'Target' })}:</b> @${target}\n` +
      `<b>${ctx.t('orders.amount', { default: 'Amount' })}:</b> ${amount.toLocaleString()} ${ctx.t('orders.users', { default: 'users' })}\n\n` +
      ctx.t('orders.confirm_prompt', { default: 'Confirm to create the order?' });

    await this.messageService.sendOrEditMessage(ctx, {
      text: confirmText,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard()
        .text(ctx.t('orders.btn_confirm', { default: '✅ Confirm' }), `order:confirm:${orderType}:${target}:${amount}`)
        .row()
        .text(ctx.t('common.cancel'), 'orders:list'),
    });
  }

  async handleOrderTypeSelection(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    // If no type selected yet, show the type selection keyboard
    if (params.length === 0) {
      const typeKeyboard = this.createOrderTypeKeyboard(ctx);

      await this.messageService.sendOrEditMessage(ctx, {
        text: `➕ <b>${ctx.t('orders.create_title')}</b>\n\n${ctx.t('orders.select_type')}`,
        replyMarkup: typeKeyboard,
      });

      return;
    }

    // Handle selected type
    const [selectedType] = params;
    const validTypes = ['join', 'subscribe'];

    if (!validTypes.includes(selectedType)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.type_selection'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'orders:list'),
      });

      return;
    }

    // Store selected type in session and proceed to next step
    if (ctx.session) {
      ctx.session.conversationState = 'orderCreate';
      ctx.session.formData = { step: 'enter_target', type: selectedType };
    }

    // Get localized type name
    const typeKey = `orders.type_${selectedType}`;
    const typeName = ctx.t(typeKey);
    const defaultMsg = 'Order type selected: ' + typeName;
    const typeSelectedMsg = ctx.t('orders.type_selected', { default: defaultMsg, type: typeName });
    const enterTargetMsg = ctx.t('orders.enter_target');
    const fullMessage = `✅ ${typeSelectedMsg}\n\n${enterTargetMsg}`;

    // Show the next step (target selection/input)
    await this.messageService.sendOrEditMessage(ctx, {
      text: fullMessage,
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'order:create:start'),
    });
  }

  /**
   * Create moderation request and send notification to moderation channel
   */
  private async createModerationNotification(order: TrafficOrderEntity): Promise<void> {
    // Use forked EM for request-scoped operations
    const { em } = this;

    try {
      // Create moderation request directly with forked EM
      const moderationRequest = new ModerationRequestEntity({
        entityType: ModerationEntityType.TrafficOrder,
        entityId: order.id,
        status: ModerationStatus.Pending,
      });

      em.persist(moderationRequest);
      await em.flush();

      this.logger.log('Moderation request created', {
        orderId: order.orderId,
        moderationRequestId: moderationRequest.id,
      });

      // Reload order with relations for the notification message
      const orderWithRelations = await em.findOne(
        TrafficOrderEntity,
        { id: order.id },
        {
          populate: [
            'creator',
            'orderTargets',
            'orderTargets.trafficTarget',
            'orderSources',
            'orderSources.trafficSource',
          ],
        },
      );

      if (!orderWithRelations) {
        this.logger.warn('Order not found for moderation notification', { orderId: order.orderId });

        return;
      }

      // Send notification to Telegram moderation channel
      const notification = await this.moderationNotifier.notifyOrderCreated(orderWithRelations, moderationRequest);

      // Update moderation request with Telegram message info
      if (notification) {
        moderationRequest.telegramChatId = notification.chatId;
        moderationRequest.telegramMessageId = notification.messageId.toString();
        await em.flush();

        this.logger.log('Moderation notification sent', {
          orderId: order.orderId,
          chatId: notification.chatId,
          messageId: notification.messageId,
        });
      }
    } catch (error) {
      // Log error but don't fail the order creation
      this.logger.error('Failed to create moderation notification', {
        orderId: order.orderId,
        error,
      });
    }
  }

  /**
   * Handle order creation for an existing target (skips type selection)
   * Order type is automatically determined from target type:
   * - Channel → subscribe
   * - Group → join
   * - Bot → start
   */
  async handleCreateOrderForTarget(ctx: AuthenticatedBotContext, targetId: string): Promise<void> {
    const { em } = this;

    // Find the target (query by user ID for the managedBy relation)
    const target = await em.findOne(TrafficTargetEntity, { id: targetId, managedBy: { id: ctx.user.id } });

    if (!target) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('traffic.target_not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'buy:target:list'),
      });

      return;
    }

    // Determine order type from target type
    const orderTypeMap: Record<TrafficTargetType, string> = {
      [TrafficTargetType.Channel]: 'subscribe',
      [TrafficTargetType.Group]: 'join',
      [TrafficTargetType.Bot]: 'start',
      [TrafficTargetType.WithChecking]: 'subscribe',
    };

    const orderType = orderTypeMap[target.type];

    // Store in session and proceed to amount entry
    if (ctx.session) {
      ctx.session.conversationState = 'orderCreate';
      ctx.session.formData = {
        step: 'enter_amount',
        type: orderType,
        targetId: target.id,
        target: target.username || target.name,
      };
    }

    // Get localized type name
    const typeKey = `orders.type_${orderType}`;
    const typeName = ctx.t(typeKey);
    const targetName = target.name || target.username || target.id;

    // Show amount entry prompt
    await this.messageService.sendOrEditMessage(ctx, {
      text:
        `➕ <b>${ctx.t('orders.create_title')}</b>\n\n` +
        `<b>${ctx.t('orders.target')}:</b> ${targetName}\n` +
        `<b>${ctx.t('orders.type')}:</b> ${typeName}\n\n` +
        ctx.t('orders.enter_amount_prompt'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.cancel'), `buy:target:view:${targetId}`),
    });
  }
}
