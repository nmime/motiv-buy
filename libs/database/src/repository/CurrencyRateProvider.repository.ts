import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CurrencyRateProviderType, CurrencyRateProviderEntity } from '../entity/CurrencyRateProvider.entity';
import { RateProvider } from '../entity/CurrencyRatesHistory.entity';

/**
 * Repository for currency rate provider configuration operations
 */
@Injectable()
export class CurrencyRateProviderRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get all enabled provider configs
   */
  async findAllEnabled(): Promise<CurrencyRateProviderEntity[]> {
    return this.em.find(
      CurrencyRateProviderEntity,
      { isEnabled: true },
      { orderBy: { priority: 'ASC', reliability: 'DESC' } },
    );
  }

  /**
   * Get enabled providers by type
   */
  async findEnabledByType(type: CurrencyRateProviderType): Promise<CurrencyRateProviderEntity[]> {
    return this.em.find(
      CurrencyRateProviderEntity,
      { isEnabled: true, type },
      { orderBy: { priority: 'ASC', reliability: 'DESC' } },
    );
  }

  /**
   * Get provider config by name
   */
  async findByName(name: RateProvider): Promise<CurrencyRateProviderEntity | null> {
    return this.em.findOne(CurrencyRateProviderEntity, { name });
  }

  /**
   * Update provider enabled status
   */
  async setEnabled(name: RateProvider, isEnabled: boolean): Promise<CurrencyRateProviderEntity | null> {
    const config = await this.findByName(name);

    if (!config) {
      return null;
    }

    config.isEnabled = isEnabled;
    await this.em.flush();

    return config;
  }

  /**
   * Update provider reliability score
   */
  async updateReliability(name: RateProvider, reliability: number): Promise<CurrencyRateProviderEntity | null> {
    const config = await this.findByName(name);

    if (!config) {
      return null;
    }

    config.reliability = Math.max(0, Math.min(100, reliability));
    await this.em.flush();

    return config;
  }

  /**
   * Create or update provider config
   */
  async upsert(
    name: RateProvider,
    type: CurrencyRateProviderType,
    data: Partial<
      Pick<
        CurrencyRateProviderEntity,
        'reliability' | 'isEnabled' | 'quotaPerMinute' | 'quotaPerMonth' | 'requiresAuth' | 'apiKeyEnvVar' | 'priority'
      >
    >,
  ): Promise<CurrencyRateProviderEntity> {
    const existing = await this.findByName(name);

    if (existing) {
      Object.assign(existing, data);
      await this.em.flush();

      return existing;
    }

    const config = new CurrencyRateProviderEntity({
      name,
      type,
      ...data,
    });

    await this.em.persistAndFlush(config);

    return config;
  }

  /**
   * Get all provider configs (including disabled)
   */
  async findAll(): Promise<CurrencyRateProviderEntity[]> {
    return this.em.find(CurrencyRateProviderEntity, {}, { orderBy: { type: 'ASC', priority: 'ASC' } });
  }
}
