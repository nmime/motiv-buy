import { EntityManager, EntityRepository, ref, Reference } from '@mikro-orm/core';
import {
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
  UserEntity,
} from '../entity';
import { decimal, divide, greaterThanOrEqual, lessThanOrEqual, multiply, sum, toNumber } from '@app/common-shared';

export class TrafficOrderRepository extends EntityRepository<TrafficOrderEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficOrderEntity);
  }

  async findByOrderId(orderId: string): Promise<TrafficOrderEntity | null> {
    return this.findOne({ orderId });
  }

  async findByCreator(creatorId: string): Promise<TrafficOrderEntity[]> {
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
      status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
    });
  }

  async findPendingOrders(): Promise<TrafficOrderEntity[]> {
    return this.find({ status: TrafficOrderStatus.Pending });
  }

  async findByTrafficSource(trafficSourceId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficSource: trafficSourceId });
  }

  async findByTrafficTarget(trafficTargetId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ trafficTarget: trafficTargetId });
  }

  async findByAssignedUser(trafficUserId: string): Promise<TrafficOrderEntity[]> {
    return this.find({ assignedTrafficUser: trafficUserId });
  }

  async findOrdersByBudgetRange(minBudget: number, maxBudget: number): Promise<TrafficOrderEntity[]> {
    const results = await this.findAll();

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
    return this.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });
  }

  async createOrder(data: {
    orderId: string;
    type: TrafficOrderType;
    targetCount: number;
    pricePerAction: number;
    totalBudget: number;
    creator: Reference<UserEntity>;
    trafficSource: Reference<TrafficSourceEntity>;
    trafficTarget: Reference<TrafficTargetEntity>;
    description?: string;
    targetUrl?: string;
    requirements?: string;
    startDate?: Date;
    endDate?: Date;
    assignedTrafficUser?: Reference<TrafficUserEntity>;
  }): Promise<TrafficOrderEntity> {
    const {
      totalBudget,
      pricePerAction,
      requirements,
      creator,
      trafficSource,
      trafficTarget,
      assignedTrafficUser,
      ...otherData
    } = data;

    const order = new TrafficOrderEntity({
      ...otherData,
      creatorId: typeof creator === 'string' ? creator : creator.getEntity().id,
      trafficSourceId: typeof trafficSource === 'string' ? trafficSource : trafficSource.getEntity().id,
      trafficTargetId: typeof trafficTarget === 'string' ? trafficTarget : trafficTarget.getEntity().id,
      assignedTrafficUserId:
        typeof assignedTrafficUser === 'string' ? assignedTrafficUser : assignedTrafficUser?.getEntity().id,
      totalBudget: totalBudget.toString(),
      pricePerAction: pricePerAction.toString(),
      requirements:
        typeof requirements === 'string' ? (JSON.parse(requirements) as Record<string, unknown>) : requirements,
      status: TrafficOrderStatus.Pending,
      currentCount: 0,
      spentAmount: '0',
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

  async assignUser(orderId: string, trafficUserId: string): Promise<void> {
    const order = await this.findByOrderId(orderId);
    if (order) {
      order.assignedTrafficUser = ref(this.em.getReference(TrafficUserEntity, trafficUserId));
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
    const [total, pending, active, inProgress, completed, cancelled, failed] = await Promise.all([
      this.count(),
      this.count({ status: TrafficOrderStatus.Pending }),
      this.count({ status: TrafficOrderStatus.Active }),
      this.count({ status: TrafficOrderStatus.InProgress }),
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
      inProgress,
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
