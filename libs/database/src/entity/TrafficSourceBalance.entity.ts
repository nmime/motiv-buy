import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { CurrencyEntity } from './Currency.entity';
import { add, toDbString } from '@app/common-shared';

/**
 * Traffic Source Balance Entity
 *
 * Holds earnings for traffic sources. When a task is completed,
 * the reward is credited to this balance. Source owners can
 * transfer funds from here to their UserBalance.
 *
 * This separation allows:
 * - Clear tracking of source earnings vs personal funds
 * - Per-source balance management
 * - Easy reporting on source performance
 */
@Entity({ tableName: 'traffic_source_balances' })
@Index({ name: 'ix__traffic_source_balances__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_source_balances__currency_id', properties: ['currency'] })
@Unique({ name: 'uq__traffic_source_balances__source_currency', properties: ['trafficSource', 'currency'] })
export class TrafficSourceBalanceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @ManyToOne('CurrencyEntity', {
    nullable: false,
    joinColumn: 'currency_id',
    referenceColumnName: 'id',
    ref: true,
  })
  currency!: Ref<CurrencyEntity>;

  /**
   * Available balance (can be withdrawn)
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'balance' })
  balance = '0';

  /**
   * Pending balance (awaiting verification)
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'pending_balance' })
  pendingBalance = '0';

  /**
   * Total earnings (lifetime)
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'total_earned' })
  totalEarned = '0';

  /**
   * Total withdrawn to user balance
   */
  @Property({ type: 'decimal', precision: 20, scale: 8, default: '0', fieldName: 'total_withdrawn' })
  totalWithdrawn = '0';

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficSourceBalanceEntity,
      'id' | 'createdAt' | 'updatedAt' | 'getTotalBalance' | 'getAvailableBalance',
      'balance' | 'pendingBalance' | 'totalEarned' | 'totalWithdrawn',
      'trafficSource' | 'currency'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficSourceId: {
        field: 'trafficSource',
        entityClass: TrafficSourceEntity,
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
    return toDbString(add(this.balance, this.pendingBalance), 8);
  }

  getAvailableBalance(): string {
    return this.balance;
  }
}
