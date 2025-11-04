import { Injectable, Logger } from '@nestjs/common';
import { IBalanceService } from '../interfaces/balance.service.interface';
import {
  UserBalanceRepository,
  UserBalanceHistoryRepository,
  CurrencyCode,
  TransactionType as DbTransactionType,
  TransactionStatus,
} from '@app/database';
import { PaymentService } from '@app/feature-payment-main';
import { CreateInvoiceDto, CreateTransferDto } from '@app/feature-payment-shared';
import { CurrencyRateService } from './currency-rate.service';
import { Result, Ok, Err } from '@app/common-shared';
import { decimal, sum, subtract, ensureNonNegative, toNumber } from '@app/common-shared/util';
import { BalanceDto, TransactionDto, TransactionFilterDto, TransactionType } from '../dto';
import { TopUpRequestDto } from '../dto/topup-request.dto';
import { WithdrawRequestDto } from '../dto/withdraw-request.dto';

/**
 * Balance service with integrated payment processing
 * Handles balance operations, topup via payment invoices, and withdrawals
 */
@Injectable()
export class BalanceService implements IBalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
    private readonly paymentService: PaymentService,
    private readonly currencyRateService: CurrencyRateService,
  ) {}

  /**
   * Get user balance with all details
   */
  async getBalance(userId: string): Promise<BalanceDto> {
    const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyCode.Rub);

    if (!balance) {
      // Create initial balance if not exists
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

    // Get pending withdrawals to calculate available amount
    const pendingWithdrawals = await this.userBalanceHistoryRepository.getUserTransactionHistory(
      userId,
      CurrencyCode.Rub,
      DbTransactionType.Withdrawal,
      100,
    );

    const pendingAmountDecimal = sum(
      pendingWithdrawals
        .filter((t) => t.status === TransactionStatus.Pending)
        .map((t) => t.amount)
    );

    // Get all completed income transactions for total earned
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
            (t.type === DbTransactionType.Deposit || t.type === DbTransactionType.ReferralBonus),
        )
        .map((t) => t.amount)
    );

    // Get last transaction date
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

  /**
   * Get transaction history with filtering
   */
  async getTransactionHistory(userId: string, filter: TransactionFilterDto): Promise<TransactionDto[]> {
    let transactions;

    if (filter.type) {
      const dbType = this.mapToDbTransactionType(filter.type);
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId,
        CurrencyCode.Rub,
        dbType,
        50,
      );
    } else {
      transactions = await this.userBalanceHistoryRepository.getUserTransactionHistory(
        userId,
        CurrencyCode.Rub,
        undefined,
        50,
      );
    }

    return transactions.map((transaction) => ({
      id: transaction.id,
      amount: toNumber(decimal(transaction.amount)),
      type: this.mapFromDbTransactionType(transaction.type),
      date: transaction.createdAt,
      description: transaction.description || 'Transaction',
      orderId: transaction.referenceId,
    }));
  }

  /**
   * Request top-up via cryptocurrency payment
   * Creates invoice and returns payment URL
   */
  async requestTopUp(
    userId: string,
    request: TopUpRequestDto,
  ): Promise<Result<{ paymentUrl: string; invoiceId: string; rubAmount: string }, Error>> {
    try {
      this.logger.log(`Creating top-up request for user ${userId}: ${request.amount} ${request.currency}`);

      // Convert crypto amount to RUB
      const rubAmountResult = await this.currencyRateService.convertAmount(
        request.amount,
        request.currency,
        CurrencyCode.Rub,
      );

      if (rubAmountResult.err) {
        this.logger.error('Failed to convert currency', rubAmountResult.val);

        return Err(rubAmountResult.val);
      }

      const rubAmount = rubAmountResult.val;

      // Create invoice via payment service
      const invoiceDto: CreateInvoiceDto = {
        amount: request.amount,
        currency: request.currency,
        description: request.description || `Balance top-up ${request.amount} ${request.currency}`,
        expiresIn: 3600, // 1 hour
      };

      const invoiceResult = await this.paymentService.createTopUp(userId, invoiceDto);

      if (invoiceResult.err) {
        this.logger.error('Failed to create invoice', invoiceResult.val);

        return Err(invoiceResult.val);
      }

      const invoice = invoiceResult.val;

      this.logger.log(
        `Top-up invoice created: ${invoice.id}, payment URL: ${invoice.payUrl}, RUB equivalent: ${rubAmount}`,
      );

      return Ok({
        paymentUrl: invoice.payUrl,
        invoiceId: invoice.id,
        rubAmount,
      });
    } catch (error) {
      this.logger.error('Error creating top-up request', error);

      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Request withdrawal to cryptocurrency wallet
   * Validates balance, converts to crypto, and initiates transfer
   */
  async requestWithdrawal(
    userId: string,
    request: WithdrawRequestDto,
  ): Promise<Result<{ transferId: string; cryptoAmount: string }, Error>> {
    try {
      this.logger.log(`Creating withdrawal request for user ${userId}: ${request.amount} RUB to ${request.currency}`);

      // Check balance
      const balance = await this.getBalance(userId);

      if (balance.availableAmount < request.amount) {
        this.logger.warn(
          `Insufficient balance for withdrawal. Available: ${balance.availableAmount}, Requested: ${request.amount}`,
        );

        return Err(
          new Error(
            `Insufficient balance. Available: ${balance.availableAmount} RUB, Requested: ${request.amount} RUB`,
          ),
        );
      }

      // Convert RUB to cryptocurrency
      const cryptoAmountResult = await this.currencyRateService.convertAmount(
        request.amount.toString(),
        CurrencyCode.Rub,
        request.currency,
      );

      if (cryptoAmountResult.err) {
        this.logger.error('Failed to convert currency', cryptoAmountResult.val);

        return Err(cryptoAmountResult.val);
      }

      const cryptoAmount = cryptoAmountResult.val;

      // Create transfer via payment service
      const transferDto: CreateTransferDto = {
        userId: request.telegramUserId.toString(),
        amount: cryptoAmount,
        currency: request.currency,
        comment: request.comment || `Withdrawal from balance: ${request.amount} RUB`,
      };

      const transferResult = await this.paymentService.createWithdrawal(userId, transferDto);

      if (transferResult.err) {
        this.logger.error('Failed to create withdrawal', transferResult.val);

        return Err(transferResult.val);
      }

      const transfer = transferResult.val;

      this.logger.log(`Withdrawal created: ${transfer.id}, crypto amount: ${cryptoAmount} ${request.currency}`);

      return Ok({
        transferId: transfer.id,
        cryptoAmount,
      });
    } catch (error) {
      this.logger.error('Error creating withdrawal request', error);

      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Map database transaction type to DTO transaction type
   */
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

  /**
   * Map DTO transaction type to database transaction type
   */
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
