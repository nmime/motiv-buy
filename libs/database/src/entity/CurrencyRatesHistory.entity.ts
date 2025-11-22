import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { CurrencyEntity } from './Currency.entity';

/**
 * Rate provider sources for redundancy and accuracy
 * Free tier providers with fallback support
 */
export enum RateProvider {
  // Crypto providers (free tier)
  CoinGecko = 'coingecko', // 50 calls/min, no API key required
  Binance = 'binance', // 2400 calls/min, no API key required
  CryptoCompare = 'cryptocompare', // 100k calls/month free
  CoinCap = 'coincap', // Unlimited free tier
  Kraken = 'kraken', // Public API, unlimited

  // Fiat providers (free tier)
  ExchangeRateApi = 'exchangerate_api', // 1500 calls/month free
  Frankfurter = 'frankfurter', // ECB data, unlimited free
  FreeCurrencyApi = 'freecurrency_api', // 5000 calls/month free

  // Fallback
  CentralBank = 'central_bank',
  Manual = 'manual',
}

/**
 * Currency rates history entity
 * Tracks historical exchange rates from multiple providers
 * Enables rate verification and weighted averages
 */
@Entity({ tableName: 'currency_rates_history' })
@Index({ name: 'ix__currency_rates_history__currency_id', properties: ['currency'] })
@Index({ name: 'ix__currency_rates_history__provider', properties: ['provider'] })
@Index({ name: 'ix__currency_rates_history__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__currency_rates_history__currency_provider', properties: ['currency', 'provider'] })
export class CurrencyRatesHistoryEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('CurrencyEntity', { nullable: false, joinColumn: 'currency_id', referenceColumnName: 'id', ref: true })
  currency!: Ref<CurrencyEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'provider' })
  @Enum(() => RateProvider)
  provider!: RateProvider;

  /**
   * Exchange rate to USD at this point in time
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'rate_to_usd' })
  rateToUsd!: string;

  /**
   * Reliability score (0-100) based on provider trust and data quality
   */
  @Property({ type: 'integer', default: 100, fieldName: 'reliability_score' })
  reliabilityScore!: number;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  constructor(
    data: EntityConstructorData<CurrencyRatesHistoryEntity, 'id' | 'createdAt' | 'reliabilityScore', never, 'currency'>,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      currencyId: {
        field: 'currency',
        entityClass: CurrencyEntity,
        required: true,
      },
    });
  }
}
