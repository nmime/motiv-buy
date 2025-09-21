import { Entity, PrimaryKey, Property, ManyToOne, Index, Enum, Ref } from '@mikro-orm/core';
import { CurrencyType } from './UserBalance.entity';
import { EntityConstructorData, UserBalanceMetadata, assignEntityData } from '../type';
import { UserEntity } from './User.entity';

export enum TransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  TransferIn = 'transfer_in',
  TransferOut = 'transfer_out',
  Reward = 'reward',
  Penalty = 'penalty',
  TradeBuy = 'trade_buy',
  TradeSell = 'trade_sell',
  ReferralBonus = 'referral_bonus',
  AdminAdjustment = 'admin_adjustment',
}

export enum TransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

@Entity({ tableName: 'user_balance_history' })
@Index({ name: 'ix__user_balance_history__user_id', properties: ['user'] })
@Index({ name: 'ix__user_balance_history__currency', properties: ['currency'] })
@Index({ name: 'ix__user_balance_history__type', properties: ['type'] })
@Index({ name: 'ix__user_balance_history__status', properties: ['status'] })
@Index({ name: 'ix__user_balance_history__reference_id', properties: ['referenceId'] })
@Index({ name: 'ix__user_balance_history__created_at', properties: ['createdAt'] })
export class UserBalanceHistoryEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @Property({ type: 'varchar', length: 10, fieldName: 'currency' })
  @Enum(() => CurrencyType)
  currency!: CurrencyType;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TransactionType)
  type!: TransactionType;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'amount' })
  amount!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'balance_before' })
  balanceBefore!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'balance_after' })
  balanceAfter!: string;

  @Property({ type: 'varchar', length: 20, default: TransactionStatus.Pending, fieldName: 'status' })
  @Enum(() => TransactionStatus)
  status!: TransactionStatus;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 128, nullable: true, fieldName: 'tx_hash' })
  txHash?: string;

  @Property({ type: 'varchar', length: 64, nullable: true, fieldName: 'reference_id' })
  referenceId?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'metadata' })
  metadata?: UserBalanceMetadata;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<UserBalanceHistoryEntity, 'id' | 'createdAt' | 'updatedAt', 'status', 'user'>,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: { field: 'user', entityClass: UserEntity as any, required: true },
    });
  }
}
