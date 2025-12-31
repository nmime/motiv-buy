/**
 * User Balance Operation Service
 *
 * Provides operations for user balance management including
 * querying, locking, and unlocking funds.
 * Supports both standalone usage and usage with forked EntityManagers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MikroORM, EntityManager } from '@mikro-orm/core';
import { UserBalanceEntity, CurrencyEntity, CurrencyCode, TrafficOrderBalanceEntity } from '@app/database';
import {
  add,
  subtract,
  greaterThanOrEqual,
  decimal,
  toDbString,
  toDisplayString,
  multiply,
  divide,
} from '@app/common-shared';

/**
 * Balance summary with formatted display values
 */
export interface BalanceSummary {
  available: string;
  locked: string;
  total: string;
}

/**
 * Result of a lock operation with details about which currency was used
 */
export interface LockResult {
  success: boolean;
  currencyCode?: CurrencyCode;
  lockedAmount?: string; // Amount locked in the source currency
  usdEquivalent?: string; // USD equivalent that was requested
}

@Injectable()
export class UserBalanceOperationService {
  private readonly logger = new Logger(UserBalanceOperationService.name);

  constructor(private readonly orm: MikroORM) {}

  /**
   * Get a forked EntityManager for context-safe database operations
   */
  private get em(): EntityManager {
    return this.orm.em.fork();
  }

  /**
   * Get all balances for a user
   */
  async getUserBalances(userId: string): Promise<UserBalanceEntity[]> {
    return this.getUserBalancesWithEm(this.em, userId);
  }

  /**
   * Get all balances for a user with a specific EntityManager
   */
  async getUserBalancesWithEm(em: EntityManager, userId: string): Promise<UserBalanceEntity[]> {
    return em.find(UserBalanceEntity, { user: userId }, { populate: ['currency'] });
  }

  /**
   * Find user balance by user ID and currency code
   */
  async findUserBalance(userId: string, currencyCode: CurrencyCode): Promise<UserBalanceEntity | null> {
    return this.findUserBalanceWithEm(this.em, userId, currencyCode);
  }

  /**
   * Find user balance with a specific EntityManager
   */
  async findUserBalanceWithEm(
    em: EntityManager,
    userId: string,
    currencyCode: CurrencyCode,
  ): Promise<UserBalanceEntity | null> {
    const balances = await em.find(UserBalanceEntity, { user: userId }, { populate: ['currency'] });

    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (currency?.code === currencyCode) {
        return balance;
      }
    }

