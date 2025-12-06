/**
 * Order Action Handler
 *
 * Handles traffic order-related actions including viewing,
 * creating, and managing orders.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { InlineKeyboard } from 'grammy';
import { TrafficOrderEntity, TrafficOrderStatus } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, toDisplayString } from '@app/common-shared';
import { MessageService } from '../service/message.service';

@Injectable()
export class OrderActionHandler {
  private readonly logger = new Logger(OrderActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

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
      ctx.session.conversationState = 'order_create';
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
      text:
        `🔍 <b>${ctx.t('orders.search_title')}</b>\n\n` +
        `${ctx.t('orders.search_prompt')}\n\n` +
        `<i>${ctx.t('common.cancel_hint')}</i>`,
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
      `<b>${ctx.t('orders.created')}:</b> ${order.createdAt.toLocaleString()}\n` +
      (order.completedAt ? `<b>${ctx.t('orders.completed')}:</b> ${order.completedAt.toLocaleString()}` : '')
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

  async handleOrderToggle(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.toggled'),
    });
  }

  async handleOrderDelete(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    const keyboard = this.menuHandler.createConfirmationKeyboard(ctx, 'order:delete', { id: _params[0] || '' });
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.delete_confirm'),
      replyMarkup: keyboard,
    });
  }

  async handleOrderDownload(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.download_preparing'),
    });
  }

  async handleOrderBotManagement(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.bot_management'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderAudienceTargeting(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.audience_targeting'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderGenderSelection(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.gender_selection'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderTopicSelection(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.topic_selection'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderLocationSelection(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.location_selection'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderStats(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      const orders = await this.em.find(TrafficOrderEntity, { creator: ctx.user.id });
      const totalOrders = orders.length;
      const activeOrders = orders.filter(
        (o) => o.status === TrafficOrderStatus.Active || o.status === TrafficOrderStatus.InProgress,
      ).length;

      let text = ctx.t('orders.statistics_title');
      text += `\n• ${ctx.t('orders.total_orders')}: ${totalOrders}`;
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

  async handleOrderDuplicate(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.duplicated'),
    });
  }

  async handleOrderIntegration(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.integration'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderTransfer(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.transfer'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderChannelView(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.channel_view'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }

  async handleOrderTypeSelection(ctx: AuthenticatedBotContext, _params: string[]): Promise<void> {
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('orders.type_selection'),
      replyMarkup: new InlineKeyboard().text(ctx.t('common.back'), 'menu:orders'),
    });
  }
}
