import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { TrafficOrderEntity } from '../TrafficOrder.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { assignEntityData, EntityConstructorData } from '../../type';

export enum TrafficOrderSourceStatus {
  Pending = 'pending',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

@Entity({ tableName: 'traffic_order_sources' })
@Index({ name: 'ix__traffic_order_sources__order_id', properties: ['trafficOrder'] })
@Index({ name: 'ix__traffic_order_sources__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_order_sources__status', properties: ['status'] })
@Unique({ name: 'uq__traffic_order_sources__order_source', properties: ['trafficOrder', 'trafficSource'] })
export class TrafficOrderSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficOrderEntity', {
    nullable: false,
    joinColumn: 'traffic_order_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficOrder!: Ref<TrafficOrderEntity>;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'status', default: TrafficOrderSourceStatus.Pending })
  @Enum(() => TrafficOrderSourceStatus)
  status: TrafficOrderSourceStatus = TrafficOrderSourceStatus.Pending;

  /** Number of actions allocated to this source */
  @Property({ type: 'integer', fieldName: 'allocated_count' })
  allocatedCount!: number;

  /** Number of actions completed by this source */
  @Property({ type: 'integer', default: 0, fieldName: 'completed_count' })
  completedCount = 0;

  /** Budget allocated to this source */
  @Property({ type: 'decimal', precision: 15, scale: 4, fieldName: 'allocated_budget' })
  allocatedBudget!: string;

  /** Amount spent by this source */
  @Property({ type: 'decimal', precision: 15, scale: 4, default: '0', fieldName: 'spent_amount' })
  spentAmount = '0';

  /** Price per action for this specific source (may differ from order default) */
  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true, fieldName: 'price_per_action' })
  pricePerAction?: string;

  /** Priority for this source (lower = higher priority) */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority = 100;

  /** Whether this source is the primary source for the order */
  @Property({ type: 'boolean', default: false, fieldName: 'is_primary' })
  isPrimary = false;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'started_at' })
  startedAt?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'text', nullable: true, fieldName: 'notes' })
  notes?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficOrderSourceEntity,
      'id' | 'createdAt' | 'updatedAt',
      'status' | 'completedCount' | 'spentAmount' | 'priority' | 'isPrimary',
      'trafficOrder' | 'trafficSource'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficOrderId: {
        field: 'trafficOrder',
        entityClass: TrafficOrderEntity,
        required: true,
      },
      trafficSourceId: {
        field: 'trafficSource',
        entityClass: TrafficSourceEntity,
        required: true,
      },
    });
  }
}
