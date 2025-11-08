/* eslint-disable @nx/enforce-module-boundaries */
/**
 * Order Action Handler
 *
 * Handles traffic order-related actions including viewing,
 * creating, and managing orders.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { TrafficOrderEntity, TrafficOrderStatus, UserEntity } from '@app/database';
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
  async handleActiveOrders(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const limit = 5;
      const offset = (page - 1) * limit;

      const [orders, total] = await this.em.findAndCount(
        TrafficOrderEntity,
        {
          creator: user.id,
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
        await ctx.reply(ctx.t('bot.order.no_active_orders'));

        return;
      }

      const totalPages = Math.ceil(total / limit);
      const ordersText = this.formatOrdersList(orders, 'Active Orders', page, totalPages);

      let keyboard = this.menuHandler.createPaginationKeyboard(page, totalPages, 'orders:active');

      if (totalPages > 1) {
        keyboard = keyboard.row();
      }

      keyboard = keyboard.text('« Back', 'menu:orders');

      await this.messageService.sendOrEditMessage(ctx, {
        text: ordersText,
        parseMode: 'HTML',
        replyMarkup: keyboard,
      });

      this.logger.log('Active orders viewed', { userId: user.id, page });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle completed orders view
   */
  async handleCompletedOrders(ctx: BotContext, page = 1): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      const limit = 5;
      const offset = (page - 1) * limit;

      const [orders, total] = await this.em.findAndCount(
        TrafficOrderEntity,
        {
          creator: user.id,
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
        await ctx.reply('You have no completed orders yet.');

        return;
      }

      const totalPages = Math.ceil(total / limit);
      const ordersText = this.formatOrdersList(orders, 'Completed Orders', page, totalPages);

      let keyboard = this.menuHandler.createPaginationKeyboard(page, totalPages, 'orders:completed');

      if (totalPages > 1) {
        keyboard = keyboard.row();
      }

      keyboard = keyboard.text('« Back', 'menu:orders');

      await ctx.replyWithHTML(ordersText, { reply_markup: keyboard });

      this.logger.log('Completed orders viewed', { userId: user.id, page });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle order creation start
   */
  async handleCreateOrderStart(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply(ctx.t('common.errors.user_not_found'));

        return;
      }

      // Check if user is verified
      if (!user.isVerified) {
        await ctx.reply('❌ You must verify your account before creating orders. Use the Profile menu to verify.');

        return;
      }

      // Store order creation state in session
      if (ctx.session) {
        ctx.session.conversationState = 'order_create';
        ctx.session.formData = { step: 'select_type' };
      }

      const typeKeyboard = this.createOrderTypeKeyboard();

      await ctx.reply('➕ <b>Create New Order</b>\n\nPlease select the order type:', {
        parse_mode: 'HTML',
        reply_markup: typeKeyboard,
      });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle order details view
   */
  async handleOrderDetails(ctx: BotContext, orderId: string): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      const order = await this.em.findOne(
        TrafficOrderEntity,
        { orderId },
        {
          populate: ['trafficSource', 'trafficTarget', 'creator'],
        },
      );

      if (!order) {
        await ctx.reply('Order not found.');

        return;
      }

      const detailsText = await this.formatOrderDetails(order);
      const keyboard = this.createOrderDetailsKeyboard(orderId);

      await ctx.replyWithHTML(detailsText, { reply_markup: keyboard });

      this.logger.log('Order details viewed', { orderId });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle order search
   */
  async handleOrderSearch(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply(ctx.t('auth.authentication_required'));

        return;
      }

      // Store search state in session
      if (ctx.session) {
        ctx.session.conversationState = 'order_search';
        ctx.session.formData = { step: 'enter_query' };
      }

      await ctx.reply(
        '🔍 <b>Search Orders</b>\n\n' +
          'Please enter the order ID or keywords to search:\n\n' +
          '<i>Use /cancel to abort search.</i>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return await this.em.findOne(UserEntity, { telegramId });
  }

  /**
   * Format orders list
   */
  private formatOrdersList(orders: TrafficOrderEntity[], title: string, page: number, totalPages: number): string {
    let text = `<b>📦 ${title}</b> (Page ${page}/${totalPages})\n\n`;

    for (const order of orders) {
      const progress = decimal(order.currentCount).div(order.targetCount).mul(100);
      const progressDisplay = toDisplayString(progress, 1);
      const statusEmoji = this.getStatusEmoji(order.status);
      const budgetDisplay = toDisplayString(order.totalBudget, 2);

      text +=
        `${statusEmoji} <b>${order.type}</b> - <code>${order.orderId}</code>\n` +
        `Progress: ${order.currentCount}/${order.targetCount} (${progressDisplay}%)\n` +
        `Budget: $${budgetDisplay}\n` +
        `Status: ${order.status}\n\n`;
    }

    text += '<i>Tap on an order ID to view details.</i>';

    return text;
  }

  /**
   * Format order details
   */
  private async formatOrderDetails(order: TrafficOrderEntity): Promise<string> {
    const progress = decimal(order.currentCount).div(order.targetCount).mul(100);
    const progressDisplay = toDisplayString(progress, 1);
    const statusEmoji = this.getStatusEmoji(order.status);
    const source = await order.trafficSource.load();
    const target = await order.trafficTarget.load();

    if (!source || !target) {
      return 'Order details not found';
    }

    const totalBudgetDisplay = toDisplayString(order.totalBudget, 2);
    const spentAmountDisplay = toDisplayString(order.spentAmount, 2);
    const pricePerActionDisplay = toDisplayString(order.pricePerAction, 4);

    return (
      `${statusEmoji} <b>Order Details</b>\n\n` +
      `<b>Order ID:</b> <code>${order.orderId}</code>\n` +
      `<b>Type:</b> ${order.type}\n` +
      `<b>Status:</b> ${order.status}\n\n` +
      `<b>Progress:</b>\n` +
      `• Current: ${order.currentCount}\n` +
      `• Target: ${order.targetCount}\n` +
      `• Completion: ${progressDisplay}%\n\n` +
      `<b>Budget:</b>\n` +
      `• Total: $${totalBudgetDisplay}\n` +
      `• Spent: $${spentAmountDisplay}\n` +
      `• Price per Action: $${pricePerActionDisplay}\n\n` +
      `<b>Source:</b> ${source.name}\n` +
      `<b>Target:</b> ${target.name}\n\n` +
      // eslint-disable-next-line sonarjs/no-nested-template-literals
      `${order.description ? `<b>Description:</b>\n${order.description}\n\n` : ''}` +
      `<b>Created:</b> ${order.createdAt.toLocaleString()}\n` +
      `${order.completedAt ? `<b>Completed:</b> ${order.completedAt.toLocaleString()}` : ''}`
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

  private createOrderTypeKeyboard() {
    const { InlineKeyboard } = require('grammy');

    return new InlineKeyboard()
      .text('👥 Join', 'order:type:join')
      .text('👀 View', 'order:type:view')
      .row()
      .text('👍 Subscribe', 'order:type:subscribe')
      .text('❤️ React', 'order:type:react')
      .row()
      .text('💬 Comment', 'order:type:comment')
      .row()
      .text('« Cancel', 'menu:orders');
  }

  /**
   * Create order details keyboard
    // eslint-disable-next-line @typescript-eslint/no-require-imports
   */
  private createOrderDetailsKeyboard(orderId: string) {
    const { InlineKeyboard } = require('grammy');

    return new InlineKeyboard()
      .text('🔄 Refresh', `order:details:${orderId}`)
      .row()
      .text('« Back to Orders', 'menu:orders');
  }
}
