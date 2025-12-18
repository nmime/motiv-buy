import { Injectable } from '@nestjs/common';
import {
  CurrencyCode,
  TransactionStatus,
  TransactionType,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
} from '@app/database';
import { decimal, ensureNonNegative, subtract, sum, toNumber } from '@app/common-shared';
import { BalanceDto } from '../dto/balance.dto';

/**
 * Balance Query Service
 *
 * Read-only service for querying user balance information.
 * Can be used by any module without circular dependencies.
 */
@Injectable()
export class BalanceQueryService {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
  ) {}

  /**
   * Get user balance with all details
   */
  async getBalance(userId: string): Promise<BalanceDto> {
    const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyCode.Rub);

    if (!balance) {
      await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyCode.Rub, '0');

      return {
        userId,
        amount: 0,
        currency: 'RUB',
        availableAmount: 0,
        pendingAmount: 0,
        totalEarned: 0,
      };
    }

    const currentAmount = decimal(balance.balance);

    const pendingWithdrawals = await this.userBalanceHistoryRepository.getUserTransactionHistory(
      userId,
      CurrencyCode.Rub,
      TransactionType.Withdrawal,
      100,
    );

    const pendingAmountDecimal = sum(
      pendingWithdrawals.filter((t) => t.status === TransactionStatus.Pending).map((t) => t.amount),
    );

    const allTransactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
      userId,
      CurrencyCode.Rub,
      undefined,
      1000,
    );

    const totalEarnedDecimal = sum(
      allTransactions
        .filter(
          (t) =>
            t.status === TransactionStatus.Completed &&
            (t.type === TransactionType.Deposit || t.type === TransactionType.ReferralBonus),
        )
        .map((t) => t.amount),
    );

    const lastTransaction = allTransactions.length > 0 ? allTransactions[0] : null;
    const availableAmountDecimal = ensureNonNegative(subtract(currentAmount, pendingAmountDecimal));

    return {
      userId,
      amount: toNumber(currentAmount),
      currency: 'RUB',
      availableAmount: toNumber(availableAmountDecimal),
      pendingAmount: toNumber(pendingAmountDecimal),
      totalEarned: toNumber(totalEarnedDecimal),
      lastTransactionAt: lastTransaction?.createdAt,
    };
  }
}
