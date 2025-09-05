import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from "../type";
import type { UserEntity } from './User.entity';
import type { TrafficSourceEntity } from './TrafficSource.entity';
import type { TrafficBuyerEntity } from './TrafficBuyer.entity';
import type { TrafficUserEntity } from './TrafficUser.entity';
import type { TrafficActionsEntity } from './TrafficActions.entity';

export enum TrafficOrderStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  InProgress = 'in_progress'
}

export enum TrafficOrderType {
  Join = 'join',
  Leave = 'leave',
  View = 'view',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  React = 'react',
  Comment = 'comment'
}

@Entity({ tableName: 'traffic_orders' })
@Index({ name: 'ix__traffic_orders__order_id', properties: ['orderId'] })
@Index({ name: 'ix__traffic_orders__status', properties: ['status'] })
@Index({ name: 'ix__traffic_orders__type', properties: ['type'] })
@Index({ name: 'ix__traffic_orders__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__traffic_orders__creator_id', properties: ['creatorId'] })
@Index({ name: 'ix__traffic_orders__traffic_source_id', properties: ['trafficSourceId'] })
@Index({ name: 'ix__traffic_orders__traffic_buyer_id', properties: ['trafficBuyerId'] })
@Index({ name: 'ix__traffic_orders__assigned_traffic_user_id', properties: ['assignedTrafficUserId'] })
@Index({ name: 'ix__traffic_orders__created_by', properties: ['createdById'] })
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
  requirements?: Record<string, any>;

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

  @Property({ type: 'uuid', fieldName: 'creator_id' })
  creatorId!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_source_id' })
  trafficSourceId!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_buyer_id' })
  trafficBuyerId!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'assigned_traffic_user_id' })
  assignedTrafficUserId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'created_by_id' })
  createdById?: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'creator_id', referenceColumnName: 'id' })
  creator?: UserEntity;

  @ManyToOne('TrafficSourceEntity', { nullable: false, joinColumn: 'traffic_source_id', referenceColumnName: 'id' })
  trafficSource?: TrafficSourceEntity;

  @ManyToOne('TrafficBuyerEntity', { nullable: false, joinColumn: 'traffic_buyer_id', referenceColumnName: 'id' })
  trafficBuyer?: TrafficBuyerEntity;

  @ManyToOne('TrafficUserEntity', { nullable: true, joinColumn: 'assigned_traffic_user_id', referenceColumnName: 'id' })
  assignedTrafficUser?: TrafficUserEntity;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'created_by_id', referenceColumnName: 'id' })
  createdBy?: UserEntity;

  @OneToMany('TrafficActionsEntity', 'trafficOrder')
  actions? = new Collection<TrafficActionsEntity>(this);

  constructor(data: EntityConstructorData<TrafficOrderEntity, 'id' | 'createdAt' | 'updatedAt' | 'actions', 'currentCount' | 'spentAmount'>) {
    Object.assign(this, data);
  }
}
