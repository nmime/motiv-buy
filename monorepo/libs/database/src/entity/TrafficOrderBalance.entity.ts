import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { CurrencyEntity } from './Currency.entity';

/**
 * Traffic Order Balance Entity
 *
 * Holds locked funds for traffic orders (guaranteed payment pattern).
 * When an order is created, funds are transferred from buyer's UserBalance
 * to this locked balance. As tasks are completed, funds are distributed
 * from this locked balance to sellers.
 *
 * This prevents:
 * - Orders running out of funds mid-execution
 * - Race conditions in balance updates
 * - Double-spending issues
 */
@Entity({ tableName: 'traffic_order_balances' })
@Index({ name: 'ix__traffic_order_balances__traffic_order_id', properties: ['trafficOrder'] })
@Index({ name: 'ix__traffic_order_balances__currency_id', properties: ['currency'] })
export class TrafficOrderBalanceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('TrafficOrderEntity', {
    nullable: false,
    unique: true,
    joinColumn: 'traffic_order_id',
    referenceColumnName: 'id',
    ref: true,
  })
  @Index()
  trafficOrder!: Ref<TrafficOrderEntity>;

  @ManyToOne('CurrencyEntity', {
    nullable: false,
    joinColumn: 'currency_id',
    referenceColumnName: 'id',
    ref: true,
  })
  currency!: Ref<CurrencyEntity>;

  /**
   * Total budget locked for this order (reserved funds)
   * Transferred from buyer's UserBalance when order is created
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'locked_amount' })
  lockedAmount!: string;

  /**
   * Amount already spent on completed tasks
   * Sum of all payments made to sellers
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'spent_amount' })
  spentAmount = '0';

  /**
   * Available amount remaining in locked balance
   * lockedAmount - spentAmount
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, fieldName: 'available_amount' })
  availableAmount!: string;

  /**
   * Amount refunded back to buyer (if order cancelled or completed with funds remaining)
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'refunded_amount' })
  refundedAmount = '0';

  /**
   * Whether the balance has been fully settled (all funds distributed or refunded)
   */
  @Property({ type: 'boolean', default: false, fieldName: 'is_settled' })
  isSettled = false;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'settled_at' })
  settledAt?: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficOrderBalanceEntity,
      'id' | 'createdAt' | 'updatedAt',
      'spentAmount' | 'refundedAmount' | 'isSettled',
      'trafficOrder' | 'currency'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficOrderId: {
        field: 'trafficOrder',
        entityClass: TrafficOrderEntity,
        required: true,
      },
      currencyId: {
        field: 'currency',
        entityClass: CurrencyEntity,
        required: true,
      },
    });
  }
}
