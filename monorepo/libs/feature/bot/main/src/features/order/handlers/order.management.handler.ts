/**
 * Order Management Handler
 *
 * Handles order viewing, toggling, and deletion:
 * - View order list
 * - View single order
 * - Start/Stop orders
 * - Delete orders
 * - Refresh statistics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';
import { OrderService } from '../order.service';
import { OrderStatus } from '../order.types';
import {
  createOrderListKeyboard,
  createViewOrderKeyboard,
  createDeleteConfirmKeyboard,
  createStatsKeyboard,
} from '../order.keyboards';
import {
  getOrderListMessage,
  getViewOrderMessage,
  getOrderStatsMessage,
  SUCCESS_MESSAGES,
} from '../order.messages';
import { escapeHtml } from '../utils/html-escape.util';

@Injectable()
export class OrderManagementHandler {
  private readonly logger = new Logger(OrderManagementHandler.name);
  private composer: Composer<BotContext>;

  constructor(private readonly orderService: OrderService) {
    this.composer = new Composer<BotContext>();
    this.setupHandlers();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private setupHandlers(): void {
    // Order list
    this.composer.callbackQuery('order:list', ctx => this.handleOrderList(ctx));
    this.composer.callbackQuery('order:deleted', ctx => this.handleDeletedOrders(ctx));
    this.composer.callbackQuery(/^order:list:page:(\d+)$/, ctx => this.handleOrderListPagination(ctx));

    // View order
    this.composer.callbackQuery(/^order:view:(.+)$/, ctx => this.handleViewOrder(ctx));
    this.composer.callbackQuery(/^order:refresh:(.+)$/, ctx => this.handleRefreshStats(ctx));
    this.composer.callbackQuery(/^order:stats:(.+)$/, ctx => this.handleOrderStats(ctx));

    // Order actions
    this.composer.callbackQuery(/^order:toggle:(.+)$/, ctx => this.handleToggleOrder(ctx));
    this.composer.callbackQuery(/^order:delete:(.+)$/, ctx => this.handleDeleteOrder(ctx));
    this.composer.callbackQuery(/^order:delete:confirm:(.+)$/, ctx => this.handleDeleteConfirm(ctx));
    this.composer.callbackQuery(/^order:duplicate:(.+)$/, ctx => this.handleDuplicateOrder(ctx));
  }

  /**
   * Handle order list
   */
  private async handleOrderList(ctx: BotContext, page = 1): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const activeOrders = orders.filter(o => o.status !== OrderStatus.Deleted);

      const message = getOrderListMessage(activeOrders.length);
      const keyboard = createOrderListKeyboard(activeOrders, false, page);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling order list', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки заказов');
    }
  }

  /**
   * Handle order list pagination
   */
  private async handleOrderListPagination(ctx: BotContext): Promise<void> {
    const match = ctx.callbackQuery?.data?.match(/^order:list:page:(\d+)$/);
    const page = match ? parseInt(match[1], 10) : 1;
    await this.handleOrderList(ctx, page);
  }

  /**
   * Handle deleted orders
   */
  private async handleDeletedOrders(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const deletedOrders = orders.filter(o => o.status === OrderStatus.Deleted);

      const message = `<b>Удаленные заказы</b>\n\nВсего: ${deletedOrders.length}`;
      const keyboard = createOrderListKeyboard(deletedOrders, true);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling deleted orders', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки удаленных заказов');
    }
  }

  /**
   * Handle view order
   */
  private async handleViewOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:view:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      await this.showOrderView(ctx, orderId);
      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error viewing order', error);
      await ctx.answerCallbackQuery('❌ Ошибка просмотра заказа');
    }
  }

  /**
   * Show order view (A6)
   */
  private async showOrderView(ctx: BotContext, orderId: string): Promise<void> {
    const order = await this.orderService.getOrderById(orderId);
    if (!order) {
      await ctx.answerCallbackQuery('❌ Заказ не найден');
      return;
    }

    // TODO: Get real user balance
    const balance = 1234.50;

    const message = getViewOrderMessage(order, balance);
    const keyboard = createViewOrderKeyboard(order);

    await ctx.editMessageText(message, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  /**
   * Handle refresh statistics
   */
  private async handleRefreshStats(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:refresh:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      await this.orderService.refreshOrderStats(orderId);
      await this.showOrderView(ctx, orderId);
      await ctx.answerCallbackQuery('✅ Статистика обновлена');
    } catch (error) {
      this.logger.error('Error refreshing stats', error);
      await ctx.answerCallbackQuery('❌ Ошибка обновления статистики');
    }
  }

  /**
   * Handle order statistics view
   */
  private async handleOrderStats(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:stats:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      const message = getOrderStatsMessage(order);
      const keyboard = createStatsKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing stats', error);
      await ctx.answerCallbackQuery('❌ Ошибка загрузки статистики');
    }
  }

  /**
   * Handle toggle order (start/stop)
   */
  private async handleToggleOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:toggle:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      const newStatus = order.status === OrderStatus.Active ? OrderStatus.Paused : OrderStatus.Active;
      await this.orderService.updateOrderStatus(orderId, newStatus);

      await this.showOrderView(ctx, orderId);

      const message = newStatus === OrderStatus.Active ? SUCCESS_MESSAGES.orderStarted : SUCCESS_MESSAGES.orderStopped;
      await ctx.answerCallbackQuery(message);
    } catch (error) {
      this.logger.error('Error toggling order', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle delete order
   */
  private async handleDeleteOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:delete:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery('❌ Заказ не найден');
        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      const message = `⚠️ Удалить заказ?\n\nЗаказ: ${escapeHtml(order.config.name)}\nКанал: ${escapeHtml(order.channel.title)}\n\nЭто действие нельзя отменить.`;
      const keyboard = createDeleteConfirmKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error showing delete confirmation', error);
      await ctx.answerCallbackQuery('❌ Ошибка');
    }
  }

  /**
   * Handle delete confirmation
   */
  private async handleDeleteConfirm(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:delete:confirm:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      await this.orderService.deleteOrder(orderId);
      await this.handleOrderList(ctx);
      await ctx.answerCallbackQuery(SUCCESS_MESSAGES.orderDeleted);
    } catch (error) {
      this.logger.error('Error deleting order', error);
      await ctx.answerCallbackQuery('❌ Ошибка удаления заказа');
    }
  }

  /**
   * Handle duplicate order
   */
  private async handleDuplicateOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:duplicate:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery('❌ Ошибка');
        return;
      }

      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery('❌ Ошибка аутентификации');
        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== userId) {
        await ctx.answerCallbackQuery('❌ Доступ запрещен');
        return;
      }

      const duplicated = await this.orderService.duplicateOrder(orderId, userId);
      if (!duplicated) {
        await ctx.answerCallbackQuery('❌ Не удалось скопировать заказ');
        return;
      }

      await this.showOrderView(ctx, duplicated.id);
      await ctx.answerCallbackQuery('✅ Заказ скопирован');
    } catch (error) {
      this.logger.error('Error duplicating order', error);
      await ctx.answerCallbackQuery('❌ Ошибка копирования заказа');
    }
  }
}
