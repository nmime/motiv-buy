import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficSourceEntity, TrafficSourceType } from '../entity';
import { TrafficSourceConfig } from '../type';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

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
    config?: TrafficSourceConfig;
  }): Promise<TrafficSourceEntity> {
    const trafficSource = new TrafficSourceEntity({
      ...data,
      isActive: true,
    });

    await this.em.persistAndFlush(trafficSource);

    return trafficSource;
  }

  async updateConfig(id: string, config: TrafficSourceConfig): Promise<void> {
    const source = await this.findOne({ id });
    if (source) {
      source.config = config;
      await this.em.flush();
    }
  }

  async deactivateSource(id: string): Promise<void> {
    const source = await this.findOne({ id });
    if (source) {
      source.isActive = false;
      await this.em.flush();
    }
  }

  async activateSource(id: string): Promise<void> {
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
      this.count({ type: TrafficSourceType.BotWithToken }),
    ]);

    return { total, active, bots, botsWithToken };
  }

  /**
   * Generate a secure random API key
   * Format: 32 bytes (64 hex characters)
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash and store API key for a traffic source
   * Uses bcrypt with salt rounds = 10
   */
  async setApiKey(sourceId: string, apiKey: string): Promise<void> {
    const source = await this.findOne({ id: sourceId });
    if (!source) {
      throw new Error(`Traffic source with id ${sourceId} not found`);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedKey = await bcrypt.hash(apiKey, salt);

    source.apiKeyHash = hashedKey;
    await this.em.flush();
  }

  /**
   * Validate an API key against stored hash
   */
  async validateApiKey(sourceId: string, apiKey: string): Promise<boolean> {
    const source = await this.findOne({ id: sourceId });
    if (!source || !source.apiKeyHash) {
      return false;
    }

    return bcrypt.compare(apiKey, source.apiKeyHash);
  }

  /**
   * Find traffic source by validating API key
   * Returns source if API key is valid, null otherwise
   */
  async findByApiKey(apiKey: string): Promise<TrafficSourceEntity | null> {
    // Get all sources with API key hash
    const sources = await this.find({ apiKeyHash: { $ne: null } });

    // Validate API key against each hash
    for (const source of sources) {
      if (source.apiKeyHash && (await bcrypt.compare(apiKey, source.apiKeyHash))) {
        return source;
      }
    }

    return null;
  }

  /**
   * Generate and set a new API key for a traffic source
   * Returns the plain text API key (only time it's available)
   */
  async regenerateApiKey(sourceId: string): Promise<string> {
    const apiKey = this.generateApiKey();
    await this.setApiKey(sourceId, apiKey);
    return apiKey;
  }
}
