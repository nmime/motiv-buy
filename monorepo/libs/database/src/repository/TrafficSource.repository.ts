import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficSourceEntity, TrafficSourceType } from '../entity';

export class TrafficSourceRepository extends EntityRepository<TrafficSourceEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficSourceEntity);
  }

  async findByTelegramId(telegramId: string): Promise<TrafficSourceEntity | null> {
    return this.findOne({ telegramId });
  }

  async findByBotToken(botToken: string): Promise<TrafficSourceEntity | null> {
    return this.findOne({ botToken });
  }

  async findByBotUsername(botUsername: string): Promise<TrafficSourceEntity | null> {
    return this.findOne({ botUsername });
  }

  async findActiveByType(type: TrafficSourceType): Promise<TrafficSourceEntity[]> {
    return this.find({ type, isActive: true });
  }

  async findActiveSources(): Promise<TrafficSourceEntity[]> {
    return this.find({ isActive: true });
  }

  async createTrafficSource(data: {
    name: string;
    description?: string;
    type: TrafficSourceType;
    botToken?: string;
    botUsername?: string;
    telegramId?: string;
    config?: string;
  }): Promise<TrafficSourceEntity> {
    const trafficSource = new TrafficSourceEntity({
      ...data,
      isActive: true
    });
    await this.em.persistAndFlush(trafficSource);
    return trafficSource;
  }

  async updateConfig(id: number, config: string): Promise<void> {
    const source = await this.findOne({ id });
    if (source) {
      source.config = config;
      await this.em.flush();
    }
  }

  async deactivateSource(id: number): Promise<void> {
    const source = await this.findOne({ id });
    if (source) {
      source.isActive = false;
      await this.em.flush();
    }
  }

  async activateSource(id: number): Promise<void> {
    const source = await this.findOne({ id });
    if (source) {
      source.isActive = true;
      await this.em.flush();
    }
  }

  async getSourceStats(): Promise<{
    total: number;
    active: number;
    bots: number;
    botsWithToken: number;
  }> {
    const [total, active, bots, botsWithToken] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.count({ type: TrafficSourceType.Bot }),
      this.count({ type: TrafficSourceType.BotWithToken })
    ]);

    return { total, active, bots, botsWithToken };
  }
}
