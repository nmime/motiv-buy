import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { TrafficSourceBalanceEntity } from '../entity/TrafficSourceBalance.entity';
import { TrafficSourceEntity } from '../entity/TrafficSource.entity';
import { CurrencyCode, CurrencyEntity } from '../entity/Currency.entity';
import { add, greaterThanOrEqual, subtract, toDbString } from '@app/common-shared';

export class TrafficSourceBalanceRepository extends EntityRepository<TrafficSourceBalanceEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficSourceBalanceEntity);
  }

  async findBySourceAndCurrency(
    sourceId: string,
    currencyCode: CurrencyCode,
  ): Promise<TrafficSourceBalanceEntity | null> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      return null;
    }

    return this.findOne({ trafficSource: sourceId, currency: currency.id });
  }

  async getOrCreateBalance(sourceId: string, currencyCode: CurrencyCode): Promise<TrafficSourceBalanceEntity> {
    const currency = await this.em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      throw new Error(`Currency with code ${currencyCode} not found`);
    }

    let balance = await this.findOne({ trafficSource: sourceId, currency: currency.id });

    if (!balance) {
      const sourceRef = this.em.getReference(TrafficSourceEntity, sourceId);
      const currencyRef = this.em.getReference(CurrencyEntity, currency.id);

      balance = new TrafficSourceBalanceEntity({
        trafficSource: ref(sourceRef),
        currency: ref(currencyRef),
      });

      this.em.persist(balance);
      await this.em.flush();
    }

    return balance;
  }

  /**
   * Add reward to source balance (called when task is completed)
   */
  async addReward(sourceId: string, currencyCode: CurrencyCode, amount: string): Promise<TrafficSourceBalanceEntity> {
    const balance = await this.getOrCreateBalance(sourceId, currencyCode);

    balance.balance = toDbString(add(balance.balance, amount), 8);
    balance.totalEarned = toDbString(add(balance.totalEarned, amount), 8);

    await this.em.flush();

    return balance;
  }

  /**
   * Add pending reward (awaiting verification)
   */
  async addPendingReward(
    sourceId: string,
    currencyCode: CurrencyCode,
    amount: string,
  ): Promise<TrafficSourceBalanceEntity> {
    const balance = await this.getOrCreateBalance(sourceId, currencyCode);

    balance.pendingBalance = toDbString(add(balance.pendingBalance, amount), 8);

    await this.em.flush();

    return balance;
  }

  /**
   * Convert pending to available balance (after verification)
   */
  async confirmPendingReward(
    sourceId: string,
    currencyCode: CurrencyCode,
    amount: string,
  ): Promise<TrafficSourceBalanceEntity | null> {
    const balance = await this.findBySourceAndCurrency(sourceId, currencyCode);
    if (!balance) {
      return null;
    }

    if (!greaterThanOrEqual(balance.pendingBalance, amount)) {
      throw new Error('Insufficient pending balance');
    }

    balance.pendingBalance = toDbString(subtract(balance.pendingBalance, amount), 8);
    balance.balance = toDbString(add(balance.balance, amount), 8);
    balance.totalEarned = toDbString(add(balance.totalEarned, amount), 8);

    await this.em.flush();

    return balance;
  }

  /**
   * Withdraw from source balance (transfer to user balance)
   */
  async withdraw(sourceId: string, currencyCode: CurrencyCode, amount: string): Promise<boolean> {
    const balance = await this.findBySourceAndCurrency(sourceId, currencyCode);
    if (!balance) {
      return false;
    }

    if (!greaterThanOrEqual(balance.balance, amount)) {
      return false;
    }

    balance.balance = toDbString(subtract(balance.balance, amount), 8);
    balance.totalWithdrawn = toDbString(add(balance.totalWithdrawn, amount), 8);

    await this.em.flush();

    return true;
  }

  /**
   * Get all balances for a source
   */
  async getSourceBalances(sourceId: string): Promise<TrafficSourceBalanceEntity[]> {
    return this.find({ trafficSource: sourceId }, { populate: ['currency'] });
  }

  /**
   * Get balance summary for a source
   */
  async getBalanceSummary(
    sourceId: string,
  ): Promise<
    Record<CurrencyCode, { available: string; pending: string; totalEarned: string; totalWithdrawn: string }>
  > {
    const balances = await this.getSourceBalances(sourceId);
    const summary: Record<string, { available: string; pending: string; totalEarned: string; totalWithdrawn: string }> =
      {};

    for (const balance of balances) {
      const currencyEntity = balance.currency.getEntity();
      summary[currencyEntity.code] = {
        available: balance.balance,
        pending: balance.pendingBalance,
        totalEarned: balance.totalEarned,
        totalWithdrawn: balance.totalWithdrawn,
      };
    }

    return summary;
  }
}
