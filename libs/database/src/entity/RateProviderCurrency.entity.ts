import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Ref } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { CurrencyRateProviderEntity } from './CurrencyRateProvider.entity';
import { CurrencyEntity } from './Currency.entity';

/**
 * Rate Provider Currency Mapping Entity
 * Stores which currencies each rate provider supports and the provider-specific symbols
 *
 * Examples:
 * - Binance: BTC -> BTCUSDT, ETH -> ETHUSDT
 * - Kraken: BTC -> XXBTZUSD, ETH -> XETHZUSD
 * - CoinGecko: BTC -> bitcoin, ETH -> ethereum
 */
@Entity({ tableName: 'rate_provider_currencies' })
@Unique({
  name: 'uq__rate_provider_currencies__provider_currency',
  properties: ['provider', 'currency'],
})
@Index({ name: 'ix__rate_provider_currencies__provider', properties: ['provider'] })
@Index({ name: 'ix__rate_provider_currencies__currency', properties: ['currency'] })
@Index({ name: 'ix__rate_provider_currencies__is_enabled', properties: ['isEnabled'] })
export class RateProviderCurrencyEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  /**
   * Rate provider relationship
   */
  @ManyToOne('CurrencyRateProviderEntity', {
    nullable: false,
    joinColumn: 'provider_id',
    referenceColumnName: 'id',
    ref: true,
  })
  provider!: Ref<CurrencyRateProviderEntity>;

  /**
   * Currency relationship
   */
  @ManyToOne('CurrencyEntity', {
    nullable: false,
    joinColumn: 'currency_id',
    referenceColumnName: 'id',
    ref: true,
  })
  currency!: Ref<CurrencyEntity>;

  /**
   * Provider-specific symbol/identifier for this currency
   * Examples:
   * - Binance: "BTCUSDT", "ETHUSDT"
   * - Kraken: "XXBTZUSD", "XETHZUSD"
   * - CoinGecko: "bitcoin", "ethereum"
   * - Frankfurter: "EUR", "RUB"
   */
  @Property({ type: 'varchar', length: 50, fieldName: 'provider_symbol' })
  providerSymbol!: string;

  /**
   * Whether this currency mapping is enabled
   */
  @Property({ type: 'boolean', default: true, fieldName: 'is_enabled' })
  isEnabled!: boolean;

  /**
   * Priority for this specific currency on this provider (lower = higher priority)
   */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority!: number;

  /**
   * Timestamps
   */
  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt!: Date;

  @Property({ type: 'timestamptz', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt!: Date;

  /**
   * Constructor with optional initialization data
   */
  constructor(
    data?: EntityConstructorData<
      RateProviderCurrencyEntity,
      'id' | 'createdAt' | 'updatedAt' | 'isEnabled' | 'priority',
      never,
      'provider' | 'currency'
    >,
  ) {
    if (data) {
      assignEntityData(this, data, {
        providerId: {
          field: 'provider',
          entityClass: CurrencyRateProviderEntity,
          required: true,
        },
        currencyId: {
          field: 'currency',
          entityClass: CurrencyEntity,
          required: true,
        },
      });
    }
  }
}
