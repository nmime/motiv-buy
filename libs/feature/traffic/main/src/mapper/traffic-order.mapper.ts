import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import {
  TrafficOrderEntity,
  TrafficOrderRequirements,
  TrafficOrderSourceEntity,
  TrafficOrderSourceStatus,
  TrafficOrderStatus,
  TrafficOrderTargetEntity,
  TrafficOrderTargetStatus,
  TrafficOrderType,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
  UserEntity,
} from '@app/database';
import { ITrafficOrderRepository, OrderSourceAssignment, OrderTargetAssignment } from '../repository';
import { randomBytes } from 'crypto';
import { sum, toDisplayString } from '@app/common-shared';

/**
 * MikroORM mapper implementation for traffic order repository
 */
@Injectable()
export class TrafficOrderMapper implements ITrafficOrderRepository {
  private readonly logger = new Logger(TrafficOrderMapper.name);

  constructor(
    @InjectRepository(TrafficOrderEntity)
    private readonly trafficOrderRepository: EntityRepository<TrafficOrderEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: EntityRepository<UserEntity>,
    @InjectRepository(TrafficSourceEntity)
    private readonly trafficSourceRepository: EntityRepository<TrafficSourceEntity>,
    @InjectRepository(TrafficTargetEntity)
    private readonly trafficTargetRepository: EntityRepository<TrafficTargetEntity>,
    @InjectRepository(TrafficUserEntity)
    private readonly trafficUserRepository: EntityRepository<TrafficUserEntity>,
    @InjectRepository(TrafficOrderSourceEntity)
    private readonly orderSourceRepository: EntityRepository<TrafficOrderSourceEntity>,
    @InjectRepository(TrafficOrderTargetEntity)
    private readonly orderTargetRepository: EntityRepository<TrafficOrderTargetEntity>,
    private readonly em: EntityManager,
  ) {}

  async create(data: {
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
    assignedTrafficUserId?: string;
    createdById?: string;
    sources?: OrderSourceAssignment[];
    targets?: OrderTargetAssignment[];
  }): Promise<TrafficOrderEntity> {
    this.logger.log(`Creating traffic order: ${data.orderId}`);

    const em = this.em.fork();

    // Create the order
    const order = new TrafficOrderEntity({
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
      creatorId: data.creatorId,
      assignedTrafficUserId: data.assignedTrafficUserId,
      createdById: data.createdById,
    });

    em.persist(order);
    await em.flush();

    // Add sources via junction table
    if (data.sources && data.sources.length > 0) {
      for (const source of data.sources) {
        const orderSource = new TrafficOrderSourceEntity({
          trafficOrderId: order.id,
          trafficSourceId: source.trafficSourceId,
          allocatedCount: source.allocatedCount,
          allocatedBudget: source.allocatedBudget,
          pricePerAction: source.pricePerAction,
          isPrimary: source.isPrimary ?? false,
          status: TrafficOrderSourceStatus.Pending,
        });

        em.persist(orderSource);
      }
    }

    // Add targets via junction table
    if (data.targets && data.targets.length > 0) {
      for (const target of data.targets) {
        const orderTarget = new TrafficOrderTargetEntity({
          trafficOrderId: order.id,
          trafficTargetId: target.trafficTargetId,
          allocatedCount: target.allocatedCount,
          allocatedBudget: target.allocatedBudget,
          pricePerAction: target.pricePerAction,
          targetUrl: target.targetUrl,
          isPrimary: target.isPrimary ?? false,
          status: TrafficOrderTargetStatus.Pending,
        });

        em.persist(orderTarget);
      }
    }

    await em.flush();

    this.logger.log(`Traffic order created with ID: ${order.id}`);

    return order;
  }

  async findById(id: string): Promise<TrafficOrderEntity | null> {
    return this.trafficOrderRepository.findOne(
      { id },
      { populate: ['creator', 'assignedTrafficUser', 'createdBy', 'orderSources', 'orderTargets'] },
    );
  }

  async findByOrderId(orderId: string): Promise<TrafficOrderEntity | null> {
    return this.trafficOrderRepository.findOne(
      { orderId },
      { populate: ['creator', 'assignedTrafficUser', 'createdBy', 'orderSources', 'orderTargets'] },
    );
  }

