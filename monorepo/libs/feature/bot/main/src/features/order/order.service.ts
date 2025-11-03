/**
 * Order Service
 *
 * Business logic for order creation and management
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import {
  Order,
  OrderConfiguration,
  OrderFlowStep,
  OrderSessionState,
  OrderStatus,
  ChannelInfo,
  DEFAULT_ORDER_CONFIG,
  OrderStatistics,
  DailyStats,
} from './order.types';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  // Mock data storage (replace with real database in production)
  private orders: Map<string, Order> = new Map();

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string): Promise<Order[]> {
    const userOrders = Array.from(this.orders.values())
      .filter(order => order.userId === userId)
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
  async createOrder(
    userId: string,
    config: Partial<OrderConfiguration>,
    channel: ChannelInfo,
  ): Promise<Order> {
    const orderId = this.generateOrderId();

    const fullConfig: OrderConfiguration = {
      ...DEFAULT_ORDER_CONFIG,
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
  async updateOrderConfig(
    orderId: string,
    config: Partial<OrderConfiguration>,
  ): Promise<Order | null> {
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
    // Basic validation
    const telegramLinkRegex = /^https?:\/\/(t\.me|telegram\.me)\/([\w\d_]+|\+[\w\d_]+)$/i;

    if (!telegramLinkRegex.test(link)) {
      return {
        valid: false,
        error: 'Неверный формат ссылки',
      };
    }

    // TODO: Implement real validation with Telegram API
    // For now, accept all valid format links
    return { valid: true };
  }

  /**
   * Get channel info from link
   */
  async getChannelInfo(link: string): Promise<ChannelInfo | null> {
    // Extract username from link
    const match = link.match(/t\.me\/([\w\d_]+)/i);
    if (!match) {
      return null;
    }

    const username = match[1];

    // TODO: Implement real API call to get channel info
    // Mock data for now
    const mockChannel: ChannelInfo = {
      id: `channel_${Date.now()}`,
      title: 'Fun Games',
      username,
      subscriberCount: 1234,
      description: 'Games catalog',
      category: '🎮 Игры',
      botIsAdmin: false,
    };

    this.logger.log(`Channel info retrieved: ${username}`);

    return mockChannel;
  }

  /**
   * Check if bot is admin in channel
   */
  async checkBotIsAdmin(channelId: string): Promise<boolean> {
    // TODO: Implement real check using Telegram API
    // For now, return false to simulate manual check
    this.logger.log(`Checking bot admin status for channel: ${channelId}`);
    return false;
  }

  /**
   * Update channel bot admin status
   */
  async updateChannelBotAdmin(channelId: string, isAdmin: boolean): Promise<void> {
    // Find all orders with this channel
    for (const order of this.orders.values()) {
      if (order.channel.id === channelId) {
        order.channel.botIsAdmin = isAdmin;
        order.updatedAt = new Date();
        this.orders.set(order.id, order);
      }
    }

    this.logger.log(`Bot admin status updated for channel ${channelId}: ${isAdmin}`);
  }

  /**
   * Get order session state from context
   */
  getOrderSessionState(ctx: BotContext): OrderSessionState | null {
    return (ctx.session?.formData?.orderCreation as OrderSessionState) || null;
  }

  /**
   * Save order session state to context
   */
  saveOrderSessionState(ctx: BotContext, state: OrderSessionState): void {
    if (!ctx.session) {
      ctx.session = {};
    }
    if (!ctx.session.formData) {
      ctx.session.formData = {};
    }
    ctx.session.formData.orderCreation = state;
  }

  /**
   * Clear order session state
   */
  clearOrderSessionState(ctx: BotContext): void {
    if (ctx.session?.formData) {
      delete ctx.session.formData.orderCreation;
    }
  }

  /**
   * Initialize order creation flow
   */
  initOrderCreation(ctx: BotContext): OrderSessionState {
    const state: OrderSessionState = {
      currentStep: OrderFlowStep.EnterChannelLink,
      config: { ...DEFAULT_ORDER_CONFIG },
      startedAt: new Date(),
    };

    this.saveOrderSessionState(ctx, state);
    return state;
  }

  /**
   * Move to next step in order creation
   */
  moveToNextStep(ctx: BotContext, nextStep: OrderFlowStep): void {
    const state = this.getOrderSessionState(ctx);
    if (state) {
      state.currentStep = nextStep;
      this.saveOrderSessionState(ctx, state);
    }
  }

  /**
   * Update order creation config
   */
  updateOrderCreationConfig(ctx: BotContext, config: Partial<OrderConfiguration>): void {
    const state = this.getOrderSessionState(ctx);
    if (state) {
      state.config = {
        ...state.config,
        ...config,
      };
      this.saveOrderSessionState(ctx, state);
    }
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

    // TODO: Implement real stats refresh from tracking system
    // For now, simulate some activity
    order.stats.subscribersToday = Math.floor(Math.random() * 50);
    order.stats.totalSubscribers += order.stats.subscribersToday;
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

    // TODO: Implement real report generation
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
   * Helper: Generate unique order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
