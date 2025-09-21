import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  TrafficOrderEntity,
  TrafficOrderStatus,
  TrafficOrderType,
  TrafficOrderRequirements,
  UserEntity,
  TrafficSourceEntity,
  TrafficTargetEntity,
  TrafficUserEntity,
} from '@app/database';
import { ITrafficOrderRepository } from '../repository';
import { randomBytes } from 'crypto';

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
    trafficSourceId: string;
    trafficTargetId: string;
    assignedTrafficUserId?: string;
    createdById?: string;
  }): Promise<TrafficOrderEntity> {
    this.logger.log(`Creating traffic order: ${data.orderId}`);

    const orderData: Partial<TrafficOrderEntity> = {
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
      trafficSourceId: data.trafficSourceId,
      trafficTargetId: data.trafficTargetId,
    };

    if (data.assignedTrafficUserId) {
      orderData.assignedTrafficUserId = data.assignedTrafficUserId;
    }

    if (data.createdById) {
      orderData.createdById = data.createdById;
    }

    const order = new TrafficOrderEntity(orderData);
    await this.trafficOrderRepository.persistAndFlush(order);

    this.logger.log(`Traffic order created with ID: ${order.id}`);

    return order;
  }

  async findById(id: string): Promise<TrafficOrderEntity | null> {
    return this.trafficOrderRepository.findOne(
      { id },
      { populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser', 'createdBy'] },
    );
  }

  async findByOrderId(orderId: string): Promise<TrafficOrderEntity | null> {
    return this.trafficOrderRepository.findOne(
      { orderId },
      { populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser', 'createdBy'] },
    );
  }

  async findByCreator(creatorId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { creator: creatorId },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findByTrafficSource(trafficSourceId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { trafficSource: trafficSourceId },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findByTrafficTarget(trafficTargetId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { trafficTarget: trafficTargetId },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findByStatus(status: TrafficOrderStatus): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      { status },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async findActiveByUser(userId: string): Promise<TrafficOrderEntity[]> {
    return this.trafficOrderRepository.find(
      {
        creator: userId,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress, TrafficOrderStatus.Pending] },
      },
      {
        populate: ['creator', 'trafficSource', 'trafficTarget', 'assignedTrafficUser'],
        orderBy: { createdAt: 'DESC' },
      },
    );
  }

  async update(id: string, data: Partial<TrafficOrderEntity>): Promise<TrafficOrderEntity> {
    this.logger.log(`Updating traffic order: ${id}`);

    const order = await this.trafficOrderRepository.findOneOrFail({ id });
    this.trafficOrderRepository.assign(order, data);
    await this.trafficOrderRepository.flush();

    this.logger.log(`Traffic order updated: ${id}`);

    return order;
  }

  async updateProgress(orderId: string, currentCount: number, spentAmount: string): Promise<void> {
    this.logger.log(`Updating order progress: ${orderId}, count: ${currentCount}, spent: ${spentAmount}`);

    const order = await this.trafficOrderRepository.findOneOrFail({ orderId });
    order.currentCount = currentCount;
    order.spentAmount = spentAmount;

    // Check if order is complete
    if (currentCount >= order.targetCount) {
      order.status = TrafficOrderStatus.Completed;
      order.completedAt = new Date();
    }

    await this.trafficOrderRepository.flush();
    this.logger.log(`Order progress updated: ${orderId}`);
  }

  async complete(orderId: string): Promise<void> {
    this.logger.log(`Completing order: ${orderId}`);

    const order = await this.trafficOrderRepository.findOneOrFail({ orderId });
    order.status = TrafficOrderStatus.Completed;
    order.completedAt = new Date();
    await this.trafficOrderRepository.flush();

    this.logger.log(`Order completed: ${orderId}`);
  }

  async cancel(orderId: string): Promise<void> {
    this.logger.log(`Cancelling order: ${orderId}`);

    const order = await this.trafficOrderRepository.findOneOrFail({ orderId });
    order.status = TrafficOrderStatus.Cancelled;
    await this.trafficOrderRepository.flush();

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
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress, TrafficOrderStatus.Pending] },
      }),
      this.trafficOrderRepository.count({
        creator: userId,
        status: TrafficOrderStatus.Completed,
      }),
    ]);

    // Calculate total spent
    const orders = await this.trafficOrderRepository.find({ creator: userId }, { fields: ['spentAmount'] });

    const totalSpent = orders
      .reduce((sum, order) => {
        return sum + parseFloat(order.spentAmount || '0');
      }, 0)
      .toFixed(4);

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalSpent,
    };
  }
}
