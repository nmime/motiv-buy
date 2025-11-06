import { Entity, PrimaryKey, Property, Enum, Index, Unique, OneToMany, Collection } from '@mikro-orm/core';
import { PaymentProvider } from '../enum';
import { EntityConstructorData, assignEntityData } from '../type';
import { ProviderCurrencyEntity } from './ProviderCurrency.entity';
import { ProviderRoutingEntity } from './ProviderRouting.entity';

/**
 * Provider status for enabling/disabling providers dynamically
 */
export enum ProviderStatus {
  Active = 'active',
  Inactive = 'inactive',
  Maintenance = 'maintenance',
}

/**
 * Provider type classification
 */
export enum ProviderType {
  CryptoNative = 'crypto_native', // Direct cryptocurrency payments
  FiatGateway = 'fiat_gateway', // Fiat currency gateway with conversion
  Hybrid = 'hybrid', // Supports both
}

/**
 * Update strategy for payment status
 */
export enum UpdateStrategy {
  Webhook = 'webhook',
  Polling = 'polling',
  Hybrid = 'hybrid',
}

/**
 * Payment Provider Configuration Entity
 * Stores dynamic configuration for all payment providers
 * Eliminates hardcoded provider logic and enables runtime configuration
 */
@Entity({ tableName: 'payment_providers' })
@Unique({ name: 'ix__payment_providers__provider', properties: ['provider'] })
@Index({ name: 'ix__payment_providers__status', properties: ['status'] })
@Index({ name: 'ix__payment_providers__is_enabled', properties: ['isEnabled'] })
@Index({ name: 'ix__payment_providers__priority', properties: ['priority'] })
export class PaymentProviderEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 50, fieldName: 'provider', unique: true })
  @Enum(() => PaymentProvider)
  provider!: PaymentProvider;

  @Property({ type: 'varchar', length: 100, fieldName: 'display_name' })
  displayName!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'provider_type' })
  @Enum(() => ProviderType)
  providerType!: ProviderType;

  @Property({ type: 'varchar', length: 20, fieldName: 'status', default: ProviderStatus.Active })
  @Enum(() => ProviderStatus)
  status!: ProviderStatus;

  @Property({ type: 'boolean', default: true, fieldName: 'is_enabled' })
  isEnabled!: boolean;

  @Property({ type: 'boolean', default: true, fieldName: 'supports_deposits' })
  supportsDeposits!: boolean;

  @Property({ type: 'boolean', default: true, fieldName: 'supports_withdrawals' })
  supportsWithdrawals!: boolean;

  @Property({ type: 'boolean', default: true, fieldName: 'supports_balance_check' })
  supportsBalanceCheck!: boolean;

  /**
   * Provider priority for routing (lower number = higher priority)
   * Used when multiple providers support the same currency
   */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority!: number;

  /**
   * Provider reliability score (0-100)
   * Used for weighted routing decisions
   */
  @Property({ type: 'integer', default: 95, fieldName: 'reliability_score' })
  reliabilityScore!: number;

  /**
   * Update strategy for payment status updates
   */
  @Property({ type: 'varchar', length: 20, fieldName: 'update_strategy', default: UpdateStrategy.Hybrid })
  @Enum(() => UpdateStrategy)
  updateStrategy!: UpdateStrategy;

  /**
   * Webhook configuration
   */
  @Property({ type: 'boolean', default: true, fieldName: 'webhook_enabled' })
  webhookEnabled!: boolean;

  @Property({ type: 'varchar', length: 20, fieldName: 'webhook_verification_method', nullable: true })
  webhookVerificationMethod!: string | null; // 'HMAC-SHA256', 'IP_WHITELIST', etc.

  /**
   * Polling configuration
   */
  @Property({ type: 'boolean', default: true, fieldName: 'polling_enabled' })
  pollingEnabled!: boolean;

  @Property({ type: 'integer', default: 30000, fieldName: 'polling_interval_ms' })
  pollingIntervalMs!: number;

  /**
   * API configuration
   */
  @Property({ type: 'varchar', length: 255, fieldName: 'api_url', nullable: true })
  apiUrl!: string | null;

  @Property({ type: 'integer', default: 10000, fieldName: 'api_timeout_ms' })
  apiTimeoutMs!: number;

  @Property({ type: 'integer', default: 3, fieldName: 'max_retries' })
  maxRetries!: number;

  /**
   * Cost configuration (for routing optimization)
   */
  @Property({ type: 'decimal', precision: 10, scale: 4, fieldName: 'base_fee_percentage', default: '0.0000' })
  baseFeePercentage!: string; // e.g., '0.0050' = 0.5%

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'fixed_fee_usd', default: '0.00000000' })
  fixedFeeUsd!: string; // Fixed fee in USD

  /**
   * Feature flags
   */
  @Property({ type: 'boolean', default: false, fieldName: 'supports_telegram_integration' })
  supportsTelegramIntegration!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'supports_network_routing' })
  supportsNetworkRouting!: boolean; // Multi-chain optimization (like Heleket)

  @Property({ type: 'boolean', default: false, fieldName: 'supports_fiat_conversion' })
  supportsFiatConversion!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'supports_bank_cards' })
  supportsBankCards!: boolean;

  /**
   * Limits
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'min_deposit_usd', nullable: true })
  minDepositUsd!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'max_deposit_usd', nullable: true })
  maxDepositUsd!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'min_withdrawal_usd', nullable: true })
  minWithdrawalUsd!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'max_withdrawal_usd', nullable: true })
  maxWithdrawalUsd!: string | null;

  /**
   * Metadata for additional configuration
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
   * Relationships
   */
  @OneToMany(() => ProviderCurrencyEntity, (support) => support.provider)
  currencySupport!: Collection<ProviderCurrencyEntity>;

  @OneToMany(() => ProviderRoutingEntity, (rule) => rule.provider)
  routingRules!: Collection<ProviderRoutingEntity>;

  /**
   * Constructor with optional initialization data
   */
  constructor(data?: EntityConstructorData<PaymentProviderEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    if (data) {
      assignEntityData(this as Record<string, unknown>, data, {});
    }
  }
}
