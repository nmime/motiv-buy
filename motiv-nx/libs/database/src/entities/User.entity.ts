import { Entity, PrimaryKey, Property, Collection, OneToMany, Index } from '@mikro-orm/core';
import { UserBalanceEntity } from './UserBalance.entity';
import { UserBalanceHistoryEntity } from './UserBalanceHistory.entity';
import { UserSettingsEntity } from './UserSettings.entity';
import { TrafficBuyerEntity } from './TrafficBuyer.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import {EntityConstructorData} from "../types/entity-constructor.type";

@Entity()
export class UserEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  @Index()
  telegramId!: string;

  @Property({ nullable: true})
  username?: string;

  @Property()
  firstName!: string;

  @Property({ nullable: true })
  lastName?: string;

  @Property({ nullable: true })
  phone?: string;

  @Property({ default: true })
  isActive!: boolean;

  @Property({ default: false })
  isPremium!: boolean;

  @Property({ nullable: true })
  languageCode?: string;

  @Property({ nullable: true })
  @Index()
  referredBy?: string;

  @Property({ default: 0 })
  referralCount = 0;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  lastActiveAt?: Date;

  // Relations
  @OneToMany(() => UserBalanceEntity, balance => balance.user)
  balances? = new Collection<UserBalanceEntity>(this);

  @OneToMany(() => UserBalanceHistoryEntity, history => history.user)
  balanceHistory? = new Collection<UserBalanceHistoryEntity>(this);

  @OneToMany(() => UserSettingsEntity, settings => settings.user)
  settings? = new Collection<UserSettingsEntity>(this);

  // Traffic Management Relations
  @OneToMany(() => TrafficBuyerEntity, buyer => buyer.managedBy)
  managedBuyers? = new Collection<TrafficBuyerEntity>(this);

  @OneToMany(() => TrafficSourceEntity, source => source.managedBy)
  managedSources? = new Collection<TrafficSourceEntity>(this);

  @OneToMany(() => TrafficOrderEntity, order => order.createdBy)
  createdOrders? = new Collection<TrafficOrderEntity>(this);

  constructor(data: EntityConstructorData<UserEntity, 'id' | 'createdAt' | 'updatedAt', 'referralCount'>) {
     Object.assign(this, data);
  }
}
