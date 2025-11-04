import { TrafficOrderEntity, TrafficOrderRequirements, TrafficOrderStatus, TrafficOrderType } from '@app/database';

/**
 * Repository interface for traffic order operations
 */
export interface ITrafficOrderRepository {
  /**
   * Create new traffic order
   */
  create(data: {
    orderId: string;
    type: TrafficOrderType;
    status: TrafficOrderStatus;
    targetCount: number;
    pricePerAction: string;
    totalBudget: string;
    description?: string;
    targetUrl?: string;
    requirements?: TrafficOrderRequirements;
    startDate?: Date;
    endDate?: Date;
    creatorId: string;
    trafficSourceId: string;
    trafficTargetId: string;
    assignedTrafficUserId?: string;
    createdById?: string;
  }): Promise<TrafficOrderEntity>;

  /**
   * Find traffic order by ID
   */
  findById(id: string): Promise<TrafficOrderEntity | null>;

  /**
   * Find traffic order by order ID
   */
  findByOrderId(orderId: string): Promise<TrafficOrderEntity | null>;

  /**
   * Find orders by creator
   */
  findByCreator(creatorId: string): Promise<TrafficOrderEntity[]>;

  /**
   * Find orders by traffic source
   */
  findByTrafficSource(trafficSourceId: string): Promise<TrafficOrderEntity[]>;

  /**
   * Find orders by traffic target
   */
  findByTrafficTarget(trafficTargetId: string): Promise<TrafficOrderEntity[]>;

  /**
   * Find orders by status
   */
  findByStatus(status: TrafficOrderStatus): Promise<TrafficOrderEntity[]>;

  /**
   * Find active orders for user
   */
  findActiveByUser(userId: string): Promise<TrafficOrderEntity[]>;

  /**
   * Update traffic order
   */
  update(id: string, data: Partial<TrafficOrderEntity>): Promise<TrafficOrderEntity>;

  /**
   * Update order progress
   */
  updateProgress(orderId: string, currentCount: number, spentAmount: string): Promise<void>;

  /**
   * Complete order
   */
  complete(orderId: string): Promise<void>;

  /**
   * Cancel order
   */
  cancel(orderId: string): Promise<void>;

  /**
   * Check if order exists and is accessible by user
   */
  validateOrderAccess(orderId: string, userId: string): Promise<boolean>;

  /**
   * Generate unique order ID
   */
  generateOrderId(): Promise<string>;

  /**
   * Get order statistics for user
   */
  getOrderStats(userId: string): Promise<{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalSpent: string;
  }>;
}
