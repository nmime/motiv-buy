import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';
import type { TrafficSourceEntity } from './TrafficSource.entity';
import type { TrafficOrderEntity } from './TrafficOrder.entity';

export enum TrafficUserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Banned = 'banned',
  Pending = 'pending'
}

@Entity({ tableName: 'traffic_users' })
@Index({ name: 'ix__traffic_users__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_users__username', properties: ['username'] })
@Index({ name: 'ix__traffic_users__status', properties: ['status'] })
@Index({ name: 'ix__traffic_users__traffic_source_id', properties: ['trafficSourceId'] })
export class TrafficUserEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'bigint', unique: true, fieldName: 'telegram_id' })
  telegramId!: string;

  @Property({ type: 'varchar', length: 32, nullable: true })
  username?: string;

  @Property({ type: 'varchar', length: 64, fieldName: 'first_name' })
  firstName!: string;

  @Property({ type: 'varchar', length: 64, nullable: true, fieldName: 'last_name' })
  lastName?: string;

  @Property({ type: 'integer', default: 0, fieldName: 'total_orders_participated' })
  totalOrdersParticipated = 0;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'total_earnings' })
  totalEarnings = '0';

  @Property({ type: 'decimal', precision: 5, scale: 2, default: '0', fieldName: 'completion_rate' })
  completionRate = '0';

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'language_code' })
  languageCode?: string;

  @Property({ type: 'boolean', default: true, fieldName: 'is_bot' })
  isBot!: boolean;

  @Property({ type: 'boolean', default: true, fieldName: 'can_join_groups' })
  canJoinGroups!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'can_receive_messages' })
  canReceiveMessages!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'supports_inline_queries' })
  supportsInlineQueries!: boolean;

  @Property({ type: 'varchar', length: 20, default: TrafficUserStatus.Active })
  @Enum(() => TrafficUserStatus)
  status: TrafficUserStatus = TrafficUserStatus.Active;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_seen_at' })
  lastSeenAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'joined_at' })
  joinedAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @Property({ type: 'uuid', fieldName: 'traffic_source_id' })
  trafficSourceId!: string;

  @ManyToOne('TrafficSourceEntity', { nullable: false, joinColumn: 'traffic_source_id', referenceColumnName: 'id' })
  trafficSource?: TrafficSourceEntity;

  @OneToMany('TrafficOrderEntity', 'assignedTrafficUser')
  assignedOrders? = new Collection<TrafficOrderEntity>(this);

  constructor(data: EntityConstructorData<TrafficUserEntity, 'id' | 'createdAt' | 'updatedAt' | 'joinedAt' | 'assignedOrders', 'totalOrdersParticipated' | 'totalEarnings' | 'completionRate' | 'isBot' | 'canJoinGroups' | 'canReceiveMessages' | 'supportsInlineQueries' | 'status'>) {
    Object.assign(this, data);
  }
}
