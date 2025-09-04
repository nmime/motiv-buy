import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficOrderEntity, TrafficOrderStatus, TrafficOrderType, TrafficSourceEntity, TrafficBuyerEntity, TrafficUserEntity } from '../entity';
import { UserEntity } from '../entity';

export class TrafficOrderRepository extends EntityRepository<TrafficOrderEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficOrderEntity);
  }

  async findByOrderId(orderId: string): Promise<TrafficOrderEntity | null> {
    return this.findOne({ orderId });
  }

  async findByCreator(creatorId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ creatorId });
  }

  async findByStatus(status: TrafficOrderStatus): Promise<TrafficOrderEntity[]> {
    return this.find({ status });
  }

  async findByType(type: TrafficOrderType): Promise<TrafficOrderEntity[]> {
    return this.find({ type });
  }

  async findActiveOrders(): Promise<TrafficOrderEntity[]> {
    return this.find({ 
      status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] } 
    });
  }

  async findPendingOrders(): Promise<TrafficOrderEntity[]> {
    return this.find({ status: TrafficOrderStatus.Pending });
  }

  async findByTrafficSource(trafficSourceId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficSourceId });
  }

  async findByTrafficBuyer(trafficBuyerId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficBuyerId });
  }

  async findByAssignedUser(trafficUserId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ assignedTrafficUserId: trafficUserId });
  }

  async findOrdersByBudgetRange(minBudget: number, maxBudget: number): Promise<TrafficOrderEntity[]> {
    const results = await this.findAll();
    
    return results.filter(order => {
      if (!order.totalBudget) return false;
      const budget = parseFloat(order.totalBudget);
      return budget >= minBudget && budget <= maxBudget;
    });
  }

  async findOrdersByDateRange(startDate: Date, endDate: Date): Promise<TrafficOrderEntity[]> {
    return this.find({ 
      createdAt: { $gte: startDate, $lte: endDate } 
    });
  }

  async createOrder(data: {
    orderId: string;
    type: TrafficOrderType;
    targetCount: number;
    pricePerAction: number;
    totalBudget: number;
    creatorId: string;
    trafficSourceId: number;
    trafficBuyerId: number;
    description?: string;
    targetUrl?: string;
    requirements?: string;
    startDate?: Date;
    endDate?: Date;
    assignedTrafficUserId?: number;
  }): Promise<TrafficOrderEntity> {
    const order = new TrafficOrderEntity({
      ...data,
      totalBudget: data.totalBudget.toString(),
      pricePerAction: data.pricePerAction.toString(),
      requirements: data.requirements ? JSON.parse(data.requirements) : undefined,
      status: TrafficOrderStatus.Pending
    });
    await this.em.persistAndFlush(order);
    return order;
  }

  async updateStatus(orderId: string, status: TrafficOrderStatus): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.status = status;
      if (status === TrafficOrderStatus.Completed) {
        order.completedAt = new Date();
      }
      await this.em.flush();
    }
  }

  async updateProgress(orderId: string, currentCount: number): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.currentCount = currentCount;
      if (currentCount >= order.targetCount) {
        order.status = TrafficOrderStatus.Completed;
        order.completedAt = new Date();
      }
      await this.em.flush();
    }
  }

  async updateSpentAmount(orderId: string, amount: number): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.spentAmount = amount.toString();
      await this.em.flush();
    }
  }

  async assignUser(orderId: string, trafficUserId: number): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.assignedTrafficUserId = trafficUserId;
      order.status = TrafficOrderStatus.InProgress;
      await this.em.flush();
    }
  }

  async unassignUser(orderId: string): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.assignedTrafficUserId = undefined;
      order.status = TrafficOrderStatus.Pending;
      await this.em.flush();
    }
  }

  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    active: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    failed: number;
    totalBudget: number;
    totalSpent: number;
  }> {
    const [
      total, pending, active, inProgress, completed, cancelled, failed
    ] = await Promise.all([
      this.count(),
      this.count({ status: TrafficOrderStatus.Pending }),
      this.count({ status: TrafficOrderStatus.Active }),
      this.count({ status: TrafficOrderStatus.InProgress }),
      this.count({ status: TrafficOrderStatus.Completed }),
      this.count({ status: TrafficOrderStatus.Cancelled }),
      this.count({ status: TrafficOrderStatus.Failed })
    ]);

    const orders = await this.findAll();
    const totalBudget = orders.reduce((sum, order) => sum + parseFloat(order.totalBudget || '0'), 0);
    const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.spentAmount || '0'), 0);

    return {
      total, pending, active, inProgress, completed, cancelled, failed,
      totalBudget, totalSpent
    };
  }

  async getOrdersByTypeStats(): Promise<{
    join: number;
    leave: number;
    view: number;
    subscribe: number;
    unsubscribe: number;
    react: number;
    comment: number;
  }> {
    const [join, leave, view, subscribe, unsubscribe, react, comment] = await Promise.all([
      this.count({ type: TrafficOrderType.Join }),
      this.count({ type: TrafficOrderType.Leave }),
      this.count({ type: TrafficOrderType.View }),
      this.count({ type: TrafficOrderType.Subscribe }),
      this.count({ type: TrafficOrderType.Unsubscribe }),
      this.count({ type: TrafficOrderType.React }),
      this.count({ type: TrafficOrderType.Comment })
    ]);

    return { join, leave, view, subscribe, unsubscribe, react, comment };
  }

  async getCompletionRate(): Promise<number> {
    const [total, completed] = await Promise.all([
      this.count(),
      this.count({ status: TrafficOrderStatus.Completed })
    ]);

    return total > 0 ? (completed / total) * 100 : 0;
  }
}
