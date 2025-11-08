import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { TrafficOrderBalanceEntity, TrafficOrderEntity, CurrencyEntity, CurrencyCode } from '../entity';
import { add, subtract, toDbString, decimal } from '@app/common-shared';

/**
 * TrafficOrderBalance Repository
 *
 * Handles locked balance operations for traffic orders (guaranteed payment pattern)
 */
export class TrafficOrderBalanceRepository extends EntityRepository<TrafficOrderBalanceEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficOrderBalanceEntity);
  }

  /**
   * Find balance by order ID
   */
  async findByOrderId(orderId: string): Promise<TrafficOrderBalanceEntity | null> {
    return this.findOne(
      { trafficOrder: { orderId } },
      {
        populate: ['trafficOrder', 'currency'],
      },
    );
  }

  /**
   * Find balance by order entity
   */
  async findByOrder(order: TrafficOrderEntity): Promise<TrafficOrderBalanceEntity | null> {
    return this.findOne({ trafficOrder: order.id }, { populate: ['currency'] });
  }

  /**
   * Create locked balance reserve for order
   * Locks the specified amount from buyer's balance
   */
  async lockFunds(data: {
    order: TrafficOrderEntity;
    currencyCode: CurrencyCode;
    lockedAmount: string;
  }): Promise<TrafficOrderBalanceEntity> {
    const currency = await this.em.findOne(CurrencyEntity, { code: data.currencyCode });
    if (!currency) {
      throw new Error(`Currency with code ${data.currencyCode} not found`);
    }

    const reserve = new TrafficOrderBalanceEntity({
      trafficOrderId: data.order.id,
      currencyId: currency.id,
      lockedAmount: data.lockedAmount,
      availableAmount: data.lockedAmount, // Initially all funds are available
      spentAmount: '0',
      refundedAmount: '0',
      isSettled: false,
    });

    await this.em.persistAndFlush(reserve);

    return reserve;
  }

  /**
   * Deduct amount from locked balance (when task is completed)
   * Validates balance invariant before and after update
   * Returns updated balance
   *
   * Invariant: lockedAmount = spentAmount + availableAmount + refundedAmount
   */
  async deductFromLocked(reserveId: string, amount: string): Promise<TrafficOrderBalanceEntity> {
    const reserve = await this.findOne({ id: reserveId });
    if (!reserve) {
      throw new Error('Order balance reserve not found');
    }

    const available = decimal(reserve.availableAmount);
    const deductAmount = decimal(amount);

    if (available.lessThan(deductAmount)) {
      throw new Error('Insufficient locked balance');
    }

    // Calculate new amounts
    const newAvailable = subtract(reserve.availableAmount, amount);
    const newSpent = add(reserve.spentAmount, amount);

    // Application-level invariant validation BEFORE database update
    // This catches bugs before database constraint violation
    const invariantSum = add(add(newAvailable, newSpent), reserve.refundedAmount);
    if (!decimal(invariantSum).equals(reserve.lockedAmount)) {
      throw new Error(
        `Balance invariant violation: locked=${reserve.lockedAmount}, ` +
          `available=${toDbString(newAvailable, 8)}, ` +
          `spent=${toDbString(newSpent, 8)}, ` +
          `refunded=${reserve.refundedAmount}`,
      );
    }

    // Update amounts (database constraint will also verify)
    reserve.availableAmount = toDbString(newAvailable, 8);
    reserve.spentAmount = toDbString(newSpent, 8);

    await this.em.flush();

    return reserve;
  }

  /**
   * Refund remaining amount back to buyer (when order is completed or cancelled)
   */
  async refundRemaining(reserveId: string): Promise<TrafficOrderBalanceEntity> {
    const reserve = await this.findOne({ id: reserveId });
    if (!reserve) {
      throw new Error('Order balance reserve not found');
    }

    if (reserve.isSettled) {
      throw new Error('Balance already settled');
    }

    const availableAmount = decimal(reserve.availableAmount);

    if (availableAmount.greaterThan('0')) {
      reserve.refundedAmount = toDbString(add(reserve.refundedAmount, reserve.availableAmount), 8);
      reserve.availableAmount = '0';
    }

    reserve.isSettled = true;
    reserve.settledAt = new Date();

    await this.em.flush();

    return reserve;
  }

  /**
   * Settle balance (mark as complete, no refund)
   */
  async settleBalance(reserveId: string): Promise<TrafficOrderBalanceEntity> {
    const reserve = await this.findOne({ id: reserveId });
    if (!reserve) {
      throw new Error('Order balance reserve not found');
    }

    if (reserve.isSettled) {
      return reserve;
    }

    reserve.isSettled = true;
    reserve.settledAt = new Date();

    await this.em.flush();

    return reserve;
  }

  /**
   * Get unsettled balances (for cleanup/monitoring)
   */
  async findUnsettled(): Promise<TrafficOrderBalanceEntity[]> {
    return this.find(
      { isSettled: false },
      {
        populate: ['trafficOrder', 'currency'],
        orderBy: { createdAt: 'ASC' },
      },
    );
  }

  /**
   * Get order balance stats
   */
  async getStats(): Promise<{
    totalReserves: number;
    totalLocked: string;
    totalSpent: string;
    totalRefunded: string;
    totalAvailable: string;
    unsettledCount: number;
  }> {
    const [totalReserves, unsettledCount] = await Promise.all([
      this.count(),
      this.count({ isSettled: false }),
    ]);

    const reserves = await this.findAll();

    let totalLocked = decimal('0');
    let totalSpent = decimal('0');
    let totalRefunded = decimal('0');
    let totalAvailable = decimal('0');

    for (const reserve of reserves) {
      totalLocked = add(totalLocked, reserve.lockedAmount);
      totalSpent = add(totalSpent, reserve.spentAmount);
      totalRefunded = add(totalRefunded, reserve.refundedAmount);
      totalAvailable = add(totalAvailable, reserve.availableAmount);
    }

    return {
      totalReserves,
      totalLocked: toDbString(totalLocked, 8),
      totalSpent: toDbString(totalSpent, 8),
      totalRefunded: toDbString(totalRefunded, 8),
      totalAvailable: toDbString(totalAvailable, 8),
      unsettledCount,
    };
  }
}
