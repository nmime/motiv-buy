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

  async findByCreator(creatorId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ creator: creatorId });
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

  async findOrdersByTrafficSource(trafficSourceId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficSource: trafficSourceId });
  }

  async findOrdersByTrafficBuyer(trafficBuyerId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficBuyer: trafficBuyerId });
  }

  async findOrdersByAssignedUser(trafficUserId: number): Promise<TrafficOrderEntity[]> {
    return this.find({ assignedTrafficUser: trafficUserId });
  }

  async findOrdersByBudgetRange(minBudget: number, maxBudget: number): Promise<TrafficOrderEntity[]> {
    return this.find({ 
      totalBudget: { $gte: minBudget, $lte: maxBudget } 
    });
  }

  async findOrdersByDateRange(startDate: Date, endDate: Date): Promise<TrafficOrderEntity[]> {
    return this.find({ 
      createdAt: { $gte: startDate, $lte: endDate } 
    });
  }

  async createTrafficOrder(data: {
    orderId: string;
    type: TrafficOrderType;
    status: TrafficOrderStatus;
    targetCount: number;
    pricePerAction: number;
    totalBudget: number;
    description?: string;
    targetUrl?: string;
    requirements?: string;
    startDate?: Date;
    endDate?: Date;
    creator: UserEntity;
    trafficSourceId: number;
    trafficBuyerId: number;
    assignedUserId?: number;
  }): Promise<TrafficOrderEntity> {
    const trafficSource = await this.em.findOneOrFail(TrafficSourceEntity, data.trafficSourceId);
    const trafficBuyer = await this.em.findOneOrFail(TrafficBuyerEntity, data.trafficBuyerId);
    
    let assignedTrafficUser: TrafficUserEntity | undefined;
    if (data.assignedUserId) {
      assignedTrafficUser = await this.em.findOneOrFail(TrafficUserEntity, data.assignedUserId);
    }

    const trafficOrder = new TrafficOrderEntity({
      orderId: data.orderId,
      type: data.type,
      status: data.status,
      targetCount: data.targetCount,
      pricePerAction: data.pricePerAction,
      totalBudget: data.totalBudget,
      description: data.description,
      targetUrl: data.targetUrl,
      requirements: data.requirements,
      startDate: data.startDate,
      endDate: data.endDate,
      creator: data.creator,
      trafficSource,
      trafficBuyer,
      assignedTrafficUser
    });
    await this.em.persistAndFlush(trafficOrder);
    return trafficOrder;
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
      order.spentAmount = amount;
      await this.em.flush();
    }
  }

  async assignUser(orderId: string, trafficUserId: number): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.assignedTrafficUser = this.em.getReference('TrafficUserEntity', trafficUserId) as any;
      order.status = TrafficOrderStatus.InProgress;
      await this.em.flush();
    }
  }

  async unassignUser(orderId: string): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.assignedTrafficUser = undefined;
      order.status = TrafficOrderStatus.Pending;
      await this.em.flush();
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.status = TrafficOrderStatus.Cancelled;
      await this.em.flush();
    }
  }

  async markAsFailed(orderId: string): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.status = TrafficOrderStatus.Failed;
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
    const totalBudget = orders.reduce((sum, order) => sum + order.totalBudget, 0);
    const totalSpent = orders.reduce((sum, order) => sum + order.spentAmount, 0);

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
