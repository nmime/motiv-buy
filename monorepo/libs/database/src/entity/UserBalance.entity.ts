import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Ref } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { UserEntity } from './User.entity';
import { CurrencyEntity } from './Currency.entity';

/**
 * @deprecated Use CurrencyEntity instead
 * Kept for backwards compatibility during migration
 */
export enum CurrencyType {
  Rub = 'RUB',
  USDT = 'USDT',
  TON = 'TON',
  BTC = 'BTC',
  ETH = 'ETH',
  LTC = 'LTC',
  BNB = 'BNB',
  TRX = 'TRX',
  USDC = 'USDC',
}

@Entity({ tableName: 'user_balances' })
@Index({ name: 'ix__user_balances__user_id', properties: ['user'] })
@Index({ name: 'ix__user_balances__currency_id', properties: ['currency'] })
@Unique({ name: 'uq__user_balances__user_currency', properties: ['user', 'currency'] })
export class UserBalanceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne('CurrencyEntity', { nullable: false, joinColumn: 'currency_id', referenceColumnName: 'id', ref: true })
  currency!: Ref<CurrencyEntity>;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'balance' })
  balance!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'locked_balance' })
  lockedBalance!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      UserBalanceEntity,
      'id' | 'createdAt' | 'updatedAt' | 'getTotalBalance' | 'getAvailableBalance' | 'getLockedBalance',
      never,
      'user' | 'currency'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
      currencyId: {
        field: 'currency',
        entityClass: CurrencyEntity,
        required: true,
      },
    });
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
