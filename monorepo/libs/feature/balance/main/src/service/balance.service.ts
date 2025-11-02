import { Injectable } from '@nestjs/common';
import { IBalanceService } from '../interfaces/balance.service.interface';
import {
  UserBalanceRepository,
  UserBalanceHistoryRepository,
  CurrencyType,
  TransactionType as DbTransactionType,
  TransactionStatus,
} from '@app/database';
import {
  BalanceDto,
  TransactionDto,
  TransactionFilterDto,
  DepositRequestDto,
  WithdrawalRequestDto,
  TransactionType,
} from '../dto';

@Injectable()
export class BalanceService implements IBalanceService {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
  ) {}

  async getBalance(userId: string): Promise<BalanceDto> {
    const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.Rub);

    if (!balance) {
      // Create initial balance if not exists
      await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyType.Rub, '0');

      return {
        userId,
        amount: 0,
        currency: 'RUB',
        availableAmount: 0,
        pendingAmount: 0,
        totalEarned: 0,
      };
    }

    const currentAmount = parseFloat(balance.balance);

    // Get pending withdrawals to calculate available amount
    const pendingWithdrawals = await this.userBalanceHistoryRepository.getUserTransactionHistory(
      userId,
      CurrencyType.Rub,
      DbTransactionType.Withdrawal,
      100,
    );

    const pendingAmount = pendingWithdrawals
      .filter((t) => t.status === TransactionStatus.Pending)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Get all completed income transactions for total earned
    const allTransactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
      userId,
      CurrencyType.Rub,
      undefined,
      1000,
    );

    const totalEarned = allTransactions
      .filter(
        (t) =>
          t.status === TransactionStatus.Completed &&
          (t.type === DbTransactionType.Deposit || t.type === DbTransactionType.ReferralBonus),
      )
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Get last transaction date
    const lastTransaction = allTransactions.length > 0 ? allTransactions[0] : null;

    return {
      userId,
      amount: currentAmount,
      currency: 'RUB',
      availableAmount: Math.max(0, currentAmount - pendingAmount),
      pendingAmount,
      totalEarned,
      lastTransactionAt: lastTransaction?.createdAt,
    };
  }

  async getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]> {
    let transactions;

    if (filter.type) {
      const dbType = this.mapToDbTransactionType(filter.type);
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId, // Assuming this method accepts userId directly
        CurrencyType.Rub,
        dbType,
        50,
      );
    } else {
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId,
        CurrencyType.Rub,
        undefined,
        50,
      );
    }

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: parseFloat(transaction.amount),
      type: this.mapFromDbTransactionType(transaction.type),
      date: transaction.createdAt,
      description: transaction.description || 'Transaction',
      orderId: transaction.referenceId,
    }));
  }

  async requestDeposit(userId: string, request: DepositRequestDto): Promise<{ paymentUrl: string }> {
    const currentBalance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.Rub);
    const balanceBefore = currentBalance ? currentBalance.balance : '0';
    const balanceAfter = (parseFloat(balanceBefore) + request.amount).toString();

    // Create pending deposit transaction
    await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyType.Rub,
      type: DbTransactionType.Deposit,
      amount: request.amount.toString(),
      balanceBefore,
      balanceAfter,
      status: TransactionStatus.Pending,
      description: `Deposit request via ${request.paymentMethod}`,
      referenceId: `deposit-${userId}-${Date.now()}`,
    });

    /**
     * TODO: Payment Gateway Integration
     *
     * DEFERRED: Payment provider integration pending business requirements
     *
     * Requirements for implementation:
     * 1. Select payment provider (Stripe, YooKassa, etc.)
     * 2. Implement secure webhook handlers for payment status updates
     * 3. Add transaction reconciliation logic
     * 4. Implement refund and chargeback handling
     * 5. Add PCI compliance measures
     * 6. Set up environment-specific API keys configuration
     *
     * Current behavior: Returns mock payment URL for development
     * Risk: Production deployment requires actual payment integration
     */
    const paymentUrl = `https://payment.gateway/deposit/${userId}-${Date.now()}`;

    return { paymentUrl };
  }

  async requestWithdrawal(userId: string, request: WithdrawalRequestDto): Promise<{ transactionId: string }> {
    const currentBalance = await this.getBalance(userId);

    if (currentBalance.amount < request.amount) {
      throw new Error('Insufficient balance');
    }

    const balanceBefore = currentBalance.amount.toString();
    const balanceAfter = (currentBalance.amount - request.amount).toString();

    // Create pending withdrawal transaction
    const transaction = await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyType.Rub,
      type: DbTransactionType.Withdrawal,
      amount: request.amount.toString(),
      balanceBefore,
      balanceAfter,
      status: TransactionStatus.Pending,
      description: `Withdrawal request to ${request.destination}`,
      referenceId: `withdrawal-${userId}-${Date.now()}`,
    });

    return { transactionId: transaction.id };
  }

  private mapFromDbTransactionType(dbType: DbTransactionType): TransactionType {
    switch (dbType) {
      case DbTransactionType.Deposit:
        return TransactionType.Deposit;
      case DbTransactionType.Withdrawal:
        return TransactionType.Withdrawal;
      case DbTransactionType.ReferralBonus:
        return TransactionType.TrafficSaleIncome;
      default:
        return TransactionType.Deposit;
    }
  }

  private mapToDbTransactionType(type: TransactionType): DbTransactionType {
    switch (type) {
      case TransactionType.Deposit:
        return DbTransactionType.Deposit;
      case TransactionType.Withdrawal:
        return DbTransactionType.Withdrawal;
      case TransactionType.TrafficSaleIncome:
        return DbTransactionType.ReferralBonus;
      case TransactionType.TrafficBuyExpense:
        return DbTransactionType.Deposit;
      default:
        return DbTransactionType.Deposit;
    }
  }
}
