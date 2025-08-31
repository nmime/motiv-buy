import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique } from '@mikro-orm/core';
import { UserEntity } from './User.entity';

export enum CurrencyType {
  USDT = 'USDT',
  BTC = 'BTC',
  ETH = 'ETH',
  USD = 'USD',
  EUR = 'EUR',
  POINTS = 'POINTS'
}

@Entity()
@Unique({ properties: ['user', 'currency'] })
export class UserBalanceEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @Property()
  @Index()
  currency!: CurrencyType;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  balance!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  lockedBalance!: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(user: UserEntity, currency: CurrencyType, balance: string = '0') {
    this.user = user;
    this.currency = currency;
    this.balance = balance;
    this.lockedBalance = '0';
  }

  getTotalBalance(): string {
    const total = parseFloat(this.balance) + parseFloat(this.lockedBalance);
    return total.toString();
  }

  getAvailableBalance(): string {
    return this.balance;
  }

  getLockedBalance(): string {
    return this.lockedBalance;
  }
}
