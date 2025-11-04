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
  createDeleteConfirmKeyboard,
  createOrderListKeyboard,
  createStatsKeyboard,
  createViewOrderKeyboard,
} from '../order.keyboards';
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
    this.composer.callbackQuery('order:list', (ctx) => this.handleOrderList(ctx));
    this.composer.callbackQuery('order:deleted', (ctx) => this.handleDeletedOrders(ctx));
    this.composer.callbackQuery(/^order:list:page:(\d+)$/, (ctx) => this.handleOrderListPagination(ctx));

    // View order
    this.composer.callbackQuery(/^order:view:(.+)$/, (ctx) => this.handleViewOrder(ctx));
    this.composer.callbackQuery(/^order:refresh:(.+)$/, (ctx) => this.handleRefreshStats(ctx));
    this.composer.callbackQuery(/^order:stats:(.+)$/, (ctx) => this.handleOrderStats(ctx));

    // Order actions
    this.composer.callbackQuery(/^order:toggle:(.+)$/, (ctx) => this.handleToggleOrder(ctx));
    this.composer.callbackQuery(/^order:delete:(.+)$/, (ctx) => this.handleDeleteOrder(ctx));
    this.composer.callbackQuery(/^order:delete:confirm:(.+)$/, (ctx) => this.handleDeleteConfirm(ctx));
    this.composer.callbackQuery(/^order:duplicate:(.+)$/, (ctx) => this.handleDuplicateOrder(ctx));
  }

  /**
   * Handle order list
   */
  private async handleOrderList(ctx: BotContext, page = 1): Promise<void> {
    try {
      const userId = ctx.from?.id.toString();
      if (!userId) {
        await ctx.answerCallbackQuery(ctx.t('auth.authentication_required'));

        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const activeOrders = orders.filter((o) => o.status !== OrderStatus.Deleted);

      const message = `<b>${ctx.t('bot.order.list_title')}</b>\n\n${ctx.t('bot.order.total_count', { count: activeOrders.length })}`;
      const keyboard = createOrderListKeyboard(activeOrders, false, page);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling order list', error);
      await ctx.answerCallbackQuery(ctx.t('common.errors.load_failed'));
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
        await ctx.answerCallbackQuery(ctx.t('auth.authentication_required'));

        return;
      }

      const orders = await this.orderService.getUserOrders(userId);
      const deletedOrders = orders.filter((o) => o.status === OrderStatus.Deleted);

      const message = `<b>${ctx.t('bot.buttons.show_deleted')}</b>\n\n${ctx.t('bot.order.total_count', { count: deletedOrders.length })}`;
      const keyboard = createOrderListKeyboard(deletedOrders, true);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling deleted orders', error);
      await ctx.answerCallbackQuery(ctx.t('common.errors.delete_failed'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.not_found'));

        return;
      }

      if (order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const message = getViewOrderMessage(order);
      const keyboard = createViewOrderKeyboard(orderId);

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error handling view order', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle order stats
   */
  private async handleOrderStats(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:stats:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

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
      this.logger.error('Error handling order stats', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle refresh stats
   */
  private async handleRefreshStats(ctx: BotContext): Promise<void> {
    try {
      await this.handleOrderStats(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.updated'));
    } catch (error) {
      this.logger.error('Error refreshing stats', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle toggle order
   */
  private async handleToggleOrder(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:toggle:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Toggle order status
      const newStatus = order.status === OrderStatus.Active ? OrderStatus.Paused : OrderStatus.Active;
      await this.orderService.updateOrderStatus(orderId, newStatus);

      await this.handleViewOrder(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.updated'));
    } catch (error) {
      this.logger.error('Error toggling order', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      const keyboard = createDeleteConfirmKeyboard(orderId);
      const message = `<b>${ctx.t('common.buttons.delete_order')}</b>\n\n${ctx.t('common.confirm')}?`;

      await ctx.editMessageText(message, {
        reply_markup: keyboard,
        parse_mode: 'HTML',
      });

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error deleting order', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }

  /**
   * Handle delete confirm
   */
  private async handleDeleteConfirm(ctx: BotContext): Promise<void> {
    try {
      const match = ctx.callbackQuery?.data?.match(/^order:delete:confirm:(.+)$/);
      const orderId = match?.[1];

      if (!orderId) {
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Delete order
      await this.orderService.deleteOrder(orderId);

      await this.handleOrderList(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.deleted'));
    } catch (error) {
      this.logger.error('Error confirming delete', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
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
        await ctx.answerCallbackQuery(ctx.t('common.error'));

        return;
      }

      // Authorization check
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId !== ctx.from?.id.toString()) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.access_denied'));

        return;
      }

      // Create duplicate
      const duplicated = await this.orderService.duplicateOrder(orderId);

      await this.handleOrderList(ctx);
      await ctx.answerCallbackQuery(ctx.t('common.success.created'));
    } catch (error) {
      this.logger.error('Error duplicating order', error);
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }
}
