import { Injectable } from '@nestjs/common';
import { IBalanceService } from '../interfaces/balance.service.interface';
import { UserBalanceRepository, UserBalanceHistoryRepository } from '@app/database';
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
    const balance = await this.userBalanceRepository.findOne({ userId: Number(userId) });
    
    if (!balance) {
      // Create initial balance if not exists
      const newBalance = await this.userBalanceRepository.create({
        userId: Number(userId),
        balance: 0,
      });
      return { amount: newBalance.balance, currency: 'RUB' };
    }

    return { amount: balance.balance, currency: 'RUB' };
  }

  async getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]> {
    const queryBuilder = this.userBalanceHistoryRepository
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId: Number(userId) })
      .orderBy('history.createdAt', 'DESC');

    // Apply filters
    if (filter.type) {
      queryBuilder.andWhere('history.operationType = :type', { type: filter.type });
    }

    if (filter.startDate) {
      queryBuilder.andWhere('history.createdAt >= :startDate', { startDate: filter.startDate });
    }

    if (filter.endDate) {
      queryBuilder.andWhere('history.createdAt <= :endDate', { endDate: filter.endDate });
    }

    const transactions = await queryBuilder.getMany();

    return transactions.map(transaction => ({
      id: String(transaction.id),
      amount: transaction.amount,
      type: this.mapTransactionType(transaction.operationType),
      date: transaction.createdAt,
      description: transaction.description || 'Transaction',
      orderId: transaction.orderId ? String(transaction.orderId) : undefined,
    }));
  }

  async requestDeposit(userId: string, request: DepositRequestDto): Promise<{ paymentUrl: string }> {
    // Create pending deposit transaction
    await this.userBalanceHistoryRepository.create({
      userId: Number(userId),
      operationType: 'deposit',
      amount: request.amount,
      status: 'pending',
      description: `Deposit request via ${request.paymentMethod}`,
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

    // Create pending withdrawal transaction
    const transaction = await this.userBalanceHistoryRepository.create({
      userId: Number(userId),
      operationType: 'withdrawal',
      amount: -request.amount,
      status: 'pending',
      description: `Withdrawal request to ${request.destination}`,
    });

    return { transactionId: String(transaction.id) };
  }

  private mapTransactionType(operationType: string): TransactionType {
    switch (operationType) {
      case 'deposit':
        return TransactionType.DEPOSIT;
      case 'withdrawal':
        return TransactionType.WITHDRAWAL;
      case 'traffic_sale_income':
        return TransactionType.TRAFFIC_SALE_INCOME;
      case 'traffic_purchase_expense':
        return TransactionType.TRAFFIC_PURCHASE_EXPENSE;
      case 'referral_bonus':
        return TransactionType.REFERRAL_BONUS;
      default:
        return TransactionType.DEPOSIT;
    }
  }
}