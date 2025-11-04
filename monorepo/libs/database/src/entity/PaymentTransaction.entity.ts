import { Entity, PrimaryKey, Property, Enum, Index } from '@mikro-orm/core';
import { PaymentType, PaymentProvider, PaymentStatus, Cryptocurrency } from '../enum';

/**
 * Payment transaction entity
 * Stores all payment transactions for top-ups and withdrawals
 */
@Entity({ tableName: 'payment_transactions' })
@Index({ properties: ['userId'] })
@Index({ properties: ['status'] })
@Index({ properties: ['providerTransactionId'] })
@Index({ properties: ['createdAt'] })
@Index({ properties: ['userId', 'status'] })
export class PaymentTransactionEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'string', length: 255 })
  @Index()
  userId!: string;

  @Enum(() => PaymentType)
  type!: PaymentType;

  @Enum(() => PaymentProvider)
  provider!: PaymentProvider;

  @Property({ type: 'string', length: 255, nullable: true, unique: true })
  @Index()
  providerTransactionId!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8 })
  amount!: string;

  @Enum(() => Cryptocurrency)
  currency!: Cryptocurrency;

  @Enum(() => PaymentStatus)
  @Index()
  status!: PaymentStatus;

  @Property({ type: 'string', length: 500, nullable: true })
  payUrl!: string | null;

  @Property({ type: 'text', nullable: true })
  description!: string | null;

  @Property({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  fee!: string | null;

  @Property({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Property({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Property({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Property({ type: 'timestamptz', onCreate: () => new Date(), nullable: true })
  createdAt?: Date;

  @Property({ type: 'timestamptz', onCreate: () => new Date(), onUpdate: () => new Date(), nullable: true })
  updatedAt?: Date;
}
