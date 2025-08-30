import { Entity, PrimaryKey, Property, ManyToOne, OneToMany, Collection, Index, Enum } from '@mikro-orm/core';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { TrafficBuyerEntity } from './TrafficBuyer.entity';
import { TrafficUserEntity } from './TrafficUser.entity';
import { UserEntity } from './User.entity';
import { EntityConstructorData } from "../type/entity-constructor.type";

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

@Entity()
export class TrafficOrderEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  @Index()
  orderId!: string;

  @Enum(() => TrafficOrderType)
  type!: TrafficOrderType;

  @Enum(() => TrafficOrderStatus)
  status!: TrafficOrderStatus;

  @Property()
  targetCount!: number;

  @Property({ default: 0 })
  currentCount = 0;

  @Property()
  pricePerAction!: number;

  @Property()
  totalBudget!: number;

  @Property({ default: 0 })
  spentAmount = 0;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  targetUrl?: string;

  @Property({ nullable: true })
  requirements?: string; // JSON string for additional requirements

  @Property({ nullable: true })
  startDate?: Date;

  @Property({ nullable: true })
  endDate?: Date;

  @Property({ nullable: true })
  completedAt?: Date;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  // Relations
  @ManyToOne(() => UserEntity)
  creator!: UserEntity;

  @ManyToOne(() => TrafficSourceEntity)
  trafficSource!: TrafficSourceEntity;

  @ManyToOne(() => TrafficBuyerEntity)
  trafficBuyer!: TrafficBuyerEntity;

  @ManyToOne(() => TrafficUserEntity, { nullable: true })
  assignedTrafficUser?: TrafficUserEntity;

  @ManyToOne(() => 'UserEntity', { nullable: true })
  createdBy?: any; // UserEntity reference

  // 1:M relationship - One order contains many actions
  @OneToMany(() => 'TrafficActionsEntity', 'trafficOrder')
  actions? = new Collection<any>(this);

  constructor(data: EntityConstructorData<TrafficOrderEntity, 'id' | 'createdAt' | 'updatedAt', 'currentCount' | 'spentAmount'>) {
    Object.assign(this, data);
  }
}
