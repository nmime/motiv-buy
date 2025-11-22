import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { TrafficTargetEntity } from '../TrafficTarget.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { assignEntityData, EntityConstructorData, TrafficTargetSourceContract } from '../../type';

@Entity({ tableName: 'traffic_target_sources' })
@Index({ name: 'ix__traffic_target_sources__target_id', properties: ['trafficTarget'] })
@Index({ name: 'ix__traffic_target_sources__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_target_sources__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__traffic_target_sources__target_source', properties: ['trafficTarget', 'trafficSource'] })
export class TrafficTargetSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficTargetEntity', {
    nullable: false,
    joinColumn: 'traffic_target_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficTarget!: Ref<TrafficTargetEntity>;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'contract_terms' })
  contractTerms?: TrafficTargetSourceContract;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true, fieldName: 'price_per_action' })
  pricePerAction?: string;

  @Property({ type: 'integer', nullable: true, fieldName: 'minimum_order' })
  minimumOrder?: number;

  @Property({ type: 'integer', nullable: true, fieldName: 'maximum_order' })
  maximumOrder?: number;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'agreement_start_date' })
  agreementStartDate?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'agreement_end_date' })
  agreementEndDate?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_order_date' })
  lastOrderDate?: Date;

  @Property({ type: 'integer', default: 0, fieldName: 'total_orders_completed' })
  totalOrdersCompleted = 0;

  @Property({ type: 'decimal', precision: 15, scale: 4, default: '0', fieldName: 'total_amount_spent' })
  totalAmountSpent = '0';

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficTargetSourceEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isActive' | 'totalOrdersCompleted' | 'totalAmountSpent',
      'trafficTarget' | 'trafficSource'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficTargetId: {
        field: 'trafficTarget',

        entityClass: TrafficTargetEntity,
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
