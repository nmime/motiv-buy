import { EntityManager, EntityRepository } from '@mikro-orm/core';
import {
  TrafficOrderEntity,
  TrafficOrderSourceEntity,
  TrafficOrderStatus,
  TrafficOrderTargetEntity,
  TrafficOrderType,
  TrafficUserEntity,
} from '../entity';
import { decimal, divide, greaterThanOrEqual, lessThanOrEqual, multiply, sum, toNumber } from '@app/common-shared';

export class TrafficOrderRepository extends EntityRepository<TrafficOrderEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficOrderEntity);
  }

  async findByOrderId(orderId: string): Promise<TrafficOrderEntity | null> {
    return this.findOne({ orderId }, { populate: ['orderSources', 'orderTargets'] });
  }

  async findByCreator(creatorId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ creator: creatorId }, { populate: ['orderSources', 'orderTargets'] });
  }

  async findByStatus(status: TrafficOrderStatus): Promise<TrafficOrderEntity[]> {
    return this.find({ status }, { populate: ['orderSources', 'orderTargets'] });
  }

  async findByType(type: TrafficOrderType): Promise<TrafficOrderEntity[]> {
    return this.find({ type }, { populate: ['orderSources', 'orderTargets'] });
  }

  async findActiveOrders(): Promise<TrafficOrderEntity[]> {
    return this.find(
      {
        status: TrafficOrderStatus.Active,
      },
      { populate: ['orderSources', 'orderTargets'] },
    );
  }

  async findPendingOrders(): Promise<TrafficOrderEntity[]> {
    return this.find({ status: TrafficOrderStatus.Pending }, { populate: ['orderSources', 'orderTargets'] });
  }

  /**
   * Find orders by traffic source using junction table
   */
  async findByTrafficSource(trafficSourceId: string): Promise<TrafficOrderEntity[]> {
    const orderSources = await this.em.find(
      TrafficOrderSourceEntity,
      { trafficSource: trafficSourceId },
      { populate: ['trafficOrder'] },
    );

    return orderSources.map((os) => os.trafficOrder.getEntity());
  }

  /**
   * Find orders by traffic target using junction table
   */
  async findByTrafficTarget(trafficTargetId: string): Promise<TrafficOrderEntity[]> {
    const orderTargets = await this.em.find(
      TrafficOrderTargetEntity,
      { trafficTarget: trafficTargetId },
      { populate: ['trafficOrder'] },
    );

    return orderTargets.map((ot) => ot.trafficOrder.getEntity());
  }

  async findByAssignedUser(trafficUserId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ assignedTrafficUser: trafficUserId }, { populate: ['orderSources', 'orderTargets'] });
  }

  async findOrdersByBudgetRange(minBudget: number, maxBudget: number): Promise<TrafficOrderEntity[]> {
    const results = await this.findAll({ populate: ['orderSources', 'orderTargets'] });

    return results.filter((order) => {
      if (!order.totalBudget) {
        return false;
      }

      const budget = decimal(order.totalBudget);
      const min = decimal(minBudget);
      const max = decimal(maxBudget);

      return greaterThanOrEqual(budget, min) && lessThanOrEqual(budget, max);
    });
  }

  async findOrdersByDateRange(startDate: Date, endDate: Date): Promise<TrafficOrderEntity[]> {
    return this.find(
      {
        createdAt: { $gte: startDate, $lte: endDate },
      },
      { populate: ['orderSources', 'orderTargets'] },
    );
  }

  async updateStatus(orderId: string, status: TrafficOrderStatus): Promise<void> {
    const em = this.em.fork();
    const order = await em.findOne(TrafficOrderEntity, { orderId });
    if (order) {
      order.status = status;
      if (status === TrafficOrderStatus.Completed) {
        order.completedAt = new Date();
      }

      await em.flush();
    }
  }

  async updateProgress(orderId: string, currentCount: number): Promise<void> {
    const em = this.em.fork();
    const order = await em.findOne(TrafficOrderEntity, { orderId });
    if (order) {
      order.currentCount = currentCount;
      if (currentCount >= order.targetCount) {
        order.status = TrafficOrderStatus.Completed;
        order.completedAt = new Date();
      }

      await em.flush();
    }
  }

  async updateSpentAmount(orderId: string, amount: number): Promise<void> {
    const em = this.em.fork();
    const order = await em.findOne(TrafficOrderEntity, { orderId });
    if (order) {
      order.spentAmount = amount.toString();
      await em.flush();
    }
  }

  async assignUser(orderId: string, trafficUserId: string): Promise<void> {
    const em = this.em.fork();
    const order = await em.findOne(TrafficOrderEntity, { orderId });
    if (order) {
      const trafficUser = em.getReference(TrafficUserEntity, trafficUserId);
      order.assignedTrafficUser = { getEntity: () => trafficUser } as typeof order.assignedTrafficUser;
      order.status = TrafficOrderStatus.Active;
      await em.flush();
    }
  }

  async unassignUser(orderId: string): Promise<void> {
    const em = this.em.fork();
    const order = await em.findOne(TrafficOrderEntity, { orderId });
    if (order) {
      order.assignedTrafficUser = undefined;
      order.status = TrafficOrderStatus.Pending;
      await em.flush();
    }
  }

  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
    failed: number;
    totalBudget: number;
    totalSpent: number;
  }> {
    const [total, pending, active, completed, cancelled, failed] = await Promise.all([
      this.count(),
      this.count({ status: TrafficOrderStatus.Pending }),
      this.count({ status: TrafficOrderStatus.Active }),
      this.count({ status: TrafficOrderStatus.Completed }),
      this.count({ status: TrafficOrderStatus.Cancelled }),
      this.count({ status: TrafficOrderStatus.Failed }),
    ]);

    const orders = await this.findAll();
    const totalBudget = toNumber(sum(orders.map((order) => decimal(order.totalBudget || '0'))));
    const totalSpent = toNumber(sum(orders.map((order) => decimal(order.spentAmount || '0'))));

    return {
      total,
      pending,
      active,
      completed,
      cancelled,
      failed,
      totalBudget,
      totalSpent,
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
      this.count({ type: TrafficOrderType.Comment }),
    ]);

    return { join, leave, view, subscribe, unsubscribe, react, comment };
  }

  async getCompletionRate(): Promise<number> {
    const [total, completed] = await Promise.all([this.count(), this.count({ status: TrafficOrderStatus.Completed })]);

    return total > 0 ? toNumber(multiply(divide(decimal(completed), decimal(total)), decimal(100))) : 0;
  }
}
