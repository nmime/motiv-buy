import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index, Unique } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { PaymentProviderConfigEntity } from './PaymentProviderConfig.entity';
import { CurrencyEntity } from './Currency.entity';

/**
 * Network type for multi-chain assets
 */
export enum NetworkType {
  // Bitcoin networks
  Bitcoin = 'BITCOIN',
  BitcoinCash = 'BITCOIN_CASH',

  // Ethereum and EVM-compatible
  Ethereum = 'ETHEREUM',
  BSC = 'BSC', // Binance Smart Chain
  Polygon = 'POLYGON',

  // Other networks
  Tron = 'TRON', // TRC-20
  TON = 'TON', // Telegram Open Network
  Solana = 'SOLANA',
  Litecoin = 'LITECOIN',
  Dogecoin = 'DOGECOIN',
  Dash = 'DASH',

  // Native (no specific network)
  Native = 'NATIVE',
}

/**
 * Provider Currency Support Entity
 * Many-to-many relationship between payment providers and currencies
 * Stores which providers support which currencies and on which networks
 */
@Entity({ tableName: 'provider_currency_support' })
@Unique({ name: 'ix__provider_currency_support__provider_currency_network', properties: ['provider', 'currency', 'network'] })
@Index({ name: 'ix__provider_currency_support__provider', properties: ['provider'] })
@Index({ name: 'ix__provider_currency_support__currency', properties: ['currency'] })
@Index({ name: 'ix__provider_currency_support__is_enabled', properties: ['isEnabled'] })
@Index({ name: 'ix__provider_currency_support__is_preferred', properties: ['isPreferred'] })
export class ProviderCurrencySupportEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  /**
   * Provider relationship
   */
  @ManyToOne(() => PaymentProviderConfigEntity, { onDelete: 'cascade' })
  provider!: PaymentProviderConfigEntity;

  /**
   * Currency relationship
   */
  @ManyToOne(() => CurrencyEntity, { onDelete: 'cascade' })
  currency!: CurrencyEntity;

  /**
   * Network support for multi-chain assets
   * Example: USDT can be on Ethereum, Tron, BSC, etc.
   */
  @Property({ type: 'varchar', length: 30, fieldName: 'network', default: NetworkType.Native })
  @Enum(() => NetworkType)
  network!: NetworkType;

  /**
   * Enable/disable this specific combination
   */
  @Property({ type: 'boolean', default: true, fieldName: 'is_enabled' })
  isEnabled!: boolean;

  /**
   * Is this the preferred network for this currency on this provider?
   * Example: For Heleket + USDT, prefer Tron (TRC-20) for lowest fees
   */
  @Property({ type: 'boolean', default: false, fieldName: 'is_preferred' })
  isPreferred!: boolean;

  /**
   * Support flags
   */
  @Property({ type: 'boolean', default: true, fieldName: 'supports_deposits' })
  supportsDeposits!: boolean;

  @Property({ type: 'boolean', default: true, fieldName: 'supports_withdrawals' })
  supportsWithdrawals!: boolean;

  /**
   * Fee configuration for this specific currency + network combination
   */
  @Property({ type: 'decimal', precision: 10, scale: 4, fieldName: 'fee_percentage', nullable: true })
  feePercentage!: string | null; // Override provider's base fee

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'fixed_fee', nullable: true })
  fixedFee!: string | null; // Fixed fee in this currency

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'network_fee_estimate', nullable: true })
  networkFeeEstimate!: string | null; // Estimated blockchain network fee

  /**
   * Limits for this specific currency
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'min_deposit_amount', nullable: true })
  minDepositAmount!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'max_deposit_amount', nullable: true })
  maxDepositAmount!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'min_withdrawal_amount', nullable: true })
  minWithdrawalAmount!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'max_withdrawal_amount', nullable: true })
  maxWithdrawalAmount!: string | null;

  /**
   * Performance metrics
   */
  @Property({ type: 'integer', default: 0, fieldName: 'avg_confirmation_time_seconds', nullable: true })
  avgConfirmationTimeSeconds!: number | null; // Average time for transaction confirmation

  @Property({ type: 'integer', default: 95, fieldName: 'reliability_score' })
  reliabilityScore!: number; // 0-100 score for this specific combination

  /**
   * Priority for routing (lower = higher priority)
   * Used when multiple providers support the same currency
   */
  @Property({ type: 'integer', default: 100, fieldName: 'routing_priority' })
  routingPriority!: number;

  /**
   * Additional configuration
   */
  @Property({ type: 'jsonb', fieldName: 'metadata', nullable: true })
  metadata!: Record<string, unknown> | null;

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
  constructor(data?: EntityConstructorData<ProviderCurrencySupportEntity>) {
    if (data) {
      assignEntityData(this, data);
    }
  }
}
