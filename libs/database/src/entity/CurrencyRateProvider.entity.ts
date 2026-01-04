import { Entity, Enum, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { RateProvider } from './CurrencyRatesHistory.entity';

/**
 * Provider type for categorization
 */
export enum CurrencyRateProviderType {
  Crypto = 'crypto',
  Fiat = 'fiat',
}

/**
 * Currency rate provider configuration entity
 * Stores provider settings, reliability scores, and quota limits
 * Replaces hardcoded provider configurations
 */
@Entity({ tableName: 'currency_rate_providers' })
@Unique({ name: 'uq__currency_rate_providers__name', properties: ['name'] })
export class CurrencyRateProviderEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @Property({ type: 'varchar', length: 50, fieldName: 'name' })
  @Enum(() => RateProvider)
  name!: RateProvider;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => CurrencyRateProviderType)
  type!: CurrencyRateProviderType;

  /**
   * Reliability score (0-100) for weighted averaging
   */
  @Property({ type: 'integer', default: 80, fieldName: 'reliability' })
  reliability!: number;

  /**
   * Whether this provider is enabled
   */
  @Property({ type: 'boolean', default: true, fieldName: 'is_enabled' })
  isEnabled!: boolean;

  /**
   * Maximum requests per minute (null = unlimited)
   */
  @Property({ type: 'integer', nullable: true, fieldName: 'quota_per_minute' })
  quotaPerMinute: number | null = null;

  /**
   * Maximum requests per month (null = unlimited)
   */
  @Property({ type: 'integer', nullable: true, fieldName: 'quota_per_month' })
  quotaPerMonth: number | null = null;

  /**
   * Whether this provider requires authentication (API key)
   */
  @Property({ type: 'boolean', default: false, fieldName: 'requires_auth' })
  requiresAuth!: boolean;

  /**
   * Environment variable name for API key (if requiresAuth is true)
   */
  @Property({ type: 'varchar', length: 100, nullable: true, fieldName: 'api_key_env_var' })
  apiKeyEnvVar: string | null = null;

  /**
   * Base URL for the API (optional override)
   */
  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'base_url' })
  baseUrl: string | null = null;

  /**
   * Priority for provider selection (lower = higher priority)
   */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority!: number;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      CurrencyRateProviderEntity,
      'id' | 'createdAt' | 'updatedAt' | 'reliability' | 'isEnabled' | 'requiresAuth' | 'priority',
      'quotaPerMinute' | 'quotaPerMonth' | 'apiKeyEnvVar' | 'baseUrl'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {});
  }
}
