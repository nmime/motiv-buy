import { Entity, PrimaryKey, Property, Collection, OneToMany, Index } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';

@Entity()
export class UserEntity {
  @PrimaryKey()
  id!: string;

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

  @OneToMany(() => 'UserBalanceEntity', 'user')
  balances? = new Collection<any>(this);

  @OneToMany(() => 'UserBalanceHistoryEntity', 'user')
  balanceHistory? = new Collection<any>(this);

  @OneToMany(() => 'UserSettingsEntity', 'user')
  settings? = new Collection<any>(this);

  @OneToMany(() => 'TrafficBuyerEntity', 'managedBy')
  managedBuyers? = new Collection<any>(this);

  @OneToMany(() => 'TrafficSourceEntity', 'managedBy')
  managedSources? = new Collection<any>(this);

  @OneToMany(() => 'TrafficOrderEntity', 'createdBy')
  createdOrders? = new Collection<any>(this);

  constructor(data: EntityConstructorData<UserEntity, 'id' | 'createdAt' | 'updatedAt', 'referralCount'>) {
     Object.assign(this, data);
  }
}
