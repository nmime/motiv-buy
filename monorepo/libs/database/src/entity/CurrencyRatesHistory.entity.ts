import { Entity, PrimaryKey, Property, ManyToOne, Index, Ref, Enum } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { CurrencyEntity } from './Currency.entity';

/**
 * Rate provider sources for redundancy and accuracy
 * Free tier providers with fallback support
 */
export enum RateProvider {
  // Crypto providers (free tier)
  CoinGecko = 'COINGECKO', // 50 calls/min, no API key required
  Binance = 'BINANCE', // 2400 calls/min, no API key required
  CryptoCompare = 'CRYPTOCOMPARE', // 100k calls/month free
  CoinCap = 'COINCAP', // Unlimited free tier
  Kraken = 'KRAKEN', // Public API, unlimited

  // Fiat providers (free tier)
  ExchangeRateApi = 'EXCHANGERATE_API', // 1500 calls/month free
  Frankfurter = 'FRANKFURTER', // ECB data, unlimited free
  FreeCurrencyApi = 'FREECURRENCY_API', // 5000 calls/month free

  // Fallback
  CentralBank = 'CENTRAL_BANK',
  Manual = 'MANUAL',
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
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
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
