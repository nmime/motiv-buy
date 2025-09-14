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
  PaymentMethod,
} from '../dto';

@Injectable()
export class BalanceService implements IBalanceService {
  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
  ) {}

  async getBalance(userId: string): Promise<BalanceDto> {
    const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.RUB);

    if (!balance) {
      // Create initial balance if not exists
      const newBalance = await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyType.RUB, '0');

      return { amount: parseFloat(newBalance.balance), currency: 'RUB' };
    }

    return { amount: parseFloat(balance.balance), currency: 'RUB' };
  }

  async getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]> {
    let transactions;

    if (filter.type) {
      const dbType = this.mapToDbTransactionType(filter.type);
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId, // Assuming this method accepts userId directly
        CurrencyType.RUB,
        dbType,
        50,
      );
    } else {
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId,
        CurrencyType.RUB,
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
    const currentBalance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.RUB);
    const balanceBefore = currentBalance ? currentBalance.balance : '0';
    const balanceAfter = (parseFloat(balanceBefore) + request.amount).toString();

    // Create pending deposit transaction
    await this.userBalanceHistoryRepository.createTransaction({
      userId,
      currency: CurrencyType.RUB,
      type: DbTransactionType.Deposit,
      amount: request.amount.toString(),
      balanceBefore,
      balanceAfter,
      status: TransactionStatus.Pending,
      description: `Deposit request via ${request.paymentMethod}`,
      referenceId: `deposit-${userId}-${Date.now()}`,
    });

    // TODO: Integrate with actual payment gateway
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
      currency: CurrencyType.RUB,
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
        return TransactionType.DEPOSIT;
      case DbTransactionType.Withdrawal:
        return TransactionType.WITHDRAWAL;
      case DbTransactionType.ReferralBonus:
        return TransactionType.REFERRAL_BONUS;
      default:
        return TransactionType.DEPOSIT;
    }
  }

  private mapToDbTransactionType(type: TransactionType): DbTransactionType {
    switch (type) {
      case TransactionType.DEPOSIT:
        return DbTransactionType.Deposit;
      case TransactionType.WITHDRAWAL:
        return DbTransactionType.Withdrawal;
      case TransactionType.REFERRAL_BONUS:
        return DbTransactionType.ReferralBonus;
      default:
        return DbTransactionType.Deposit;
    }
  }
}
