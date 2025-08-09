import { Entity, PrimaryKey, Property, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { EntityConstructorData } from "../types/entity-constructor.type";

export enum TrafficActionStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum TrafficActionType {
  Join = 'join',
  Leave = 'leave',
  View = 'view',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  React = 'react',
  Comment = 'comment',
  Share = 'share',
  Vote = 'vote'
}

@Entity()
export class TrafficActionsEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  @Index()
  actionId!: string;

  @Enum(() => TrafficActionType)
  type!: TrafficActionType;

  @Enum(() => TrafficActionStatus)
  status!: TrafficActionStatus;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  targetUrl?: string;

  @Property({ nullable: true })
  actionData?: string; // JSON string for additional action data

  @Property({ default: 0 })
  reward = 0;

  @Property({ nullable: true })
  scheduledAt?: Date;

  @Property({ nullable: true })
  startedAt?: Date;

  @Property({ nullable: true })
  completedAt?: Date;

  @Property({ nullable: true })
  failedAt?: Date;

  @Property({ nullable: true })
  failureReason?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  // Relations - Core cardinalities from specification
  
  // M:1 - Many actions belong to one order
  @ManyToOne(() => TrafficOrderEntity)
  @Index()
  trafficOrder!: TrafficOrderEntity;

  // M:1 - Each action is linked to exactly one source
  @ManyToOne(() => TrafficSourceEntity)
  @Index()
  trafficSource!: TrafficSourceEntity;

  // Note: M:N relationship with TrafficUserEntity handled via junction table
  // See TrafficActionsUsers entity for the many-to-many relationship
  
  constructor(data: EntityConstructorData<TrafficActionsEntity, 'id' | 'createdAt' | 'updatedAt', 'reward'>) {
    Object.assign(this, data);
  }
}