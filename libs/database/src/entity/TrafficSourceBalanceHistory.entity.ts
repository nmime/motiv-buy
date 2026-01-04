import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { CurrencyCode } from './Currency.entity';

export enum SourceTransactionType {
  TaskReward = 'task_reward', // Earned from completed task
  WithdrawToUser = 'withdraw_to_user', // Transfer to user balance
  Adjustment = 'adjustment', // Admin adjustment
  Refund = 'refund', // Refund from cancelled order
}

export enum SourceTransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Traffic Source Balance History Entity
 *
 * Tracks all balance changes for traffic sources.
 * Used for audit trail and reporting.
 */
@Entity({ tableName: 'traffic_source_balance_history' })
@Index({ name: 'ix__traffic_source_balance_history__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_source_balance_history__currency', properties: ['currency'] })
@Index({ name: 'ix__traffic_source_balance_history__type', properties: ['type'] })
@Index({ name: 'ix__traffic_source_balance_history__status', properties: ['status'] })
@Index({ name: 'ix__traffic_source_balance_history__reference_id', properties: ['referenceId'] })
@Index({ name: 'ix__traffic_source_balance_history__created_at', properties: ['createdAt'] })
export class TrafficSourceBalanceHistoryEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @Property({ type: 'varchar', length: 10, fieldName: 'currency' })
  @Enum(() => CurrencyCode)
  currency!: CurrencyCode;

  @Property({ type: 'varchar', length: 30, fieldName: 'type' })
  @Enum(() => SourceTransactionType)
  type!: SourceTransactionType;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'amount' })
  amount!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'balance_before' })
  balanceBefore!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'balance_after' })
  balanceAfter!: string;

  @Property({ type: 'varchar', length: 30, default: SourceTransactionStatus.Pending, fieldName: 'status' })
  @Enum(() => SourceTransactionStatus)
  status!: SourceTransactionStatus;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  /**
   * Reference ID for linking to related entities:
   * - For TaskReward: actionId
   * - For WithdrawToUser: userBalanceHistoryId
   * - For Refund: orderId
   */
  @Property({ type: 'varchar', length: 64, nullable: true, fieldName: 'reference_id' })
  referenceId?: string;

  /**
   * Additional metadata (e.g., order details, user info)
   */
  @Property({ type: 'json', nullable: true, fieldName: 'metadata' })
  metadata?: Record<string, unknown>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficSourceBalanceHistoryEntity,
      'id' | 'createdAt' | 'updatedAt',
      'status',
      'trafficSource'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficSourceId: {
        field: 'trafficSource',
        entityClass: TrafficSourceEntity,
        required: true,
      },
    });
  }
}
