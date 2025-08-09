import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { UserEntity } from './User.entity';
import { CurrencyType } from './UserBalance.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  REWARD = 'REWARD',
  PENALTY = 'PENALTY',
  TRADE_BUY = 'TRADE_BUY',
  TRADE_SELL = 'TRADE_SELL',
  REFERRAL_BONUS = 'REFERRAL_BONUS',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

@Entity()
export class UserBalanceHistoryEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @Property()
  @Index()
  currency!: CurrencyType;

  @Property()
  @Index()
  type!: TransactionType;

  @Property({ type: 'decimal', precision: 20, scale: 8 })
  amount!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8 })
  balanceBefore!: string;

  @Property({ type: 'decimal', precision: 20, scale: 8 })
  balanceAfter!: string;

  @Property({ default: TransactionStatus.PENDING })
  @Index()
  status!: TransactionStatus;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  txHash?: string;

  @Property({ nullable: true })
  @Index()
  referenceId?: string;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property()
  @Index()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(
    user: UserEntity,
    currency: CurrencyType,
    type: TransactionType,
    amount: string,
    balanceBefore: string,
    balanceAfter: string
  ) {
    this.user = user;
    this.currency = currency;
    this.type = type;
    this.amount = amount;
    this.balanceBefore = balanceBefore;
    this.balanceAfter = balanceAfter;
    this.status = TransactionStatus.PENDING;
  }
}
