import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { TrafficOrderEntity } from '../TrafficOrder.entity';
import { TrafficTargetEntity } from '../TrafficTarget.entity';
import { assignEntityData, EntityConstructorData } from '../../type';

export enum TrafficOrderTargetStatus {
  Pending = 'pending',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

@Entity({ tableName: 'traffic_order_targets' })
@Index({ name: 'ix__traffic_order_targets__order_id', properties: ['trafficOrder'] })
@Index({ name: 'ix__traffic_order_targets__target_id', properties: ['trafficTarget'] })
@Index({ name: 'ix__traffic_order_targets__status', properties: ['status'] })
@Unique({ name: 'uq__traffic_order_targets__order_target', properties: ['trafficOrder', 'trafficTarget'] })
export class TrafficOrderTargetEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficOrderEntity', {
    nullable: false,
    joinColumn: 'traffic_order_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficOrder!: Ref<TrafficOrderEntity>;

  @ManyToOne('TrafficTargetEntity', {
    nullable: false,
    joinColumn: 'traffic_target_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficTarget!: Ref<TrafficTargetEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'status', default: TrafficOrderTargetStatus.Pending })
  @Enum(() => TrafficOrderTargetStatus)
  status: TrafficOrderTargetStatus = TrafficOrderTargetStatus.Pending;

  /** Number of actions allocated to this target */
  @Property({ type: 'integer', fieldName: 'allocated_count' })
  allocatedCount!: number;

  /** Number of actions completed for this target */
  @Property({ type: 'integer', default: 0, fieldName: 'completed_count' })
  completedCount = 0;

  /** Budget allocated to this target */
  @Property({ type: 'decimal', precision: 15, scale: 4, fieldName: 'allocated_budget' })
  allocatedBudget!: string;

  /** Amount spent for this target */
  @Property({ type: 'decimal', precision: 15, scale: 4, default: '0', fieldName: 'spent_amount' })
  spentAmount = '0';

  /** Price per action for this specific target (may differ from order default) */
  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true, fieldName: 'price_per_action' })
  pricePerAction?: string;

  /** Priority for this target (lower = higher priority) */
  @Property({ type: 'integer', default: 100, fieldName: 'priority' })
  priority = 100;

  /** Whether this is the primary target for the order */
  @Property({ type: 'boolean', default: false, fieldName: 'is_primary' })
  isPrimary = false;

  /** Target URL for this specific target (override order's targetUrl) */
  @Property({ type: 'text', nullable: true, fieldName: 'target_url' })
  targetUrl?: string;

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
      TrafficOrderTargetEntity,
      'id' | 'createdAt' | 'updatedAt',
      'status' | 'completedCount' | 'spentAmount' | 'priority' | 'isPrimary',
      'trafficOrder' | 'trafficTarget'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficOrderId: {
        field: 'trafficOrder',
        entityClass: TrafficOrderEntity,
        required: true,
      },
      trafficTargetId: {
        field: 'trafficTarget',
        entityClass: TrafficTargetEntity,
        required: true,
      },
    });
  }
}
