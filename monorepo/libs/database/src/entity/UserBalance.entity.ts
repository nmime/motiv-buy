import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';

export enum CurrencyType {
  USDT = 'USDT',
  BTC = 'BTC',
  ETH = 'ETH',
  USD = 'USD',
  EUR = 'EUR',
  POINTS = 'POINTS'
}

@Entity({ tableName: 'user_balances' })
@Index({ name: 'ix__user_balances__user_id', properties: ['user'] })
@Index({ name: 'ix__user_balances__currency', properties: ['currency'] })
@Unique({ name: 'uq__user_balances__user_currency', properties: ['user', 'currency'] })
export class UserBalanceEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @ManyToOne('UserEntity', { fieldName: 'user_id' })
  user?: any;

  @Property({ type: 'varchar', length: 10, fieldName: 'currency' })
  @Enum(() => CurrencyType)
  currency!: CurrencyType;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'balance' })
  balance!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'locked_balance' })
  lockedBalance!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserBalanceEntity, 'id' | 'createdAt' | 'updatedAt' | 'getTotalBalance' | 'getAvailableBalance' | 'getLockedBalance'>) {
    Object.assign(this, data);
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