    return null;
  }

  /**
   * Lock balance for order (amount in USD)
   * Finds user's balance in any currency and locks equivalent amount
   * @param userId - User ID
   * @param _baseCurrency - Base currency (USD) - used for logging only
   * @param usdAmount - Amount to lock in USD equivalent
   */
  async lockBalance(userId: string, _baseCurrency: CurrencyCode, usdAmount: string): Promise<boolean> {
    const result = await this.lockBalanceWithEm(this.em, userId, _baseCurrency, usdAmount);

    return result.success;
  }

  /**
   * Lock balance with a specific EntityManager
   * Locks from ANY currency balance the user has, converting USD amount to that currency
   * @param em - EntityManager
   * @param userId - User ID
   * @param _baseCurrency - Base currency (USD) - used for logging only
   * @param usdAmount - Amount to lock in USD equivalent
   * @returns LockResult with details about which currency was used
   */
  async lockBalanceWithEm(
    em: EntityManager,
    userId: string,
    _baseCurrency: CurrencyCode,
    usdAmount: string,
  ): Promise<LockResult> {
    const balances = await this.getUserBalancesWithEm(em, userId);

    if (balances.length === 0) {
      this.logger.warn('No balances found for user', { userId });

      return { success: false };
    }

    const requiredUsd = decimal(usdAmount);

    // Find a balance with enough funds (converted to USD)
    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const availableBalance = decimal(balance.balance);
      const rateToUsd = decimal(currency.rateToUsd);

      // Calculate available in USD
      const availableUsd = multiply(availableBalance, rateToUsd);

      if (greaterThanOrEqual(availableUsd, requiredUsd)) {
        // This balance has enough - convert USD amount to this currency
        // If rateToUsd is 1 (like USDT), then lockAmount = usdAmount
        // If rateToUsd is 0.01, then lockAmount = usdAmount / 0.01 = usdAmount * 100
        const lockAmountInCurrency = divide(requiredUsd, rateToUsd);
        const lockAmountStr = toDbString(lockAmountInCurrency, 8);

        // Lock the balance
        balance.balance = toDbString(subtract(availableBalance, lockAmountInCurrency), 8);
        balance.lockedBalance = toDbString(add(balance.lockedBalance, lockAmountInCurrency), 8);
        // eslint-disable-next-line no-await-in-loop -- Intentional: flush only after finding suitable balance, then return
        await em.flush();

        this.logger.log('Balance locked', {
          userId,
          currency: currency.code,
          lockedAmount: lockAmountStr,
          usdEquivalent: usdAmount,
          newBalance: balance.balance,
        });

        return {
          success: true,
          currencyCode: currency.code,
          lockedAmount: lockAmountStr,
          usdEquivalent: usdAmount,
        };
      }
    }

    // No single balance has enough - log available balances for debugging
    this.logger.warn('Insufficient balance for locking', {
      userId,
      requiredUsd: usdAmount,
      balances: await Promise.all(
        balances.map(async (b) => {
          const curr = await b.currency.load();

          return {
            currency: curr?.code,
            available: b.balance,
            availableUsd: curr ? toDisplayString(multiply(b.balance, curr.rateToUsd), 2) : '0',
          };
        }),
      ),
    });

    return { success: false };
  }

  /**
   * Unlock balance (refund) - amount in USD
   * Finds user's locked balance in any currency and unlocks equivalent amount
   * @param userId - User ID
   * @param _baseCurrency - Base currency (USD) - used for logging only
   * @param usdAmount - Amount to unlock in USD equivalent
   */
  async unlockBalance(userId: string, _baseCurrency: CurrencyCode, usdAmount: string): Promise<boolean> {
    return this.unlockBalanceWithEm(this.em, userId, _baseCurrency, usdAmount);
  }

  /**
   * Unlock balance with a specific EntityManager
   * Unlocks from ANY currency balance that has locked funds
   * @param em - EntityManager
   * @param userId - User ID
   * @param _baseCurrency - Base currency (USD) - used for logging only
   * @param usdAmount - Amount to unlock in USD equivalent
   */
  async unlockBalanceWithEm(
    em: EntityManager,
    userId: string,
    _baseCurrency: CurrencyCode,
    usdAmount: string,
  ): Promise<boolean> {
    const balances = await this.getUserBalancesWithEm(em, userId);

    if (balances.length === 0) {
      this.logger.warn('No balances found for user', { userId });

      return false;
    }

    const requiredUsd = decimal(usdAmount);

    // Find a balance with enough locked funds (converted to USD)
    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const lockedBalance = decimal(balance.lockedBalance);
      const rateToUsd = decimal(currency.rateToUsd);

      // Calculate locked in USD
      const lockedUsd = multiply(lockedBalance, rateToUsd);

      if (greaterThanOrEqual(lockedUsd, requiredUsd)) {
        // This balance has enough locked - convert USD amount to this currency
        const unlockAmountInCurrency = divide(requiredUsd, rateToUsd);
        const unlockAmountStr = toDbString(unlockAmountInCurrency, 8);

        // Unlock the balance
        balance.lockedBalance = toDbString(subtract(lockedBalance, unlockAmountInCurrency), 8);
        balance.balance = toDbString(add(balance.balance, unlockAmountInCurrency), 8);
        // eslint-disable-next-line no-await-in-loop -- Intentional: flush only after finding suitable balance, then return
        await em.flush();

        this.logger.log('Balance unlocked', {
          userId,
          currency: currency.code,
          unlockedAmount: unlockAmountStr,
          usdEquivalent: usdAmount,
          newBalance: balance.balance,
        });

        return true;
      }
    }

    // No single balance has enough locked - log for debugging
    this.logger.warn('Insufficient locked balance for unlocking', {
      userId,
      requiredUsd: usdAmount,
      balances: await Promise.all(
        balances.map(async (b) => {
          const curr = await b.currency.load();

          return {
            currency: curr?.code,
            locked: b.lockedBalance,
            lockedUsd: curr ? toDisplayString(multiply(b.lockedBalance, curr.rateToUsd), 2) : '0',
          };
        }),
      ),
    });

    return false;
  }

  /**
   * Create TrafficOrderBalance record
   */
  async createOrderBalanceWithEm(
    em: EntityManager,
    orderId: string,
    currencyCode: CurrencyCode,
    lockedAmount: string,
  ): Promise<TrafficOrderBalanceEntity> {
    const currency = await em.findOne(CurrencyEntity, { code: currencyCode });
    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    const orderBalance = new TrafficOrderBalanceEntity({
      trafficOrderId: orderId,
      currencyId: currency.id,
      lockedAmount,
      availableAmount: lockedAmount,
      spentAmount: '0',
      refundedAmount: '0',
      isSettled: false,
    });

    em.persist(orderBalance);
    await em.flush();

    return orderBalance;
  }

  /**
   * Refund remaining order balance
   * @returns The refunded amount as string
   */
  async refundOrderBalanceWithEm(em: EntityManager, orderId: string): Promise<string> {
    const orderBalance = await em.findOne(TrafficOrderBalanceEntity, { trafficOrder: orderId });

    if (!orderBalance || orderBalance.isSettled) {
      return '0';
    }

    const { availableAmount } = orderBalance;
    if (decimal(availableAmount).greaterThan('0')) {
      orderBalance.refundedAmount = toDbString(add(orderBalance.refundedAmount, availableAmount), 8);
      orderBalance.availableAmount = '0';
    }

    orderBalance.isSettled = true;
    orderBalance.settledAt = new Date();
    await em.flush();

    return availableAmount;
  }

  /**
   * Get balance summary for a user - sums ALL currency balances converted to USD
   * Returns formatted display values (2 decimal places)
   * This is the SINGLE SOURCE OF TRUTH for balance display
   */
  async getBalanceSummary(userId: string, _currencyCode: CurrencyCode): Promise<BalanceSummary> {
    return this.getBalanceSummaryWithEm(this.em, userId, _currencyCode);
  }

  /**
   * Get balance summary with a specific EntityManager
   * Sums ALL currency balances converted to USD using rateToUsd
   */
  async getBalanceSummaryWithEm(
    em: EntityManager,
    userId: string,
    _currencyCode: CurrencyCode,
  ): Promise<BalanceSummary> {
    const balances = await this.getUserBalancesWithEm(em, userId);

    if (balances.length === 0) {
      return { available: '0.00', locked: '0.00', total: '0.00' };
    }

    let totalAvailable = decimal(0);
    let totalLocked = decimal(0);

    for (const balance of balances) {
      // eslint-disable-next-line no-await-in-loop -- MikroORM lazy reference loading must be sequential
      const currency = await balance.currency.load();
      if (!currency) {
        continue;
      }

      const available = decimal(balance.balance);
      const locked = decimal(balance.lockedBalance);

      // Convert to USD using rateToUsd (1 unit = X USD)
      const rateToUsd = decimal(currency.rateToUsd);
      totalAvailable = add(totalAvailable, multiply(available, rateToUsd));
      totalLocked = add(totalLocked, multiply(locked, rateToUsd));
    }

    const total = add(totalAvailable, totalLocked);

    return {
      available: toDisplayString(totalAvailable, 2),
      locked: toDisplayString(totalLocked, 2),
      total: toDisplayString(total, 2),
    };
  }
}
