import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Result, Ok, Err, AsyncResult, toError } from '@app/common-shared';
import { PaymentTransactionEntity } from '../entity/payment-transaction.entity';
import { CryptoBotProvider } from '../provider/crypto-bot.provider';
import { UserBalanceRepository, CurrencyType } from '@app/database';
import {
  CreateInvoiceDto,
  CreateTransferDto,
  WebhookUpdateDto,
  InvoiceResponseDto,
  TransferResponseDto,
  PaymentStatus,
  PaymentType,
  PaymentProvider,
} from '@app/feature-payment-shared';

/**
 * Transaction query filter options
 */
export interface TransactionQueryOptions {
  type?: PaymentType;
  status?: PaymentStatus;
  limit?: number;
  offset?: number;
}

/**
 * Transaction list response with pagination metadata
 */
export interface TransactionListResponse {
  transactions: PaymentTransactionEntity[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * PaymentService - Comprehensive payment processing service
 * Handles cryptocurrency payments, invoices, transfers, and balance management
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransactionEntity)
    private readonly transactionRepository: EntityRepository<PaymentTransactionEntity>,
    private readonly provider: CryptoBotProvider,
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly em: EntityManager,
  ) {}

  /**
   * Create top-up invoice for user
   * Generates payment link and stores pending transaction
   */
  async createTopUp(userId: string, dto: CreateInvoiceDto): AsyncResult<InvoiceResponseDto, Error> {
    try {
      this.logger.log(`Creating top-up invoice for user ${userId}: ${dto.amount} ${dto.currency}`);

      // Create invoice via payment provider
      const invoiceResult = await this.provider.createInvoice({
        userId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        expiresIn: dto.expiresIn,
      });

      if (invoiceResult.err) {
        this.logger.error('Failed to create invoice with provider', invoiceResult.val);
        return Err(toError(invoiceResult.val || 'Failed to create invoice with payment provider'));
      }

      const invoice = invoiceResult.val;

      // Save transaction to database
      const transaction = this.transactionRepository.create({
        userId,
        type: PaymentType.TopUp,
        provider: PaymentProvider.CryptoBot,
        providerTransactionId: invoice.invoiceId,
        amount: dto.amount,
        currency: dto.currency,
        status: PaymentStatus.Pending,
        payUrl: invoice.payUrl,
        description: dto.description || `Top-up ${dto.amount} ${dto.currency}`,
        expiresAt: invoice.expiresAt,
        metadata: {
          expiresIn: dto.expiresIn,
        },
      });

      await this.em.persistAndFlush(transaction);

      this.logger.log(`Top-up invoice created: ${transaction.id} (provider: ${invoice.invoiceId})`);

      // Return response DTO
      const response: InvoiceResponseDto = {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        payUrl: transaction.payUrl!,
        description: transaction.description || undefined,
        createdAt: transaction.createdAt.toISOString(),
        expiresAt: transaction.expiresAt!.toISOString(),
      };

      return Ok(response);
    } catch (error) {
      this.logger.error('Error creating top-up invoice', error);
      return Err(toError(error));
    }
  }

  /**
   * Create withdrawal transfer for user
   * Validates balance, deducts amount, and initiates transfer
   */
  async createWithdrawal(userId: string, dto: CreateTransferDto): AsyncResult<TransferResponseDto, Error> {
    try {
      this.logger.log(`Creating withdrawal for user ${userId}: ${dto.amount} ${dto.currency}`);

      // Check user balance
      const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.Rub);

      if (!balance) {
        throw new Error(`Balance not found for user ${userId}`);
      }

      const availableAmount = parseFloat(balance.balance);
      const requestedAmount = parseFloat(dto.amount);

      if (availableAmount < requestedAmount) {
        this.logger.warn(
          `Insufficient balance for withdrawal. Available: ${availableAmount}, Requested: ${requestedAmount}`,
        );
        return Err(new Error(`Insufficient balance. Available: ${availableAmount}, Requested: ${requestedAmount}`));
      }

      // Create transfer via payment provider
      const transferResult = await this.provider.createTransfer({
        userId: dto.userId,
        amount: dto.amount,
        currency: dto.currency,
        comment: dto.comment,
      });

      if (transferResult.err) {
        this.logger.error('Failed to create transfer with provider', transferResult.val);
        return Err(toError(transferResult.val || 'Failed to create transfer with payment provider'));
      }

      const transfer = transferResult.val;

      // Use transaction to ensure atomicity
      await this.em.transactional(async (em) => {
        // Deduct balance immediately (optimistic approach)
        const newBalance = (availableAmount - requestedAmount).toString();
        await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyType.Rub, newBalance);

        // Save transaction to database
        const transaction = em.create(PaymentTransactionEntity, {
          userId,
          type: PaymentType.Withdraw,
          provider: PaymentProvider.CryptoBot,
          providerTransactionId: transfer.transferId,
          amount: dto.amount,
          currency: dto.currency,
          status: PaymentStatus.Processing,
          description: dto.comment || `Withdrawal ${dto.amount} ${dto.currency}`,
          fee: transfer.fee || null,
          metadata: {
            telegramUserId: dto.userId,
            balanceBefore: availableAmount.toString(),
            balanceAfter: newBalance,
          },
        });

        await em.persist(transaction).flush();

        this.logger.log(`Withdrawal created: ${transaction.id} (provider: ${transfer.transferId})`);

        // Return response DTO
        const response: TransferResponseDto = {
          id: transaction.id,
          userId: dto.userId,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          comment: dto.comment,
          createdAt: transaction.createdAt.toISOString(),
          completedAt: transfer.completedAt?.toISOString(),
        };

        return response;
      });

      // Fetch the saved transaction to return
      const savedTransaction = await this.transactionRepository.findOne({
        providerTransactionId: transfer.transferId,
      });

      const response: TransferResponseDto = {
        id: savedTransaction!.id,
        userId: dto.userId,
        amount: savedTransaction!.amount,
        currency: savedTransaction!.currency,
        status: savedTransaction!.status,
        comment: dto.comment,
        createdAt: savedTransaction!.createdAt.toISOString(),
        completedAt: transfer.completedAt?.toISOString(),
      };

      return Ok(response);
    } catch (error) {
      this.logger.error('Error creating withdrawal', error);

      // Attempt to rollback balance if transaction failed
      try {
        const balance = await this.userBalanceRepository.findByUserAndCurrency(userId, CurrencyType.Rub);

        if (balance) {
          const currentAmount = parseFloat(balance.balance);
          const rollbackAmount = (currentAmount + parseFloat(dto.amount)).toString();
          await this.userBalanceRepository.createOrUpdateBalance(userId, CurrencyType.Rub, rollbackAmount);
          this.logger.warn(`Balance rollback performed for user ${userId}`);
        }
      } catch (rollbackError) {
        this.logger.error('Failed to rollback balance', rollbackError);
      }

      return Err(toError(error));
    }
  }

  /**
   * Get transaction by ID
   * Returns transaction or throws NotFoundException
   */
  async getTransaction(transactionId: string): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      this.logger.log(`Fetching transaction: ${transactionId}`);

      const transaction = await this.transactionRepository.findOne({
        id: transactionId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found: ${transactionId}`);
        return Err(new NotFoundException(`Transaction not found: ${transactionId}`));
      }

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error fetching transaction ${transactionId}`, error);
      return Err(toError(error));
    }
  }

  /**
   * Get user's transaction history with filtering and pagination
   */
  async getUserTransactions(
    userId: string,
    query?: TransactionQueryOptions,
  ): AsyncResult<TransactionListResponse, Error> {
    try {
      this.logger.log(`Fetching transactions for user ${userId}`, query);

      // Build query filters
      const filters: Record<string, unknown> = { userId };

      if (query?.type) {
        filters['type'] = query.type;
      }

      if (query?.status) {
        filters['status'] = query.status;
      }

      // Get total count
      const total = await this.transactionRepository.count(filters);

      // Apply pagination
      const limit = query?.limit || 50;
      const offset = query?.offset || 0;

      const transactions = await this.transactionRepository.find(filters, {
        orderBy: { createdAt: 'DESC' },
        limit,
        offset,
      });

      this.logger.log(`Retrieved ${transactions.length} transactions (total: ${total}) for user ${userId}`);

      return Ok({
        transactions,
        total,
        limit,
        offset,
      });
    } catch (error) {
      this.logger.error(`Error fetching transactions for user ${userId}`, error);
      return Err(toError(error));
    }
  }

  /**
   * Check invoice payment status
   * Syncs status from provider and updates database
   */
  async getInvoiceStatus(invoiceId: string): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      this.logger.log(`Checking invoice status: ${invoiceId}`);

      // Find transaction in database
      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: invoiceId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for invoice: ${invoiceId}`);
        return Err(new NotFoundException(`Invoice not found: ${invoiceId}`));
      }

      // Skip if already completed
      if (transaction.status === PaymentStatus.Completed) {
        this.logger.log(`Invoice already completed: ${invoiceId}`);
        return Ok(transaction);
      }

      // Get status from provider
      const providerResult = await this.provider.getInvoice(invoiceId);

      if (providerResult.err) {
        this.logger.error('Failed to get invoice from provider', providerResult.val);
        return Err(toError(providerResult.val || 'Failed to get invoice status'));
      }

      const providerTransaction = providerResult.val;

      // Update transaction if status changed
      if (transaction.status !== providerTransaction.status) {
        this.logger.log(`Invoice status changed: ${transaction.status} -> ${providerTransaction.status}`);

        transaction.status = providerTransaction.status;
        transaction.paidAt = providerTransaction.paidAt || null;
        transaction.fee = providerTransaction.fee || null;

        await this.em.flush();

        // Credit user balance if payment completed
        if (providerTransaction.status === PaymentStatus.Completed && !transaction.metadata?.['balanceCredited']) {
          await this.creditUserBalance(transaction);
        }
      }

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error checking invoice status ${invoiceId}`, error);
      return Err(toError(error));
    }
  }

  /**
   * Process webhook updates from payment provider
   * Handles invoice payment notifications and balance updates
   */
  async processWebhook(updateDto: WebhookUpdateDto): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      this.logger.log(`Processing webhook: ${updateDto.updateType}`, updateDto.payload);

      // Only process invoice_paid events
      if (updateDto.updateType !== 'invoice_paid') {
        this.logger.log(`Ignoring webhook type: ${updateDto.updateType}`);
        return Err(new Error(`Unsupported webhook type: ${updateDto.updateType}`));
      }

      const invoiceId = updateDto.payload.id;

      // Find transaction by provider transaction ID
      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: invoiceId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for webhook invoice: ${invoiceId}`);
        return Err(new NotFoundException(`Transaction not found for invoice: ${invoiceId}`));
      }

      // Skip if already processed
      if (transaction.status === PaymentStatus.Completed) {
        this.logger.log(`Webhook already processed for invoice: ${invoiceId}`);
        return Ok(transaction);
      }

      // Update transaction status
      transaction.status = PaymentStatus.Completed;
      transaction.paidAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        webhookData: updateDto.payload.data,
      };

      await this.em.flush();

      // Credit user balance
      await this.creditUserBalance(transaction);

      this.logger.log(`Webhook processed successfully for invoice: ${invoiceId}`);

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return Err(toError(error));
    }
  }

  /**
   * Sync transaction status from payment provider
   * Manually synchronize status when needed
   */
  async syncTransactionStatus(transactionId: string): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      this.logger.log(`Syncing transaction status: ${transactionId}`);

      const transaction = await this.transactionRepository.findOne({
        id: transactionId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found: ${transactionId}`);
        return Err(new NotFoundException(`Transaction not found: ${transactionId}`));
      }

      if (!transaction.providerTransactionId) {
        this.logger.warn(`No provider transaction ID for: ${transactionId}`);
        return Err(new Error('Transaction has no provider transaction ID'));
      }

      // Get latest status based on transaction type
      let providerResult;
      if (transaction.type === PaymentType.TopUp) {
        providerResult = await this.provider.getInvoice(transaction.providerTransactionId);
      } else {
        providerResult = await this.provider.getTransfer(transaction.providerTransactionId);
      }

      if (providerResult.err) {
        this.logger.error('Failed to get status from provider', providerResult.val);
        return Err(toError(providerResult.val || 'Failed to sync transaction status'));
      }

      const providerTransaction = providerResult.val;

      // Update if status changed
      if (transaction.status !== providerTransaction.status) {
        const oldStatus = transaction.status;
        transaction.status = providerTransaction.status;

        if ('paidAt' in providerTransaction && providerTransaction.paidAt) {
          transaction.paidAt = providerTransaction.paidAt;
        }

        if ('completedAt' in providerTransaction && providerTransaction.completedAt) {
          transaction.paidAt = providerTransaction.completedAt;
        }

        transaction.fee = providerTransaction.fee || null;

        await this.em.flush();

        this.logger.log(`Transaction status synced: ${transactionId} (${oldStatus} -> ${transaction.status})`);

        // Handle balance updates for completed top-ups
        if (
          transaction.type === PaymentType.TopUp &&
          transaction.status === PaymentStatus.Completed &&
          !transaction.metadata?.['balanceCredited']
        ) {
          await this.creditUserBalance(transaction);
        }
      }

      return Ok(transaction);
    } catch (error) {
      this.logger.error(`Error syncing transaction status ${transactionId}`, error);
      return Err(toError(error));
    }
  }

  /**
   * Credit user balance after successful payment
   * Internal helper method with idempotency check
   */
  private async creditUserBalance(transaction: PaymentTransactionEntity): Promise<void> {
    try {
      // Idempotency check
      if (transaction.metadata?.['balanceCredited']) {
        this.logger.warn(`Balance already credited for transaction: ${transaction.id}`);
        return;
      }

      this.logger.log(
        `Crediting balance for user ${transaction.userId}: ${transaction.amount} ${transaction.currency}`,
      );

      // Get current balance
      const balance = await this.userBalanceRepository.findByUserAndCurrency(transaction.userId, CurrencyType.Rub);

      if (!balance) {
        throw new Error(`Balance not found for user ${transaction.userId}`);
      }

      const creditAmount = parseFloat(transaction.amount);
      const currentBalance = parseFloat(balance.balance);
      const newBalance = (currentBalance + creditAmount).toString();

      // Update balance
      await this.userBalanceRepository.createOrUpdateBalance(
        transaction.userId,
        'RUB' as any, // Note: Currency mapping
        newBalance,
      );

      // Mark as credited
      transaction.metadata = {
        ...transaction.metadata,
        balanceCredited: true,
        balanceCreditedAt: new Date().toISOString(),
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance,
      };

      await this.em.flush();

      this.logger.log(`Balance credited successfully for transaction: ${transaction.id}`);
    } catch (error) {
      this.logger.error(`Failed to credit balance for transaction: ${transaction.id}`, error);
      throw error;
    }
  }
}
