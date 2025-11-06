import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { TrafficOrderBalanceEntity, TrafficOrderEntity, CurrencyEntity, CurrencyCode } from '../entity';
import { add, subtract, toDbString, decimal } from '@app/common-shared';

/**
 * TrafficOrderBalance Repository
 *
 * Handles escrow balance operations for traffic orders
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
   * Create escrow balance for order
   * Locks the specified amount from buyer's balance
   */
  async createEscrow(data: {
    order: TrafficOrderEntity;
    currencyCode: CurrencyCode;
    lockedAmount: string;
  }): Promise<TrafficOrderBalanceEntity> {
    const currency = await this.em.findOne(CurrencyEntity, { code: data.currencyCode });
    if (!currency) {
      throw new Error(`Currency with code ${data.currencyCode} not found`);
    }

    const escrow = new TrafficOrderBalanceEntity({
      trafficOrderId: data.order.id,
      currencyId: currency.id,
      lockedAmount: data.lockedAmount,
      availableAmount: data.lockedAmount, // Initially all funds are available
      spentAmount: '0',
      refundedAmount: '0',
      isSettled: false,
    });

    await this.em.persistAndFlush(escrow);

    return escrow;
  }

  /**
   * Deduct amount from available escrow (when task is completed)
   * Returns updated balance
   */
  async deductFromEscrow(escrowId: string, amount: string): Promise<TrafficOrderBalanceEntity> {
    const escrow = await this.findOne({ id: escrowId });
    if (!escrow) {
      throw new Error('Escrow balance not found');
    }

    const available = decimal(escrow.availableAmount);
    const deductAmount = decimal(amount);

    if (available.lessThan(deductAmount)) {
      throw new Error('Insufficient escrow balance');
    }

    // Update amounts
    escrow.availableAmount = toDbString(subtract(escrow.availableAmount, amount), 8);
    escrow.spentAmount = toDbString(add(escrow.spentAmount, amount), 8);

    await this.em.flush();

    return escrow;
  }

  /**
   * Refund remaining amount back to buyer (when order is completed or cancelled)
   */
  async refundRemaining(escrowId: string): Promise<TrafficOrderBalanceEntity> {
    const escrow = await this.findOne({ id: escrowId });
    if (!escrow) {
      throw new Error('Escrow balance not found');
    }

    if (escrow.isSettled) {
      throw new Error('Escrow already settled');
    }

    const availableAmount = decimal(escrow.availableAmount);

    if (availableAmount.greaterThan('0')) {
      escrow.refundedAmount = toDbString(add(escrow.refundedAmount, escrow.availableAmount), 8);
      escrow.availableAmount = '0';
    }

    escrow.isSettled = true;
    escrow.settledAt = new Date();

    await this.em.flush();

    return escrow;
  }

  /**
   * Settle escrow (mark as complete, no refund)
   */
  async settleEscrow(escrowId: string): Promise<TrafficOrderBalanceEntity> {
    const escrow = await this.findOne({ id: escrowId });
    if (!escrow) {
      throw new Error('Escrow balance not found');
    }

    if (escrow.isSettled) {
      return escrow;
    }

    escrow.isSettled = true;
    escrow.settledAt = new Date();

    await this.em.flush();

    return escrow;
  }

  /**
   * Get unsettled escrows (for cleanup/monitoring)
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
   * Get escrow stats
   */
  async getStats(): Promise<{
    totalEscrows: number;
    totalLocked: string;
    totalSpent: string;
    totalRefunded: string;
    totalAvailable: string;
    unsettledCount: number;
  }> {
    const [totalEscrows, unsettledCount] = await Promise.all([
      this.count(),
      this.count({ isSettled: false }),
    ]);

    const escrows = await this.findAll();

    let totalLocked = decimal('0');
    let totalSpent = decimal('0');
    let totalRefunded = decimal('0');
    let totalAvailable = decimal('0');

    for (const escrow of escrows) {
      totalLocked = add(totalLocked, escrow.lockedAmount);
      totalSpent = add(totalSpent, escrow.spentAmount);
      totalRefunded = add(totalRefunded, escrow.refundedAmount);
      totalAvailable = add(totalAvailable, escrow.availableAmount);
    }

    return {
      totalEscrows,
      totalLocked: toDbString(totalLocked, 8),
      totalSpent: toDbString(totalSpent, 8),
      totalRefunded: toDbString(totalRefunded, 8),
      totalAvailable: toDbString(totalAvailable, 8),
      unsettledCount,
    };
  }
}
