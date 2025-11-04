import { Collection, Entity, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData, TrafficOrderRequirements } from '../type';
import { UserEntity } from './User.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { TrafficTargetEntity } from './TrafficTarget.entity';
import { TrafficUserEntity } from './TrafficUser.entity';
import type { TrafficActionsEntity } from './TrafficActions.entity';

export enum TrafficOrderStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  InProgress = 'in_progress',
}

export enum TrafficOrderType {
  Join = 'join',
  Leave = 'leave',
  View = 'view',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  React = 'react',
  Comment = 'comment',
}

@Entity({ tableName: 'traffic_orders' })
@Index({ name: 'ix__traffic_orders__order_id', properties: ['orderId'] })
@Index({ name: 'ix__traffic_orders__status', properties: ['status'] })
@Index({ name: 'ix__traffic_orders__type', properties: ['type'] })
@Index({ name: 'ix__traffic_orders__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__traffic_orders__creator_id', properties: ['creator'] })
@Index({ name: 'ix__traffic_orders__traffic_source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_orders__traffic_target_id', properties: ['trafficTarget'] })
@Index({ name: 'ix__traffic_orders__assigned_traffic_user_id', properties: ['assignedTrafficUser'] })
@Index({ name: 'ix__traffic_orders__created_by', properties: ['createdBy'] })
export class TrafficOrderEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 64, unique: true, fieldName: 'order_id' })
  orderId!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TrafficOrderType)
  type!: TrafficOrderType;

  @Property({ type: 'varchar', length: 20, fieldName: 'status' })
  @Enum(() => TrafficOrderStatus)
  status!: TrafficOrderStatus;

  @Property({ type: 'integer', fieldName: 'target_count' })
  targetCount!: number;

  @Property({ type: 'integer', default: 0, fieldName: 'current_count' })
  currentCount = 0;

  @Property({ type: 'decimal', precision: 10, scale: 4, fieldName: 'price_per_action' })
  pricePerAction!: string;

  @Property({ type: 'decimal', precision: 15, scale: 4, fieldName: 'total_budget' })
  totalBudget!: string;

  @Property({ type: 'decimal', precision: 15, scale: 4, default: '0', fieldName: 'spent_amount' })
  spentAmount = '0';

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'target_url' })
  targetUrl?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'requirements' })
  requirements?: TrafficOrderRequirements;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'start_date' })
  startDate?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'end_date' })
  endDate?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'creator_id', referenceColumnName: 'id', ref: true })
  creator!: Ref<UserEntity>;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @ManyToOne('TrafficTargetEntity', {
    nullable: false,
    joinColumn: 'traffic_target_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficTarget!: Ref<TrafficTargetEntity>;

  @ManyToOne('TrafficUserEntity', {
    nullable: true,
    joinColumn: 'assigned_traffic_user_id',
    referenceColumnName: 'id',
    ref: true,
  })
  assignedTrafficUser?: Ref<TrafficUserEntity>;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'created_by_id', referenceColumnName: 'id', ref: true })
  createdBy?: Ref<UserEntity>;

  @OneToMany('TrafficActionsEntity', 'trafficOrder')
  actions? = new Collection<TrafficActionsEntity>(this);

  constructor(
    data: EntityConstructorData<
      TrafficOrderEntity,
      'id' | 'createdAt' | 'updatedAt',
      'currentCount' | 'spentAmount',
      'creator' | 'trafficSource' | 'trafficTarget' | 'assignedTrafficUser' | 'createdBy'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      creatorId: {
        field: 'creator',
        entityClass: UserEntity,
        required: true,
      },
      trafficSourceId: {
        field: 'trafficSource',

        entityClass: TrafficSourceEntity,
        required: true,
      },
      trafficTargetId: {
        field: 'trafficTarget',

        entityClass: TrafficTargetEntity,
        required: true,
      },
      assignedTrafficUserId: {
        field: 'assignedTrafficUser',

        entityClass: TrafficUserEntity,
        required: false,
      },
      createdById: {
        field: 'createdBy',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
