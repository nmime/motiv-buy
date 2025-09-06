import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Ref } from '@mikro-orm/core';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { EntityConstructorData, TrafficBuyerSourceContract, assignEntityData } from '../../type';

@Entity({ tableName: 'traffic_buyer_sources' })
@Index({ name: 'ix__traffic_buyer_sources__buyer_id', properties: ['trafficBuyer'] })
@Index({ name: 'ix__traffic_buyer_sources__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_buyer_sources__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__traffic_buyer_sources__buyer_source', properties: ['trafficBuyer', 'trafficSource'] })
export class TrafficBuyerSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('TrafficBuyerEntity', {
    nullable: false,
    joinColumn: 'traffic_buyer_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficBuyer!: Ref<TrafficBuyerEntity>;

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
  contractTerms?: TrafficBuyerSourceContract;

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
      TrafficBuyerSourceEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isActive' | 'totalOrdersCompleted' | 'totalAmountSpent',
      'trafficBuyer' | 'trafficSource'
    >,
  ) {
    assignEntityData(this, data, {
      trafficBuyerId: { field: 'trafficBuyer', entityClass: TrafficBuyerEntity, required: true },
      trafficSourceId: { field: 'trafficSource', entityClass: TrafficSourceEntity, required: true },
    });
  }
}
