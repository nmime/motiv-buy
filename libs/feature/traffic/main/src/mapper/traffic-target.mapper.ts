import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficTargetEntity, TrafficTargetType, TrafficTargetStatus, UserEntity } from '@app/database';
import { ITrafficTargetRepository } from '../repository';

/**
 * MikroORM mapper implementation for traffic target repository
 */
@Injectable()
export class TrafficTargetMapper implements ITrafficTargetRepository {
  private readonly logger = new Logger(TrafficTargetMapper.name);

  constructor(
    @InjectRepository(TrafficTargetEntity)
    private readonly trafficTargetRepository: EntityRepository<TrafficTargetEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: EntityRepository<UserEntity>,
    private readonly em: EntityManager,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    type: TrafficTargetType;
    status: TrafficTargetStatus;
    telegramId?: string;
    username?: string;
    inviteLink?: string;
    pricePerMember?: string;
    minMembers?: number;
    maxMembers?: number;
    managedById?: string;
    requiresApproval?: boolean;
  }): Promise<TrafficTargetEntity> {
    this.logger.log(`Creating traffic target: ${data.name}`);

    const targetData: {
      name: string;
      description?: string;
      type: TrafficTargetType;
      status: TrafficTargetStatus;
      telegramId?: string;
      username?: string;
      inviteLink?: string;
      pricePerMember?: string;
      minMembers?: number;
      maxMembers?: number;
      requiresApproval?: boolean;
      managedById?: string;
    } = {
      name: data.name,
      description: data.description,
      type: data.type,
      status: data.status,
      telegramId: data.telegramId,
      username: data.username,
      inviteLink: data.inviteLink,
      pricePerMember: data.pricePerMember,
      minMembers: data.minMembers,
      maxMembers: data.maxMembers,
      requiresApproval: data.requiresApproval ?? false,
    };

    if (data.managedById) {
      targetData.managedById = data.managedById;
    }

    const target = new TrafficTargetEntity(targetData);
    const em = this.em.fork();
    em.persist(target);
    await em.flush();

    this.logger.log(`Traffic target created with ID: ${target.id}`);

    return target;
  }

  async findById(id: string): Promise<TrafficTargetEntity | null> {
    return this.trafficTargetRepository.findOne({ id }, { populate: ['managedBy'] });
  }

  async findByTelegramId(telegramId: string): Promise<TrafficTargetEntity | null> {
    return this.trafficTargetRepository.findOne({ telegramId }, { populate: ['managedBy'] });
  }

  async findByUsername(username: string): Promise<TrafficTargetEntity | null> {
    return this.trafficTargetRepository.findOne({ username }, { populate: ['managedBy'] });
  }

  async findByManager(managerId: string): Promise<TrafficTargetEntity[]> {
    return this.trafficTargetRepository.find(
      { managedBy: managerId, status: TrafficTargetStatus.Active },
      { populate: ['managedBy'], orderBy: { createdAt: 'DESC' } },
    );
  }

  async findActive(): Promise<TrafficTargetEntity[]> {
    return this.trafficTargetRepository.find(
      { status: TrafficTargetStatus.Active },
      { populate: ['managedBy'], orderBy: { createdAt: 'DESC' } },
    );
  }

  async update(id: string, data: Partial<TrafficTargetEntity>): Promise<TrafficTargetEntity> {
    this.logger.log(`Updating traffic target: ${id}`);

    const em = this.em.fork();
    const target = await em.findOneOrFail(TrafficTargetEntity, { id });
    em.assign(target, data);
    await em.flush();

    this.logger.log(`Traffic target updated: ${id}`);

    return target;
  }

  async deactivate(id: string): Promise<void> {
    this.logger.log(`Deactivating traffic target: ${id}`);

    const em = this.em.fork();
    const target = await em.findOneOrFail(TrafficTargetEntity, { id });
    target.status = TrafficTargetStatus.Inactive;
    await em.flush();

    this.logger.log(`Traffic target deactivated: ${id}`);
  }

  async validateTargetAccess(targetId: string, userId: string): Promise<boolean> {
    const target = await this.trafficTargetRepository.findOne({
      id: targetId,
      $or: [{ managedBy: userId }, { requiresApproval: false, status: TrafficTargetStatus.Active }],
    });

    return target !== null;
  }
}
