import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CurrencyCode, CurrencyEntity, CurrencyType } from '../entity/Currency.entity';
import { convertCurrency, decimal, toNumber } from '@app/common-shared';

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
    const em = this.em.fork();

    return em.findOne(CurrencyEntity, { code, isActive: true });
  }

  /**
   * Get all active currencies
   */
  async findAllActive(): Promise<CurrencyEntity[]> {
    const em = this.em.fork();

    return em.find(CurrencyEntity, { isActive: true }, { orderBy: { code: 'ASC' } });
  }

  /**
   * Get currencies by type (Fiat or Crypto)
   */
  async findByType(type: CurrencyType): Promise<CurrencyEntity[]> {
    const em = this.em.fork();

    return em.find(CurrencyEntity, { type, isActive: true }, { orderBy: { code: 'ASC' } });
  }

  /**
   * Update currency rate
   */
  async updateRate(code: CurrencyCode, rateToUsd: string): Promise<CurrencyEntity | null> {
    const em = this.em.fork();
    const currency = await em.findOne(CurrencyEntity, { code, isActive: true });

    if (!currency) {
      return null;
    }

    currency.rateToUsd = rateToUsd;
    currency.rateUpdatedAt = new Date();

    await em.flush();

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
    const em = this.em.fork();
    const existing = await em.findOne(CurrencyEntity, { code });

    if (existing) {
      existing.name = name;
      existing.type = type;
      existing.rateToUsd = rateToUsd;
      existing.symbol = symbol || null;
      existing.rateUpdatedAt = new Date();
      await em.flush();

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

    await em.persistAndFlush(currency);

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
      rateToUsd: toNumber(decimal(currency.rateToUsd)),
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

    // Convert from -> USD -> to using exact decimal arithmetic
    const converted = convertCurrency(amount, fromCurrency.rateToUsd, toCurrency.rateToUsd);

    return toNumber(converted);
  }
}
