/**
 * Order Action Handler
 *
 * Handles traffic order-related actions including viewing,
 * creating, and managing orders.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { MikroORM } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import {
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficTargetType,
  TrafficTargetStatus,
} from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, toDisplayString } from '@app/common-shared';
import { MessageService } from '../service/message.service';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class OrderActionHandler {
  private readonly logger = new Logger(OrderActionHandler.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em() {
    return this.orm.em.fork();
  }

  /**
   * Handle active orders view
   */
  async handleActiveOrders(ctx: AuthenticatedBotContext, page = 1): Promise<void> {
    const limit = 5;
    const offset = (page - 1) * limit;

    const [orders, total] = await this.em.findAndCount(
      TrafficOrderEntity,
      {
        creator: ctx.user.id,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      },
      {
        orderBy: { createdAt: 'DESC' },
        limit,
        offset,
        populate: ['trafficSource', 'trafficTarget'],
      },
    );

    if (orders.length === 0) {
      const keyboard = new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders');
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('bot.order.no_active_orders'),
        replyMarkup: keyboard,
      });

      return;
    }

    const totalPages = Math.ceil(total / limit);
    const ordersText = this.formatOrdersList(ctx, orders, ctx.t('orders.active_title'), page, totalPages);

    let keyboard = this.menuHandler.createPaginationKeyboard(ctx, page, totalPages, 'orders:active');
    if (totalPages > 1) {
      keyboard = keyboard.row();
    }

    keyboard = keyboard.text(ctx.t('common.back'), 'menu:orders');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ordersText,

      replyMarkup: keyboard,
    });

    this.logger.log('Active orders viewed', { userId: ctx.user.id, page });
  }

  /**
   * Handle completed orders view
   */
  async handleCompletedOrders(ctx: AuthenticatedBotContext, page = 1): Promise<void> {
    const limit = 5;
    const offset = (page - 1) * limit;

    const [orders, total] = await this.em.findAndCount(
      TrafficOrderEntity,
      {
        creator: ctx.user.id,
        status: TrafficOrderStatus.Completed,
      },
      {
        orderBy: { completedAt: 'DESC' },
        limit,
        offset,
        populate: ['trafficSource', 'trafficTarget'],
      },
    );

    if (orders.length === 0) {
      const keyboard = new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders');
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.no_completed'),
        replyMarkup: keyboard,
      });

      return;
    }

    const totalPages = Math.ceil(total / limit);
    const ordersText = this.formatOrdersList(ctx, orders, ctx.t('orders.completed_title'), page, totalPages);

    let keyboard = this.menuHandler.createPaginationKeyboard(ctx, page, totalPages, 'orders:completed');
    if (totalPages > 1) {
      keyboard = keyboard.row();
    }

    keyboard = keyboard.text(ctx.t('common.back'), 'menu:orders');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ordersText,

      replyMarkup: keyboard,
    });

    this.logger.log('Completed orders viewed', { userId: ctx.user.id, page });
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
        populate: ['trafficSource', 'trafficTarget', 'creator'],
      },
    );

    if (!order) {
      const keyboard = new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders');
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: keyboard,
      });

      return;
    }

    const detailsText = await this.formatOrderDetails(order, ctx);
    const keyboard = this.createOrderDetailsKeyboard(orderId, ctx);

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
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
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
        `${ctx.t('orders.budget')}: $${budgetDisplay}\n` +
        `${ctx.t('orders.status.active')}: ${order.status}\n\n`;
    }

    text += `<i>${ctx.t('orders.view.btn_back_to_list')}</i>`;

    return text;
  }

  /**
   * Format order details
   */
  private async formatOrderDetails(order: TrafficOrderEntity, ctx: AuthenticatedBotContext): Promise<string> {
    const progress = decimal(order.currentCount).div(order.targetCount).mul(100);
    const progressDisplay = toDisplayString(progress, 1);
    const statusEmoji = this.getStatusEmoji(order.status);
    const source = await order.trafficSource.load();
    const target = await order.trafficTarget.load();

    if (!source || !target) {
      return ctx.t('orders.details_not_found');
    }

    const totalBudgetDisplay = toDisplayString(order.totalBudget, 2);
    const spentAmountDisplay = toDisplayString(order.spentAmount, 2);
    const pricePerActionDisplay = toDisplayString(order.pricePerAction, 4);

    return (
      `${statusEmoji} <b>${ctx.t('orders.details_title')}</b>\n\n` +
      `<b>${ctx.t('orders.order_id')}:</b> <code>${order.orderId}</code>\n` +
      `<b>${ctx.t('orders.type')}:</b> ${order.type}\n` +
      `<b>${ctx.t('orders.status')}:</b> ${order.status}\n\n` +
      `<b>${ctx.t('orders.progress')}:</b>\n` +
      `• ${ctx.t('orders.current')}: ${order.currentCount}\n` +
      `• ${ctx.t('orders.target')}: ${order.targetCount}\n` +
      `• ${ctx.t('orders.completion')}: ${progressDisplay}%\n\n` +
      `<b>${ctx.t('orders.budget')}:</b>\n` +
      `• ${ctx.t('orders.total')}: $${totalBudgetDisplay}\n` +
      `• ${ctx.t('orders.spent')}: $${spentAmountDisplay}\n` +
      `• ${ctx.t('orders.price_per_action')}: $${pricePerActionDisplay}\n\n` +
      `<b>${ctx.t('orders.source')}:</b> ${source.name}\n` +
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
      [TrafficOrderStatus.Active]: '✅',
      [TrafficOrderStatus.InProgress]: '🔄',
      [TrafficOrderStatus.Completed]: '✅',
      [TrafficOrderStatus.Cancelled]: '❌',
      [TrafficOrderStatus.Failed]: '⚠️',
    };

    return emojiMap[status] || '❓';
  }

  /**
   * Create order type keyboard
   */
  private createOrderTypeKeyboard(ctx: AuthenticatedBotContext) {
    return new InlineKeyboard()
      .text(ctx.t('orders.type_join'), 'order:type:join')
      .text(ctx.t('orders.type_view'), 'order:type:view')
      .row()
      .text(ctx.t('orders.type_subscribe'), 'order:type:subscribe')
      .text(ctx.t('orders.type_react'), 'order:type:react')
      .row()
      .text(ctx.t('orders.type_comment'), 'order:type:comment')
      .row()
      .text(ctx.t('common.cancel'), 'menu:orders');
  }

  /**
   * Create order details keyboard
   */
  private createOrderDetailsKeyboard(orderId: string, ctx: AuthenticatedBotContext) {
    return new InlineKeyboard()
      .text(ctx.t('common.refresh'), `order:details:${orderId}`)
      .row()
      .text(ctx.t('orders.back_to_orders'), 'menu:orders');
  }

  // ===== Additional Methods (extracted from callback-router) =====

  async handleDeletedOrders(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.deleted_list'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderConfig(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.select_to_configure'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const [orderId] = params;
    await this.handleOrderDetails(ctx, orderId);
  }

  async handleOrderEdit(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.edit_prompt'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderToggle(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const [orderId] = params;
    const order = await this.em.findOne(TrafficOrderEntity, {
      orderId,
      creator: ctx.user.id,
    });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    // Toggle between Active and Paused (InProgress stays as is)
    const statusToggleMap: Record<TrafficOrderStatus, TrafficOrderStatus> = {
      [TrafficOrderStatus.Active]: TrafficOrderStatus.Cancelled,
      [TrafficOrderStatus.InProgress]: TrafficOrderStatus.Cancelled,
      [TrafficOrderStatus.Cancelled]: TrafficOrderStatus.Active,
      [TrafficOrderStatus.Pending]: TrafficOrderStatus.Pending, // Can't toggle pending
      [TrafficOrderStatus.Completed]: TrafficOrderStatus.Completed, // Can't toggle completed
      [TrafficOrderStatus.Failed]: TrafficOrderStatus.Active, // Restart failed
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
    await this.em.flush();

    this.logger.log('Order status toggled', { orderId, newStatus, userId: ctx.user.id });

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.toggled'),
    });

    // Show updated order details
    await this.handleOrderDetails(ctx, orderId);
  }

  async handleOrderDelete(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    // Check if this is a confirmation action
    if (params[0] === 'confirm') {
      // Extract orderId from params (format: confirm:id=orderId)
      const idParam = params.find((p) => p.startsWith('id='));
      const orderId = idParam ? idParam.replace('id=', '') : '';

      if (!orderId) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('orders.not_found'),
          replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
        });

        return;
      }

      // Perform actual deletion (soft delete by setting status to Cancelled)
      const order = await this.em.findOne(TrafficOrderEntity, {
        orderId,
        creator: ctx.user.id,
      });

      if (!order) {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('orders.not_found'),
          replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
        });

        return;
      }

      order.status = TrafficOrderStatus.Cancelled;
      order.completedAt = new Date();
      await this.em.flush();

      this.logger.log('Order deleted', { orderId, userId: ctx.user.id });

      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.deleted_success'),
        replyMarkup: new InlineKeyboard().text(ctx.t('orders.btn_view_orders'), 'menu:orders'),
      });

      return;
    }

    // Check if this is a cancel action
    if (params[0] === 'cancel') {
      const idParam = params.find((p) => p.startsWith('id='));
      const orderId = idParam ? idParam.replace('id=', '') : '';

      if (orderId) {
        await this.handleOrderDetails(ctx, orderId);
      } else {
        await this.messageService.sendOrEditMessage(ctx, {
          text: ctx.t('common.errors.operation_cancelled'),
          replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
        });
      }

      return;
    }

    // Show confirmation dialog
    const [orderId] = params;
    const order = await this.em.findOne(TrafficOrderEntity, {
      orderId,
      creator: ctx.user.id,
    });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

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
        : new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderBotManagement(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';

    const keyboard = new InlineKeyboard()
      .text(ctx.t('orders.bot_admin.btn_add_to_channel'), `order:bot:add:${orderId}`)
      .row()
      .text(ctx.t('orders.bot_admin.btn_added_confirm'), `order:bot:confirm:${orderId}`)
      .row()
      .text(ctx.t('common.back'), orderId ? `order:details:${orderId}` : 'menu:orders');

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
      .text(ctx.t('common.back'), orderId ? `order:details:${orderId}` : 'menu:orders');

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
      .text(ctx.t('common.back'), orderId ? `order:audience:${orderId}` : 'menu:orders');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.gender_selection'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderTopicSelection(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'menu:orders';

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
      .text(ctx.t('common.back'), orderId ? `order:audience:${orderId}` : 'menu:orders');

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.location_selection'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderStats(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
      const totalOrders = orders.length;
      const activeOrders = orders.filter(
        (o) => o.status === TrafficOrderStatus.Active || o.status === TrafficOrderStatus.InProgress,
      ).length;

      let text = ctx.t('orders.stats_title');
      text += `\n• ${ctx.t('orders.total')}: ${totalOrders}`;
      text += `\n• ${ctx.t('orders.active')}: ${activeOrders}`;

      await this.messageService.sendOrEditMessage(ctx, {
        text,
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
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
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const [orderId] = params;
    const originalOrder = await this.em.findOne(
      TrafficOrderEntity,
      { orderId, creator: ctx.user.id },
      { populate: ['trafficSource', 'trafficTarget'] },
    );

    if (!originalOrder) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
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
      trafficSourceId: originalOrder.trafficSource.id,
      trafficTargetId: originalOrder.trafficTarget.id,
    });

    this.em.persist(duplicateOrder);
    await this.em.flush();

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
        .text(ctx.t('orders.btn_view_orders'), 'menu:orders'),
    });
  }

  async handleOrderIntegration(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'menu:orders';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.integration_coming_soon'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), backCallback),
    });
  }

  async handleOrderTransfer(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    const orderId = params.length > 0 ? params[0] : '';
    const backCallback = orderId ? `order:details:${orderId}` : 'menu:orders';

    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.transfer_coming_soon'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), backCallback),
    });
  }

  async handleOrderChannelView(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const [orderId] = params;
    const order = await this.em.findOne(TrafficOrderEntity, { orderId }, { populate: ['trafficTarget'] });

    if (!order) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.not_found'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const target = await order.trafficTarget.load();

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
   */
  async handleOrderConfirm(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (params.length < 3) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_order_data', { default: '❌ Invalid order data. Please try again.' }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    const [orderTypeStr, targetUsername, amountStr] = params;
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount < 1) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.invalid_amount', { default: '❌ Invalid amount.' }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
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
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    // Find user's traffic source
    const trafficSource = await this.em.findOne(TrafficSourceEntity, {
      managedBy: ctx.user.id,
    });

    if (!trafficSource) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.no_traffic_source', {
          default: '❌ You need to create a traffic source first.\n\nGo to Traffic → Sources to add one.',
        }),
        parseMode: 'HTML',
        replyMarkup: new InlineKeyboard()
          .text(ctx.t('traffic.sources', { default: '📊 Traffic Sources' }), 'traffic:sources')
          .row()
          .text(ctx.t('common.back'), 'menu:orders'),
      });

      return;
    }

    // Find or create traffic target
    let trafficTarget = await this.em.findOne(TrafficTargetEntity, {
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
      this.em.persist(trafficTarget);
      await this.em.flush();
    }

    // Create the order
    const pricePerAction = '0.01'; // Default price, should be configurable
    const totalBudget = decimal(pricePerAction).mul(amount).toString();

    const order = new TrafficOrderEntity({
      orderId: `ORD-${uuidv7().slice(0, 8).toUpperCase()}`,
      type: orderType,
      status: TrafficOrderStatus.Pending,
      targetCount: amount,
      pricePerAction,
      totalBudget,
      creatorId: ctx.user.id,
      trafficSourceId: trafficSource.id,
      trafficTargetId: trafficTarget.id,
    });

    this.em.persist(order);
    await this.em.flush();

    // Get localized type name
    const typeKey = `orders.type_${orderTypeStr}`;
    const typeName = ctx.t(typeKey);

    // Clear session state
    if (ctx.session) {
      ctx.session.conversationState = undefined;
      ctx.session.formData = undefined;
    }

    const successText =
      `✅ <b>${ctx.t('orders.order_created', { default: 'Order Created Successfully!' })}</b>\n\n` +
      `<b>${ctx.t('orders.order_id', { default: 'Order ID' })}:</b> <code>${order.orderId}</code>\n` +
      `<b>${ctx.t('orders.type', { default: 'Type' })}:</b> ${typeName}\n` +
      `<b>${ctx.t('orders.target_label', { default: 'Target' })}:</b> @${targetUsername}\n` +
      `<b>${ctx.t('orders.amount', { default: 'Amount' })}:</b> ${amount.toLocaleString()} ${ctx.t('orders.users', { default: 'users' })}\n\n` +
      ctx.t('orders.order_pending', { default: 'Your order is now pending moderation.' });

    await this.messageService.sendOrEditMessage(ctx, {
      text: successText,
      parseMode: 'HTML',
      replyMarkup: new InlineKeyboard()
        .text(ctx.t('orders.btn_view_orders', { default: '📋 View My Orders' }), 'menu:orders')
        .row()
        .text(ctx.t('orders.btn_create_another', { default: '➕ Create Another' }), 'order:create:start')
        .row()
        .text(ctx.t('common.back'), 'menu:main'),
    });

    this.logger.log('Order created', {
      userId: ctx.user.id,
      orderId: order.orderId,
      orderType,
      target: targetUsername,
      amount,
    });
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
        .text(ctx.t('common.cancel'), 'menu:orders'),
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
    const validTypes = ['join', 'view', 'subscribe', 'react', 'comment'];

    if (!validTypes.includes(selectedType)) {
      await this.messageService.sendOrEditMessage(ctx, {
        text: ctx.t('orders.type_selection'),
        replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
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
}
