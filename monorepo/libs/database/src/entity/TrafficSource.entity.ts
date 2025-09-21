import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum, Ref } from '@mikro-orm/core';
import { EntityConstructorData, TrafficSourceConfig, assignEntityData } from '../type';
import { UserEntity } from './User.entity';
import type { TrafficOrderEntity } from './TrafficOrder.entity';
import type { TrafficUserEntity } from './TrafficUser.entity';
import type { TrafficActionsEntity } from './TrafficActions.entity';
import type { TrafficSourceCategoriesEntity } from './junction/TrafficSourceCategories.entity';

export enum TrafficSourceType {
  Bot = 'bot',
  BotWithToken = 'bot_with_token',
}

@Entity({ tableName: 'traffic_sources' })
@Index({ name: 'ix__traffic_sources__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_sources__type', properties: ['type'] })
@Index({ name: 'ix__traffic_sources__is_active', properties: ['isActive'] })
@Index({ name: 'ix__traffic_sources__bot_username', properties: ['botUsername'] })
export class TrafficSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

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
  config?: TrafficSourceConfig;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'managed_by_id', referenceColumnName: 'id', ref: true })
  managedBy?: Ref<UserEntity>;

  @OneToMany('TrafficOrderEntity', 'trafficSource')
  orders? = new Collection<TrafficOrderEntity>(this);

  @OneToMany('TrafficUserEntity', 'trafficSource')
  trafficUsers? = new Collection<TrafficUserEntity>(this);

  @OneToMany('TrafficActionsEntity', 'trafficSource')
  actions? = new Collection<TrafficActionsEntity>(this);

  @OneToMany('TrafficSourceCategoriesEntity', 'trafficSource')
  categories? = new Collection<TrafficSourceCategoriesEntity>(this);

  constructor(
    data: EntityConstructorData<TrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive', 'managedBy'>,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      managedById: { field: 'managedBy', entityClass: UserEntity as any, required: false },
    });
  }
}
