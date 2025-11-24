/**
 * Order Service
 *
 * Business logic for order creation and management.
 * This service handles pure business operations without bot-specific dependencies.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ChannelInfo,
  defaultOrderConfig,
  Order,
  OrderConfiguration,
  OrderStatistics,
  OrderStatus,
} from '@app/feature-order-shared';

/**
 * Channel Service Interface
 * Allows dependency injection of channel validation service
 */
export interface IChannelService {
  getChannelInfoFromLink(link: string): Promise<ChannelInfo | null>;
  checkBotIsAdmin(channelId: string): Promise<boolean>;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  // FUTURE: Replace with database persistence for finalized orders
  private orders: Map<string, Order> = new Map();

  constructor(private readonly channelService: IChannelService) {}

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    const userOrders = Array.from(this.orders.values())
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return userOrders;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  /**
   * Create new order
   */
  async createOrder(userId: string, config: Partial<OrderConfiguration>, channel: ChannelInfo): Promise<Order> {
    const orderId = this.generateOrderId();

    const fullConfig: OrderConfiguration = {
      ...defaultOrderConfig,
      ...config,
    } as OrderConfiguration;

    const order: Order = {
      id: orderId,
      userId,
      config: fullConfig,
      channel,
      status: OrderStatus.Moderation,
      stats: this.createEmptyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(orderId, order);
    this.logger.log(`Order created: ${orderId} for user ${userId}`);

    return order;
  }

  /**
   * Update order configuration
   */
  async updateOrderConfig(orderId: string, config: Partial<OrderConfiguration>): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    order.config = {
      ...order.config,
      ...config,
    };

    order.updatedAt = new Date();

    this.orders.set(orderId, order);
    this.logger.log(`Order updated: ${orderId}`);

    return order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    order.status = status;
    order.updatedAt = new Date();

    if (status === OrderStatus.Active && !order.startedAt) {
      order.startedAt = new Date();
    }

    if (status === OrderStatus.Completed) {
      order.completedAt = new Date();
    }

    this.orders.set(orderId, order);
    this.logger.log(`Order status updated: ${orderId} -> ${status}`);

    return order;
  }

  /**
   * Delete order (soft delete)
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    order.status = OrderStatus.Deleted;
    order.updatedAt = new Date();

    this.orders.set(orderId, order);
    this.logger.log(`Order deleted: ${orderId}`);

    return true;
  }

  /**
   * Duplicate order
   */
  async duplicateOrder(orderId: string, userId: string): Promise<Order | null> {
    const original = this.orders.get(orderId);
    if (!original || original.userId !== userId) {
      return null;
    }

    const newOrderId = this.generateOrderId();

    const duplicated: Order = {
      ...original,
      id: newOrderId,
      status: OrderStatus.Moderation,
      stats: this.createEmptyStats(),
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: undefined,
      completedAt: undefined,
      moderatedAt: undefined,
    };

    this.orders.set(newOrderId, duplicated);
    this.logger.log(`Order duplicated: ${orderId} -> ${newOrderId}`);

    return duplicated;
  }

  /**
   * Validate channel link
   */
  async validateChannelLink(link: string): Promise<{ valid: boolean; error?: string }> {
    // eslint-disable-next-line sonarjs/duplicates-in-character-class
    const telegramLinkRegex = /^https?:\/\/(t\.me|telegram\.me)\/([\w\d_]+|\+[\w\d_]+)$/i;

    if (!telegramLinkRegex.test(link)) {
      return {
        valid: false,
        error: 'Неверный формат ссылки',
      };
    }

    return { valid: true };
  }

  /**
   * Get channel info from link
   */
  async getChannelInfo(link: string): Promise<ChannelInfo | null> {
    const result = await this.channelService.getChannelInfoFromLink(link);

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      title: result.title,
      username: result.username,
      subscriberCount: result.subscriberCount,
      description: result.description,
      category: result.category,
      botIsAdmin: result.botIsAdmin,
    };
  }

  /**
   * Check if bot is admin in channel
   */
  async checkBotIsAdmin(channelId: string): Promise<boolean> {
    return this.channelService.checkBotIsAdmin(channelId);
  }

  /**
   * Update channel bot admin status
   */
  async updateChannelBotAdmin(channelId: string, isAdmin: boolean): Promise<void> {
    for (const order of Array.from(this.orders.values())) {
      if (order.channel.id === channelId) {
        order.channel.botIsAdmin = isAdmin;
        order.updatedAt = new Date();
        this.orders.set(order.id, order);
      }
    }

    this.logger.log(`Bot admin status updated for channel ${channelId}: ${isAdmin}`);
  }

  /**
   * Calculate estimated cost for order
   */
  calculateEstimatedCost(totalUsers: number, pricePerSubscriber: number): number {
    return totalUsers * pricePerSubscriber;
  }

  /**
   * Refresh order statistics
   */
  async refreshOrderStats(orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    // FUTURE: Implement real stats refresh from tracking system
    // eslint-disable-next-line sonarjs/pseudo-random
    order.stats.subscribersToday = Math.floor(Math.random() * 50);

    order.stats.totalSubscribers += order.stats.subscribersToday;
    // eslint-disable-next-line sonarjs/pseudo-random
    order.stats.conversionRate = 85 + Math.random() * 10;
    order.updatedAt = new Date();

    this.orders.set(orderId, order);
    this.logger.log(`Order stats refreshed: ${orderId}`);

    return order;
  }

  /**
   * Generate order report data
   */
  async generateOrderReport(orderId: string): Promise<string> {
    const order = this.orders.get(orderId);
    if (!order) {
      return '';
    }

    const report = `
Order Report #${orderId}
========================
Name: ${order.config.name}
Channel: ${order.channel.title}
Status: ${order.status}
Total Subscribers: ${order.stats.totalSubscribers}
Conversion Rate: ${order.stats.conversionRate.toFixed(2)}%
Total Spent: ${order.stats.totalSpent.toFixed(2)} RUB
Created: ${order.createdAt.toLocaleDateString()}
    `.trim();

    return report;
  }

  /**
   * Helper: Generate cryptographically secure unique order ID
   */
  private generateOrderId(): string {
    return `order_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Helper: Create empty statistics object
   */
  private createEmptyStats(): OrderStatistics {
    return {
      totalSubscribers: 0,
      subscribersToday: 0,
      conversionRate: 100,
      avgPrice: 0,
      totalSpent: 0,
      unsubscribes: 0,
      dailyStats: [],
    };
  }
}
