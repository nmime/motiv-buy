import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CurrencyRateProviderEntity, CurrencyRateProviderType } from '../entity/CurrencyRateProvider.entity';
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
    const em = this.em.fork();

    return em.find(
      CurrencyRateProviderEntity,
      { isEnabled: true },
      { orderBy: { priority: 'ASC', reliability: 'DESC' } },
    );
  }

  /**
   * Get enabled providers by type
   */
  async findEnabledByType(type: CurrencyRateProviderType): Promise<CurrencyRateProviderEntity[]> {
    const em = this.em.fork();

    return em.find(
      CurrencyRateProviderEntity,
      { isEnabled: true, type },
      { orderBy: { priority: 'ASC', reliability: 'DESC' } },
    );
  }

  /**
   * Get provider config by name
   */
  async findByName(name: RateProvider): Promise<CurrencyRateProviderEntity | null> {
    const em = this.em.fork();

    return em.findOne(CurrencyRateProviderEntity, { name });
  }

  /**
   * Update provider enabled status
   */
  async setEnabled(name: RateProvider, isEnabled: boolean): Promise<CurrencyRateProviderEntity | null> {
    const em = this.em.fork();
    const config = await em.findOne(CurrencyRateProviderEntity, { name });

    if (!config) {
      return null;
    }

    config.isEnabled = isEnabled;
    await em.flush();

    return config;
  }

  /**
   * Update provider reliability score
   */
  async updateReliability(name: RateProvider, reliability: number): Promise<CurrencyRateProviderEntity | null> {
    const em = this.em.fork();
    const config = await em.findOne(CurrencyRateProviderEntity, { name });

    if (!config) {
      return null;
    }

    config.reliability = Math.max(0, Math.min(100, reliability));
    await em.flush();

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
    const em = this.em.fork();
    const existing = await em.findOne(CurrencyRateProviderEntity, { name });

    if (existing) {
      Object.assign(existing, data);
      await em.flush();

      return existing;
    }

    const config = new CurrencyRateProviderEntity({
      name,
      type,
      ...data,
    });

    await em.persistAndFlush(config);

    return config;
  }

  /**
   * Get all provider configs (including disabled)
   */
  async findAll(): Promise<CurrencyRateProviderEntity[]> {
    const em = this.em.fork();

    return em.find(CurrencyRateProviderEntity, {}, { orderBy: { type: 'ASC', priority: 'ASC' } });
  }
}
