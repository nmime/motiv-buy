import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from "../type";

// Forward declarations for circular dependency resolution
declare class UserEntity { }
declare class TrafficOrderEntity { }
declare class TrafficUserEntity { }
declare class TrafficActionsEntity { }
declare class TrafficSourceCategoriesEntity { }

export enum TrafficSourceType {
  Bot = 'bot',
  BotWithToken = 'bot_with_token'
}

@Entity({ tableName: 'traffic_sources' })
@Index({ name: 'ix__traffic_sources__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_sources__type', properties: ['type'] })
@Index({ name: 'ix__traffic_sources__is_active', properties: ['isActive'] })
@Index({ name: 'ix__traffic_sources__bot_username', properties: ['botUsername'] })
export class TrafficSourceEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @Property({ type: 'varchar', length: 255, fieldName: 'name' })
  name!: string;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TrafficSourceType)
  type!: TrafficSourceType;

  @Property({ type: 'text', nullable: true, fieldName: 'bot_token' })
  botToken?: string;

  @Property({ type: 'varchar', length: 32, nullable: true, fieldName: 'bot_username' })
  botUsername?: string;

  @Property({ type: 'bigint', nullable: true, fieldName: 'telegram_id' })
  telegramId?: string;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'json', nullable: true, fieldName: 'config' })
  config?: Record<string, any>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @ManyToOne('UserEntity', { nullable: true, fieldName: 'managed_by' })
  managedBy?: any;

  @OneToMany('TrafficOrderEntity', 'trafficSource')
  orders = new Collection<any>(this);

  @OneToMany('TrafficUserEntity', 'trafficSource')
  trafficUsers = new Collection<any>(this);

  @OneToMany('TrafficActionsEntity', 'trafficSource')
  actions = new Collection<any>(this);

  // @OneToMany('TrafficSourceCategoriesEntity', 'trafficSource')
  // categories = new Collection<any>(this);

  constructor(data: EntityConstructorData<TrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt' | 'orders' | 'trafficUsers' | 'actions', 'isActive'>) {
    Object.assign(this, data);
  }
}
