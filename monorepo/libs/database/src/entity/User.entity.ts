import { Entity, PrimaryKey, Property, Collection, OneToMany, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';

// Forward declarations for circular dependency resolution
declare class UserBalanceEntity { }
declare class UserBalanceHistoryEntity { }
declare class UserSettingsEntity { }
declare class TrafficBuyerEntity { }
declare class TrafficSourceEntity { }
declare class TrafficOrderEntity { }

export enum UserRole {
  User = 'user',
  Admin = 'admin',
  Developer = 'developer',
}

export enum UserStatus {
  Active = 'active',
  Restricted = 'restricted',
  Banned = 'banned',
}

@Entity({ tableName: 'users' })
@Index({ name: 'ix__users__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__users__username', properties: ['username'] })
@Index({ name: 'ix__users__referred_by', properties: ['referredBy'] })
@Index({ name: 'ix__users__status', properties: ['status'] })
@Index({ name: 'ix__users__created_at', properties: ['createdAt'] })
export class UserEntity {
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

  @Property({ type: 'varchar', length: 20, default: UserStatus.Active, fieldName: 'status' })
  @Enum(() => UserStatus)
  status!: UserStatus;

  @Property({ type: 'varchar', length: 20, default: UserRole.User, fieldName: 'role' })
  @Enum(() => UserRole)
  role!: UserRole;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'language_code' })
  languageCode?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'referred_by' })
  referredBy?: string;

  @Property({ type: 'integer', default: 0, fieldName: 'referral_count' })
  referralCount = 0;

  @Property({ type: 'uuid', nullable: true, fieldName: 'ref_link_level_1' })
  refLinkLevel1?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'ref_link_level_2' })
  refLinkLevel2?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'ref_link_level_3' })
  refLinkLevel3?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_active_at' })
  lastActiveAt?: Date;

  @OneToMany('UserBalanceEntity', 'user')
  balances = new Collection<any>(this);

  @OneToMany('UserBalanceHistoryEntity', 'user')
  balanceHistory = new Collection<any>(this);

  @OneToMany('UserSettingsEntity', 'user')
  settings = new Collection<any>(this);

  @OneToMany('TrafficBuyerEntity', 'managedBy')
  managedBuyers = new Collection<any>(this);

  @OneToMany('TrafficSourceEntity', 'managedBy')
  managedSources = new Collection<any>(this);

  @OneToMany('TrafficOrderEntity', 'createdBy')
  createdOrders = new Collection<any>(this);

  constructor(data: EntityConstructorData<UserEntity, 'id' | 'createdAt' | 'updatedAt' | 'balances' | 'balanceHistory' | 'settings' | 'managedBuyers' | 'managedSources' | 'createdOrders', 'status' | 'role' | 'referralCount'>) {
    Object.assign(this, data);
  }
}