  async findByCreator(creatorId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { creator: creatorId },
      {
        populate: ['creator', 'assignedTrafficUser', 'orderSources', 'orderTargets'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findByTrafficSource(trafficSourceId: string): Promise<TrafficOrderEntity[]> {
    const orderSources = await this.orderSourceRepository.find(
      { trafficSource: trafficSourceId },
      { populate: ['trafficOrder'] },
    );

    const orders = await Promise.all(
      orderSources.map(async (os) => {
        const order = os.trafficOrder.getEntity();
        await this.em.populate(order, ['creator', 'assignedTrafficUser', 'orderSources', 'orderTargets']);

        return order;
      }),
    );

    return orders;
  }

  async findByTrafficTarget(trafficTargetId: string): Promise<TrafficOrderEntity[]> {
    const orderTargets = await this.orderTargetRepository.find(
      { trafficTarget: trafficTargetId },
      { populate: ['trafficOrder'] },
    );

    const orders = await Promise.all(
      orderTargets.map(async (ot) => {
        const order = ot.trafficOrder.getEntity();
        await this.em.populate(order, ['creator', 'assignedTrafficUser', 'orderSources', 'orderTargets']);

        return order;
      }),
    );

    return orders;
  }

  async findByStatus(status: TrafficOrderStatus): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { status },
      {
        populate: ['creator', 'assignedTrafficUser', 'orderSources', 'orderTargets'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findActiveByUser(userId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      {
        creator: userId,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.Pending, TrafficOrderStatus.Moderation] },
      },
      {
        populate: ['creator', 'assignedTrafficUser', 'orderSources', 'orderTargets'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async update(id: string, data: Partial<TrafficOrderEntity>): Promise<TrafficOrderEntity> {
    this.logger.log(`Updating traffic order: ${id}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { id });
    em.assign(order, data);
    await em.flush();

    this.logger.log(`Traffic order updated: ${id}`);

    return order;
  }

  async updateProgress(orderId: string, currentCount: number, spentAmount: string): Promise<void> {
    this.logger.log(`Updating order progress: ${orderId}, count: ${currentCount}, spent: ${spentAmount}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });
    order.currentCount = currentCount;
    order.spentAmount = spentAmount;

    // Check if order is complete
    if (currentCount >= order.targetCount) {
      order.status = TrafficOrderStatus.Completed;
      order.completedAt = new Date();
    }

    await em.flush();
    this.logger.log(`Order progress updated: ${orderId}`);
  }

  async complete(orderId: string): Promise<void> {
    this.logger.log(`Completing order: ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });
    order.status = TrafficOrderStatus.Completed;
    order.completedAt = new Date();
    await em.flush();

    this.logger.log(`Order completed: ${orderId}`);
  }

  async cancel(orderId: string): Promise<void> {
    this.logger.log(`Cancelling order: ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });
    order.status = TrafficOrderStatus.Cancelled;
    await em.flush();

    this.logger.log(`Order cancelled: ${orderId}`);
  }

  async validateOrderAccess(orderId: string, userId: string): Promise<boolean> {
    const order = await this.trafficOrderRepository.findOne({
      orderId,
      $or: [{ creator: userId }, { createdBy: userId }],
    });

    return order !== null;
  }

  async generateOrderId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');

    return `TRF-${timestamp}-${random}`.toUpperCase();
  }

  async getOrderStats(userId: string): Promise<{
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalSpent: string;
  }> {
    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.trafficOrderRepository.count({ creator: userId }),
      this.trafficOrderRepository.count({
        creator: userId,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.Pending, TrafficOrderStatus.Moderation] },
      }),
      this.trafficOrderRepository.count({
        creator: userId,
        status: TrafficOrderStatus.Completed,
      }),
    ]);

    // Calculate total spent
    const orders = await this.trafficOrderRepository.find({ creator: userId }, { fields: ['spentAmount'] });

    const totalSpent = toDisplayString(sum(orders.map((order) => order.spentAmount || '0')), 4);

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalSpent,
    };
  }

  async addSource(orderId: string, source: OrderSourceAssignment): Promise<void> {
    this.logger.log(`Adding source ${source.trafficSourceId} to order ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });

    const orderSource = new TrafficOrderSourceEntity({
      trafficOrderId: order.id,
      trafficSourceId: source.trafficSourceId,
      allocatedCount: source.allocatedCount,
      allocatedBudget: source.allocatedBudget,
      pricePerAction: source.pricePerAction,
      isPrimary: source.isPrimary ?? false,
      status: TrafficOrderSourceStatus.Pending,
    });

    em.persist(orderSource);
    await em.flush();

    this.logger.log(`Source added to order: ${orderId}`);
  }

  async addTarget(orderId: string, target: OrderTargetAssignment): Promise<void> {
    this.logger.log(`Adding target ${target.trafficTargetId} to order ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });

    const orderTarget = new TrafficOrderTargetEntity({
      trafficOrderId: order.id,
      trafficTargetId: target.trafficTargetId,
      allocatedCount: target.allocatedCount,
      allocatedBudget: target.allocatedBudget,
      pricePerAction: target.pricePerAction,
      targetUrl: target.targetUrl,
      isPrimary: target.isPrimary ?? false,
      status: TrafficOrderTargetStatus.Pending,
    });

    em.persist(orderTarget);
    await em.flush();

    this.logger.log(`Target added to order: ${orderId}`);
  }

  async removeSource(orderId: string, trafficSourceId: string): Promise<void> {
    this.logger.log(`Removing source ${trafficSourceId} from order ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });

    const orderSource = await em.findOne(TrafficOrderSourceEntity, {
      trafficOrder: order.id,
      trafficSource: trafficSourceId,
    });

    if (orderSource) {
      em.remove(orderSource);
      await em.flush();
    }

    this.logger.log(`Source removed from order: ${orderId}`);
  }

  async removeTarget(orderId: string, trafficTargetId: string): Promise<void> {
    this.logger.log(`Removing target ${trafficTargetId} from order ${orderId}`);

    const em = this.em.fork();
    const order = await em.findOneOrFail(TrafficOrderEntity, { orderId });

    const orderTarget = await em.findOne(TrafficOrderTargetEntity, {
      trafficOrder: order.id,
      trafficTarget: trafficTargetId,
    });

    if (orderTarget) {
      em.remove(orderTarget);
      await em.flush();
    }

    this.logger.log(`Target removed from order: ${orderId}`);
  }
}
