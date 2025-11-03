import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CurrencyEntity, CurrencyCode, CurrencyType } from '../entity/Currency.entity';

/**
 * Repository for currency operations
 */
@Injectable()
export class CurrencyRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Find currency by code
   */
  async findByCode(code: CurrencyCode): Promise<CurrencyEntity | null> {
    return this.em.findOne(CurrencyEntity, { code, isActive: true });
  }

  /**
   * Get all active currencies
   */
  async findAllActive(): Promise<CurrencyEntity[]> {
    return this.em.find(CurrencyEntity, { isActive: true }, { orderBy: { code: 'ASC' } });
  }

  /**
   * Get currencies by type (Fiat or Crypto)
   */
  async findByType(type: CurrencyType): Promise<CurrencyEntity[]> {
    return this.em.find(CurrencyEntity, { type, isActive: true }, { orderBy: { code: 'ASC' } });
  }

  /**
   * Update currency rate
   */
  async updateRate(code: CurrencyCode, rateToUsd: string): Promise<CurrencyEntity | null> {
    const currency = await this.findByCode(code);

    if (!currency) {
      return null;
    }

    currency.rateToUsd = rateToUsd;
    currency.rateUpdatedAt = new Date();

    await this.em.flush();

    return currency;
  }

  /**
   * Create or update currency
   */
  async upsert(
    code: CurrencyCode,
    name: string,
    type: CurrencyType,
    rateToUsd: string,
    symbol?: string,
  ): Promise<CurrencyEntity> {
    const existing = await this.em.findOne(CurrencyEntity, { code });

    if (existing) {
      existing.name = name;
      existing.type = type;
      existing.rateToUsd = rateToUsd;
      existing.symbol = symbol || null;
      existing.rateUpdatedAt = new Date();
      await this.em.flush();

      return existing;
    }

    const currency = new CurrencyEntity({
      code,
      name,
      type,
      rateToUsd,
    });

    if (symbol) {
      currency.symbol = symbol;
    }

    await this.em.persistAndFlush(currency);

    return currency;
  }

  /**
   * Get currency with exchange rate
   */
  async getCurrencyWithRate(code: CurrencyCode): Promise<{ currency: CurrencyEntity; rateToUsd: number } | null> {
    const currency = await this.findByCode(code);

    if (!currency) {
      return null;
    }

    return {
      currency,
      rateToUsd: parseFloat(currency.rateToUsd),
    };
  }

  /**
   * Convert amount between currencies
   */
  async convertAmount(fromCode: CurrencyCode, toCode: CurrencyCode, amount: number): Promise<number | null> {
    const [fromCurrency, toCurrency] = await Promise.all([this.findByCode(fromCode), this.findByCode(toCode)]);

    if (!fromCurrency || !toCurrency) {
      return null;
    }

    // Convert from -> USD -> to
    const amountInUsd = amount * parseFloat(fromCurrency.rateToUsd);
    const amountInTarget = amountInUsd / parseFloat(toCurrency.rateToUsd);

    return amountInTarget;
  }
}
