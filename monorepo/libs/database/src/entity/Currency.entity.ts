import { Entity, PrimaryKey, Property, Enum, Index, Unique, OneToMany, Collection } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { CurrencyRatesHistoryEntity } from './CurrencyRatesHistory.entity';

/**
 * Currency type classification
 */
export enum CurrencyType {
  Fiat = 'FIAT',
  Crypto = 'CRYPTO',
}

/**
 * Currency codes for supported fiat and cryptocurrencies
 */
export enum CurrencyCode {
  // Fiat currencies
  Usd = 'USD',
  Eur = 'EUR',
  Rub = 'RUB',

  // Cryptocurrencies (most commonly used)
  Usdt = 'USDT',
  Ton = 'TON',
  Btc = 'BTC',
  Eth = 'ETH',
  Bnb = 'BNB',
  Trx = 'TRX',
  Usdc = 'USDC',
}

/**
 * Currency entity
 * Stores currency information with current exchange rate to USD
 * All rates are based on USD as the base currency
 */
@Entity({ tableName: 'currencies' })
@Unique({ name: 'ix__currencies__code', properties: ['code'] })
@Index({ name: 'ix__currencies__type', properties: ['type'] })
@Index({ name: 'ix__currencies__is_active', properties: ['isActive'] })
export class CurrencyEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 10, fieldName: 'code', unique: true })
  @Enum(() => CurrencyCode)
  code!: CurrencyCode;

  @Property({ type: 'varchar', length: 50, fieldName: 'name' })
  name!: string;

  @Property({ type: 'varchar', length: 10, fieldName: 'symbol', nullable: true })
  symbol!: string | null;

  @Property({ type: 'varchar', length: 10, fieldName: 'type' })
  @Enum(() => CurrencyType)
  type!: CurrencyType;

  /**
   * Current exchange rate to USD
   * Example: 1 BTC = 45000 USD means rateToUsd = 45000
   * Example: 1 RUB = 0.011 USD means rateToUsd = 0.011
   * For USD itself, rateToUsd = 1.0
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'rate_to_usd' })
  rateToUsd!: string;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'integer', default: 2, fieldName: 'decimal_places' })
  decimalPlaces!: number;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'rate_updated_at' })
  rateUpdatedAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @OneToMany(() => CurrencyRatesHistoryEntity, (rh) => rh.currency)
  ratesHistory = new Collection<CurrencyRatesHistoryEntity>(this);

  constructor(
    data: EntityConstructorData<
      CurrencyEntity,
      'id' | 'createdAt' | 'updatedAt' | 'rateUpdatedAt' | 'isActive' | 'decimalPlaces' | 'symbol' | 'ratesHistory',
      never,
      never
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {});
  }
}
