import { Entity, PrimaryKey, Property, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { EntityConstructorData } from "../type/entity-constructor.type";

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

@Entity({ tableName: 'traffic_actions' })
@Index({ name: 'ix__traffic_actions__action_id', properties: ['actionId'] })
@Index({ name: 'ix__traffic_actions__status', properties: ['status'] })
@Index({ name: 'ix__traffic_actions__type', properties: ['type'] })
@Index({ name: 'ix__traffic_actions__scheduled_at', properties: ['scheduledAt'] })
export class TrafficActionsEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @Property({ type: 'varchar', length: 64, unique: true, fieldName: 'action_id' })
  actionId!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TrafficActionType)
  type!: TrafficActionType;

  @Property({ type: 'varchar', length: 20, fieldName: 'status' })
  @Enum(() => TrafficActionStatus)
  status!: TrafficActionStatus;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'target_url' })
  targetUrl?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'action_data' })
  actionData?: Record<string, any>;

  @Property({ type: 'decimal', precision: 10, scale: 4, default: '0', fieldName: 'reward' })
  reward = '0';

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'scheduled_at' })
  scheduledAt?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'started_at' })
  startedAt?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'failed_at' })
  failedAt?: Date;

  @Property({ type: 'text', nullable: true, fieldName: 'failure_reason' })
  failureReason?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  
  @ManyToOne(() => TrafficOrderEntity)
  @Index()
  trafficOrder!: TrafficOrderEntity;

  @ManyToOne(() => TrafficSourceEntity)
  @Index()
  trafficSource!: TrafficSourceEntity;

  
  constructor(data: EntityConstructorData<TrafficActionsEntity, 'id' | 'createdAt' | 'updatedAt', 'reward'>) {
    Object.assign(this, data);
  }
}
