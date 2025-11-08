import { Injectable } from '@nestjs/common';
import { EntityManager, ref } from '@mikro-orm/core';
import { CurrencyRatesHistoryEntity, RateProvider } from '../entity/CurrencyRatesHistory.entity';
import { CurrencyCode, CurrencyEntity } from '../entity/Currency.entity';
import { toDbString, weightedAverage } from '@app/common-shared';

/**
 * Repository for currency rates history operations
 */
@Injectable()
export class CurrencyRatesHistoryRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Create rate history entry
   */
  async createEntry(
    currencyId: string,
    provider: RateProvider,
    rateToUsd: string,
    reliabilityScore = 100,
  ): Promise<CurrencyRatesHistoryEntity> {
    const currencyRef = this.em.getReference(CurrencyEntity, currencyId);
    const entry = new CurrencyRatesHistoryEntity({
      currency: ref(currencyRef),
      provider,
      rateToUsd,
    });

    if (reliabilityScore !== 100) {
      entry.reliabilityScore = reliabilityScore;
    }

    await this.em.persistAndFlush(entry);

    return entry;
  }

  /**
   * Get latest rates for a currency from all providers
   */
  async getLatestRatesByProvider(currencyCode: CurrencyCode): Promise<CurrencyRatesHistoryEntity[]> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });

    if (!currency) {
      return [];
    }

    // Get most recent entry from each provider (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const rates = await this.em.find(
      CurrencyRatesHistoryEntity,
      {
        currency: currency.id,
        createdAt: { $gte: oneHourAgo },
      },
      {
        orderBy: { createdAt: 'DESC' },
      },
    );

    // Get one rate per provider (most recent)
    const ratesByProvider = new Map<RateProvider, CurrencyRatesHistoryEntity>();

    for (const rate of rates) {
      if (!ratesByProvider.has(rate.provider)) {
        ratesByProvider.set(rate.provider, rate);
      }
    }

    return Array.from(ratesByProvider.values());
  }

  /**
   * Calculate weighted average rate from multiple providers
   */
  async getWeightedAverageRate(currencyCode: CurrencyCode): Promise<string | null> {
    const rates = await this.getLatestRatesByProvider(currencyCode);

    if (rates.length === 0) {
      return null;
    }

    // Calculate weighted average using reliability scores with exact decimal arithmetic
    const weightedValues = rates.map((rate) => [rate.rateToUsd, rate.reliabilityScore] as [string, number]);

    if (weightedValues.length === 0) {
      return null;
    }

    const averageRate = weightedAverage(weightedValues);

    return toDbString(averageRate, 8);
  }

  /**
   * Get rate history for a currency within time range
   */
  async getHistoryByTimeRange(
    currencyCode: CurrencyCode,
    from: Date,
    to: Date,
    provider?: RateProvider,
  ): Promise<CurrencyRatesHistoryEntity[]> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });

    if (!currency) {
      return [];
    }

    const filters: Record<string, unknown> = {
      currency: currency.id,
      createdAt: { $gte: from, $lte: to },
    };

    if (provider) {
      filters['provider'] = provider;
    }

    return this.em.find(CurrencyRatesHistoryEntity, filters, {
      orderBy: { createdAt: 'DESC' },
    });
  }

  /**
   * Cleanup old rate history (older than specified days)
   */
  async cleanupOldRates(daysToKeep = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.em.nativeDelete(CurrencyRatesHistoryEntity, {
      createdAt: { $lt: cutoffDate },
    });

    return result;
  }

  /**
   * Get most recent rate from a specific provider
   */
  async getLatestByProvider(
    currencyCode: CurrencyCode,
    provider: RateProvider,
  ): Promise<CurrencyRatesHistoryEntity | null> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });

    if (!currency) {
      return null;
    }

    return this.em.findOne(
      CurrencyRatesHistoryEntity,
      {
        currency: currency.id,
        provider,
      },
      {
        orderBy: { createdAt: 'DESC' },
      },
    );
  }
}
