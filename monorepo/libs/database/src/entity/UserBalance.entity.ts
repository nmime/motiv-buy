import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Enum, Ref } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { UserEntity } from './User.entity';

export enum CurrencyType {
  RUB = 'RUB',
}

@Entity({ tableName: 'user_balances' })
@Index({ name: 'ix__user_balances__user_id', properties: ['user'] })
@Index({ name: 'ix__user_balances__currency', properties: ['currency'] })
@Unique({ name: 'uq__user_balances__user_currency', properties: ['user', 'currency'] })
export class UserBalanceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

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

  constructor(
    data: EntityConstructorData<
      UserBalanceEntity,
      'id' | 'createdAt' | 'updatedAt' | 'getTotalBalance' | 'getAvailableBalance' | 'getLockedBalance',
      never,
      'user'
    >,
  ) {
    assignEntityData(this, data, {
      userId: { field: 'user', entityClass: UserEntity, required: true },
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
