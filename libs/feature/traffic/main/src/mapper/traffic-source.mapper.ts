import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { getErrorMessage } from '@app/common-shared';
import { TrafficSourceEntity, TrafficSourceType, UserEntity } from '@app/database';
import { ITrafficSourceRepository } from '../repository';

/**
 * MikroORM mapper implementation for traffic source repository
 */
@Injectable()
export class TrafficSourceMapper implements ITrafficSourceRepository {
  private readonly logger = new Logger(TrafficSourceMapper.name);

  constructor(
    @InjectRepository(TrafficSourceEntity)
    private readonly trafficSourceRepository: EntityRepository<TrafficSourceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: EntityRepository<UserEntity>,
    private readonly em: EntityManager,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    type: TrafficSourceType;
    botToken?: string;
    botUsername?: string;
    telegramId?: string;
    managedById?: string;
  }): Promise<TrafficSourceEntity> {
    this.logger.log(`Creating traffic source: ${data.name}`);

    const sourceData: {
      name: string;
      description?: string;
      type: TrafficSourceType;
      botToken?: string;
      botUsername?: string;
      telegramId?: string;
      managedById?: string;
    } = {
      name: data.name,
      description: data.description,
      type: data.type,
      botToken: data.botToken,
      botUsername: data.botUsername,
      telegramId: data.telegramId,
    };

    if (data.managedById) {
      sourceData.managedById = data.managedById;
    }

    const source = new TrafficSourceEntity(sourceData);
    this.em.persist(source);
    await this.em.flush();

    this.logger.log(`Traffic source created with ID: ${source.id}`);

    return source;
  }

  async findById(id: string): Promise<TrafficSourceEntity | null> {
    return this.trafficSourceRepository.findOne({ id }, { populate: ['managedBy'] });
  }

  async findByBotUsername(botUsername: string): Promise<TrafficSourceEntity | null> {
    return this.trafficSourceRepository.findOne({ botUsername }, { populate: ['managedBy'] });
  }

  async findByTelegramId(telegramId: string): Promise<TrafficSourceEntity | null> {
    return this.trafficSourceRepository.findOne({ telegramId }, { populate: ['managedBy'] });
  }

  async findByManager(managerId: string): Promise<TrafficSourceEntity[]> {
    return this.trafficSourceRepository.find(
      { managedBy: managerId, isActive: true },
      { populate: ['managedBy'], orderBy: { createdAt: 'DESC' } },
    );
  }

  async findActive(): Promise<TrafficSourceEntity[]> {
    return this.trafficSourceRepository.find(
      { isActive: true },
      { populate: ['managedBy'], orderBy: { createdAt: 'DESC' } },
    );
  }

  async update(id: string, data: Partial<TrafficSourceEntity>): Promise<TrafficSourceEntity> {
    this.logger.log(`Updating traffic source: ${id}`);

    const source = await this.trafficSourceRepository.findOneOrFail({ id });
    this.trafficSourceRepository.assign(source, data);
    await this.em.flush();

    this.logger.log(`Traffic source updated: ${id}`);

    return source;
  }

  async deactivate(id: string): Promise<void> {
    this.logger.log(`Deactivating traffic source: ${id}`);

    const source = await this.trafficSourceRepository.findOneOrFail({ id });
    source.isActive = false;
    await this.em.flush();

    this.logger.log(`Traffic source deactivated: ${id}`);
  }

  async validateBotToken(botToken: string): Promise<boolean> {
    try {
      // This would integrate with Telegram Bot API to validate the token
      // For now, we'll do basic validation
      if (!botToken || botToken.length < 40) {
        return false;
      }

      // Format check: should be like "123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
      const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;

      return tokenPattern.test(botToken);
    } catch (err: unknown) {
      this.logger.error(`Bot token validation failed: ${getErrorMessage(err)}`);

      return false;
    }
  }

  async validateSourceAccess(sourceId: string, userId: string): Promise<boolean> {
    const source = await this.trafficSourceRepository.findOne({
      id: sourceId,
      $or: [{ managedBy: userId }, { isActive: true }],
    });

    return source !== null;
  }
}
