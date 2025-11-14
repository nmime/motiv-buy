import { Collection, Entity, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData, TrafficSourceConfig } from '../type';
import { UserEntity } from './User.entity';
import type { TrafficOrderEntity } from './TrafficOrder.entity';
import type { TrafficUserEntity } from './TrafficUser.entity';
import type { TrafficActionsEntity } from './TrafficActions.entity';
import type { TrafficSourceCategoriesEntity } from './junction/TrafficSourceCategories.entity';

export enum TrafficSourceType {
  Bot = 'bot',
  BotWithToken = 'bot_with_token',
}

export enum TrafficSourceStatus {
  Pending = 'pending', // Awaiting moderation approval
  Active = 'active', // Approved and active
  Inactive = 'inactive', // Approved but disabled by owner
  Declined = 'declined', // Rejected by moderation
}

@Entity({ tableName: 'traffic_sources' })
@Index({ name: 'ix__traffic_sources__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_sources__type', properties: ['type'] })
@Index({ name: 'ix__traffic_sources__status', properties: ['status'] })
@Index({ name: 'ix__traffic_sources__bot_username', properties: ['botUsername'] })
@Index({ name: 'ix__traffic_sources__api_key_prefix', properties: ['apiKeyPrefix'] })
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

  @Property({ type: 'varchar', length: 20, fieldName: 'status' })
  @Enum(() => TrafficSourceStatus)
  status!: TrafficSourceStatus;

  @Property({ type: 'text', nullable: true, fieldName: 'bot_token' })
  botToken?: string;

  /**
   * Hashed API key for secure authentication
   * Uses bcrypt hashing for security
   * Plain text API key should never be stored
   */
  @Property({ type: 'text', nullable: true, fieldName: 'api_key_hash' })
  apiKeyHash?: string;

  /**
   * First 8 characters of API key for fast lookup
   * Used to narrow down bcrypt comparisons (security + performance)
   * Indexed for O(1) lookup instead of O(n) full table scan
   */
  @Property({ type: 'varchar', length: 8, nullable: true, fieldName: 'api_key_prefix' })
  apiKeyPrefix?: string;

  @Property({ type: 'varchar', length: 32, nullable: true, fieldName: 'bot_username' })
  botUsername?: string;

  @Property({ type: 'bigint', nullable: true, fieldName: 'telegram_id' })
  telegramId?: string;

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

  constructor(data: EntityConstructorData<TrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt', never, 'managedBy'>) {
    assignEntityData(this as Record<string, unknown>, data, {
      managedById: {
        field: 'managedBy',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
