import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { PaymentProviderEntity } from './PaymentProvider.entity';
import { CurrencyEntity } from './Currency.entity';

/**
 * Routing rule type
 */
export enum RoutingRuleType {
  UserPreference = 'user_preference', // User explicitly chose this provider
  CostOptimization = 'cost_optimization', // Route to cheapest provider
  RegionBased = 'region_based', // Route based on user region
  LoadBalancing = 'load_balancing', // Distribute load across providers
  FailoverFallback = 'failover_fallback', // Backup provider if primary fails
  TimeBased = 'time_based', // Route based on time of day
  AmountBased = 'amount_based', // Route based on transaction amount
  Default = 'default', // Default routing rule
}

/**
 * Condition operator for rule evaluation
 */
export enum ConditionOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  GreaterThan = 'greater_than',
  LessThan = 'less_than',
  GreaterThanOrEqual = 'greater_than_or_equal',
  LessThanOrEqual = 'less_than_or_equal',
  In = 'in',
  NotIn = 'not_in',
  Contains = 'contains',
  NotContains = 'not_contains',
}

/**
 * Provider Routing Rule Entity
 * Stores dynamic routing rules for intelligent provider selection
 * Enables complex routing logic without code changes
 */
@Entity({ tableName: 'provider_routings' })
@Index({ name: 'ix__provider_routings__rule_type', properties: ['ruleType'] })
@Index({ name: 'ix__provider_routings__is_enabled', properties: ['isEnabled'] })
@Index({ name: 'ix__provider_routings__priority', properties: ['priority'] })
@Index({ name: 'ix__provider_routings__provider', properties: ['provider'] })
@Index({ name: 'ix__provider_routings__currency', properties: ['currency'] })
export class ProviderRoutingEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  /**
   * Rule identification
   */
  @Property({ type: 'varchar', length: 100, fieldName: 'name' })
  name!: string;

  @Property({ type: 'text', fieldName: 'description', nullable: true })
  description!: string | null;

  @Property({ type: 'varchar', length: 30, fieldName: 'rule_type' })
  @Enum(() => RoutingRuleType)
  ruleType!: RoutingRuleType;

  /**
   * Provider relationship (which provider this rule routes to)
   */
  @ManyToOne(() => PaymentProviderEntity, { nullable: true })
  provider!: PaymentProviderEntity | null;

  /**
   * Currency filter (null = applies to all currencies)
   */
  @ManyToOne(() => CurrencyEntity, { nullable: true })
  currency!: CurrencyEntity | null;

  /**
   * Rule priority (lower number = higher priority)
   * Rules are evaluated in order of priority
   */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority!: number;

  /**
   * Enable/disable rule
   */
  @Property({ type: 'boolean', default: true, fieldName: 'is_enabled' })
  isEnabled!: boolean;

  /**
   * Rule conditions (JSON format)
   * Example:
   * {
   *   "userRegion": { "operator": "IN", "values": ["RU", "BY", "KZ"] },
   *   "amount": { "operator": "GREATER_THAN", "value": "1000" },
   *   "platform": { "operator": "EQUALS", "value": "telegram" }
   * }
   */
  @Property({ type: 'jsonb', fieldName: 'conditions', nullable: true })
  conditions!: Record<string, unknown> | null;

  /**
   * Time-based conditions
   */
  @Property({ type: 'time', fieldName: 'active_from_time', nullable: true })
  activeFromTime!: string | null; // e.g., '09:00:00'

  @Property({ type: 'time', fieldName: 'active_to_time', nullable: true })
  activeToTime!: string | null; // e.g., '18:00:00'

  @Property({ type: 'text[]', fieldName: 'active_days_of_week', nullable: true })
  activeDaysOfWeek!: string[] | null; // e.g., ['MON', 'TUE', 'WED']

  @Property({ type: 'date', fieldName: 'active_from_date', nullable: true })
  activeFromDate!: Date | null;

  @Property({ type: 'date', fieldName: 'active_to_date', nullable: true })
  activeToDate!: Date | null;

  /**
   * Amount-based conditions
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'min_amount_usd', nullable: true })
  minAmountUsd!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'max_amount_usd', nullable: true })
  maxAmountUsd!: string | null;

  /**
   * Geographic conditions
   */
  @Property({ type: 'text[]', fieldName: 'allowed_countries', nullable: true })
  allowedCountries!: string[] | null; // ISO 3166-1 alpha-2 codes

  @Property({ type: 'text[]', fieldName: 'blocked_countries', nullable: true })
  blockedCountries!: string[] | null;

  /**
   * Platform/source conditions
   */
  @Property({ type: 'text[]', fieldName: 'allowed_platforms', nullable: true })
  allowedPlatforms!: string[] | null; // e.g., ['telegram', 'web', 'mobile']

  /**
   * User type conditions
   */
  @Property({ type: 'boolean', fieldName: 'verified_users_only', default: false })
  verifiedUsersOnly!: boolean;

  @Property({ type: 'boolean', fieldName: 'vip_users_only', default: false })
  vipUsersOnly!: boolean;

  /**
   * Fallback configuration
   */
  @Property({ type: 'uuid', fieldName: 'fallback_rule_id', nullable: true })
  fallbackRuleId!: string | null; // Another rule to try if this one fails

  /**
   * Load balancing configuration
   */
  @Property({ type: 'integer', default: 100, fieldName: 'weight' })
  weight!: number; // Weight for load balancing (higher = more traffic)

  /**
   * Metrics tracking
   */
  @Property({ type: 'integer', default: 0, fieldName: 'usage_count' })
  usageCount!: number; // How many times this rule was used

  @Property({ type: 'integer', default: 0, fieldName: 'success_count' })
  successCount!: number; // How many times routing succeeded

  @Property({ type: 'integer', default: 0, fieldName: 'failure_count' })
  failureCount!: number; // How many times routing failed

  @Property({ type: 'timestamptz', fieldName: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

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
  constructor(data?: EntityConstructorData<ProviderRoutingEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    if (data) {
      assignEntityData(this as Record<string, unknown>, data, {});
    }
  }

  /**
   * Calculate success rate
   */
  getSuccessRate(): number {
    if (this.usageCount === 0) {
      return 0;
    }

    return (this.successCount / this.usageCount) * 100;
  }

  /**
   * Check if rule is currently active based on time/date conditions
   */
  isCurrentlyActive(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    const now = new Date();

    // Check date range
    if (this.activeFromDate && now < this.activeFromDate) {
      return false;
    }

    if (this.activeToDate && now > this.activeToDate) {
      return false;
    }

    // Check day of week
    if (this.activeDaysOfWeek && this.activeDaysOfWeek.length > 0) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const currentDay = days[now.getDay()];

      if (!this.activeDaysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    // Check time range
    if (this.activeFromTime && this.activeToTime) {
      const currentTime = now.toTimeString().substring(0, 8);

      if (currentTime < this.activeFromTime || currentTime > this.activeToTime) {
        return false;
      }
    }

    return true;
  }
}
