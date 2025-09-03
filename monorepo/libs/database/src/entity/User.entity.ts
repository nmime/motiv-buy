import { Entity, PrimaryKey, Property, Collection, OneToMany, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';
import { UserBalanceEntity } from './UserBalance.entity';
import { UserBalanceHistoryEntity } from './UserBalanceHistory.entity';
import { UserSettingsEntity } from './UserSettings.entity';
import { TrafficBuyerEntity } from './TrafficBuyer.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { TrafficOrderEntity } from './TrafficOrder.entity';

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
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
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

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_active_at' })
  lastActiveAt?: Date;

  @OneToMany(() => UserBalanceEntity, 'user')
  balances = new Collection<UserBalanceEntity>(this);

  @OneToMany(() => UserBalanceHistoryEntity, 'user')
  balanceHistory = new Collection<UserBalanceHistoryEntity>(this);

  @OneToMany(() => UserSettingsEntity, 'user')
  settings = new Collection<UserSettingsEntity>(this);

  @OneToMany(() => TrafficBuyerEntity, 'managedBy')
  managedBuyers = new Collection<TrafficBuyerEntity>(this);

  @OneToMany(() => TrafficSourceEntity, 'managedBy')
  managedSources = new Collection<TrafficSourceEntity>(this);

  @OneToMany(() => TrafficOrderEntity, 'createdBy')
  createdOrders = new Collection<TrafficOrderEntity>(this);

  constructor(
    data: EntityConstructorData<UserEntity, 'id' | 'createdAt' | 'updatedAt', 'referralCount' | 'role' | 'status'>,
  ) {
    Object.assign(this, data);
  }
}
