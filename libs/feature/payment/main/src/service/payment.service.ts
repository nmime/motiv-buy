import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository, LockMode } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { I18nService } from 'nestjs-i18n';
import { Ok, Err, AsyncResult, toError } from '@app/common-shared';
import { decimal, add, subtract, toDbString, lessThan } from '@app/common-shared';
import { PaymentProviderFactory } from './payment-provider.factory';
import { ProviderRoutingService, RoutingContext } from './provider-routing.service';
import {
  UserBalanceRepository,
  UserBalanceEntity,
  CurrencyCode,
  PaymentTransactionEntity,
  PaymentType,
  PaymentProvider,
  PaymentStatus,
} from '@app/database';
import {
  CreateInvoiceDto,
  CreateTransferDto,
  WebhookUpdateDto,
  InvoiceResponseDto,
  TransferResponseDto,
  Cryptocurrency,
  PaymentTransfer,
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
    private readonly providerFactory: PaymentProviderFactory,
    private readonly userBalanceRepository: UserBalanceRepository,
    private readonly routingService: ProviderRoutingService,
    private readonly em: EntityManager,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Create top-up invoice for user
   * Generates payment link and stores pending transaction
   *
   * @param userId - User ID requesting top-up
   * @param dto - Invoice creation parameters (includes optional provider selection)
   */
  async createTopUp(userId: string, dto: CreateInvoiceDto): AsyncResult<InvoiceResponseDto, Error> {
    try {
      // Select payment provider using routing service if not explicitly specified
      let providerType: PaymentProvider;

      if (dto.provider) {
        // User explicitly selected a provider
        providerType = dto.provider;
        this.logger.log(`Using user-selected provider: ${providerType}`);
      } else {
        // Use routing service to select best provider
        const routingContext: RoutingContext = {
          currency: dto.currency,
          amount: dto.amount,
          userId,
          operation: 'deposit',
        };

        const routingResult = await this.routingService.selectDepositProvider(routingContext);

        if (routingResult.err) {
          this.logger.error('Failed to select provider via routing', routingResult.val);
          // Fallback to CryptoBot if routing fails
          providerType = PaymentProvider.CryptoBot;
          this.logger.warn(`Routing failed, using fallback provider: ${providerType}`);
        } else {
          providerType = routingResult.val;
          this.logger.log(`Routing selected provider: ${providerType}`);
        }
      }

      this.logger.log(`Creating top-up invoice for user ${userId}: ${dto.amount} ${dto.currency} via ${providerType}`);

      // Get the appropriate payment provider
      const provider = this.providerFactory.getProvider(providerType);

      // Map CurrencyCode to Cryptocurrency for provider
      const cryptocurrency = this.mapCurrencyCodeToCryptocurrency(dto.currency);

      // Create invoice via payment provider
      const invoiceResult = await provider.createInvoice({
        userId,
        amount: dto.amount,
        currency: cryptocurrency,
        description: dto.description,
        expiresIn: dto.expiresIn,
      });

      if (invoiceResult.err) {
        this.logger.error(`Failed to create invoice with provider ${providerType}`, invoiceResult.val);

        return Err(toError(invoiceResult.val || 'Failed to create invoice with payment provider'));
      }

      const invoice = invoiceResult.val;

      // Save transaction to database
      const transaction = this.transactionRepository.create({
        userId,
        type: PaymentType.TopUp,
        provider: providerType,
        providerTransactionId: invoice.invoiceId,
        amount: dto.amount,
        currency: cryptocurrency,
        status: PaymentStatus.Pending,
        payUrl: invoice.payUrl,
        description: dto.description || `Top-up ${dto.amount} ${cryptocurrency}`,
        expiresAt: invoice.expiresAt,
        metadata: {
          expiresIn: dto.expiresIn,
          provider: providerType,
        },
      });

      await this.em.persistAndFlush(transaction);

      this.logger.log(
        `Top-up invoice created: ${transaction.id} (provider: ${providerType}, invoiceId: ${invoice.invoiceId})`,
      );

      // Return response DTO
      const response: InvoiceResponseDto = {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        payUrl: transaction.payUrl || '',
        description: transaction.description || undefined,
        createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
        expiresAt: transaction.expiresAt?.toISOString() || new Date().toISOString(),
      };

      return Ok(response);
    } catch (error) {
      this.logger.error('Error creating top-up invoice', error);

      return Err(toError(error));
    }
  }

  /**
   * Map cryptocurrency enum to CurrencyType for balance operations
   * This ensures we check/deduct the correct currency balance
   */
  private mapCryptocurrencyToCurrencyCode(crypto: string): CurrencyCode {
    // Direct mapping for supported currencies
    const mapping: Record<string, CurrencyCode> = {
      USDT: CurrencyCode.Usdt,
      TON: CurrencyCode.Ton,
      BTC: CurrencyCode.Btc,
      ETH: CurrencyCode.Eth,
      BNB: CurrencyCode.Bnb,
      TRX: CurrencyCode.Trx,
      USDC: CurrencyCode.Usdc,
      RUB: CurrencyCode.Rub,
    };

    const currencyCode = mapping[crypto.toUpperCase()];
    if (!currencyCode) {
      throw new Error(`Unsupported cryptocurrency: ${crypto}`);
    }

    return currencyCode;
  }

  /**
   * Map CurrencyCode to Cryptocurrency for provider API calls
   * This converts domain model currency to provider-specific cryptocurrency enum
   */
  private mapCurrencyCodeToCryptocurrency(code: CurrencyCode): Cryptocurrency {
    const mapping: Partial<Record<CurrencyCode, Cryptocurrency>> = {
      [CurrencyCode.Usdt]: Cryptocurrency.Usdt,
      [CurrencyCode.Ton]: Cryptocurrency.Ton,
      [CurrencyCode.Btc]: Cryptocurrency.Btc,
      [CurrencyCode.Eth]: Cryptocurrency.Eth,
      [CurrencyCode.Bnb]: Cryptocurrency.Bnb,
      [CurrencyCode.Trx]: Cryptocurrency.Trx,
      [CurrencyCode.Usdc]: Cryptocurrency.Usdc,
    };

    const crypto = mapping[code];
    if (!crypto) {
      throw new Error(`Currency code ${code} is not supported for cryptocurrency payments`);
    }

    return crypto;
  }

  /**
   * Create withdrawal transfer for user
   * Validates balance, deducts amount, and initiates transfer
   *
   * SECURITY: Uses pessimistic locking to prevent race condition where multiple
   * concurrent withdrawal requests could both pass balance check and cause negative balance
   *
   * FIXED: Now checks balance in requested currency (was always checking RUB)
   *
   * @param userId - User ID requesting withdrawal
   * @param dto - Transfer creation parameters (includes optional provider and destination)
   */
  async createWithdrawal(userId: string, dto: CreateTransferDto): AsyncResult<TransferResponseDto, Error> {
    // Store balance before transaction for potential rollback
    let balanceBeforeTransaction: string | null = null;
    let transferCreated = false;
    let transfer: PaymentTransfer | null = null;

    try {
      // Select payment provider using routing service if not explicitly specified
      let providerType: PaymentProvider;

      if (dto.provider) {
        // User explicitly selected a provider
        providerType = dto.provider;
        this.logger.log(`Using user-selected provider: ${providerType}`);
      } else {
        // Use routing service to select best provider
        const routingContext: RoutingContext = {
          currency: dto.currency,
          amount: dto.amount,
          userId,
          operation: 'withdrawal',
        };

        const routingResult = await this.routingService.selectWithdrawalProvider(routingContext);

        if (routingResult.err) {
          this.logger.error('Failed to select provider via routing', routingResult.val);
          // Fallback to CryptoBot if routing fails
          providerType = PaymentProvider.CryptoBot;
          this.logger.warn(`Routing failed, using fallback provider: ${providerType}`);
        } else {
          providerType = routingResult.val;
          this.logger.log(`Routing selected provider: ${providerType}`);
        }
      }

      this.logger.log(`Creating withdrawal for user ${userId}: ${dto.amount} ${dto.currency} via ${providerType}`);

      // Get the appropriate payment provider
      const provider = this.providerFactory.getProvider(providerType);

      // Map CurrencyCode to Cryptocurrency for provider
      const cryptocurrency = this.mapCurrencyCodeToCryptocurrency(dto.currency);

      // Use database transaction with pessimistic locking to prevent race conditions
      const result = await this.em.transactional(async (em) => {
        // First find the currency entity by code
        const currency = await em.findOne('CurrencyEntity', { code: dto.currency });

        if (!currency || !('id' in currency)) {
          throw new Error(`Currency ${dto.currency} not found in system`);
        }

        // CRITICAL: Lock balance row to prevent concurrent withdrawals
        // This ensures atomic balance check and deduction
        // FIXED: Now checks balance in REQUESTED currency, not always RUB
        const balanceEntity = await em.findOne(
          UserBalanceEntity,
          { user: userId, currency: currency.id as string },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!balanceEntity) {
          throw new Error(
            `Balance not found for user ${userId} in currency ${dto.currency}. ` +
              `User may not have a balance in this currency.`,
          );
        }

        // Store original balance for rollback (captured BEFORE any modifications)
        balanceBeforeTransaction = balanceEntity.balance;

        if (!balanceBeforeTransaction) {
          throw new Error('Balance data is invalid');
        }

        const availableAmount = decimal(balanceBeforeTransaction);
        const requestedAmount = decimal(dto.amount);

        // Atomic balance check (now safe from race conditions due to lock)
        if (lessThan(availableAmount, requestedAmount)) {
          this.logger.warn(
            `Insufficient balance for withdrawal. Currency: ${dto.currency}, Available: ${availableAmount.toString()}, Requested: ${requestedAmount.toString()}`,
          );

          throw new Error(
            `Insufficient balance in ${dto.currency}. Available: ${availableAmount.toString()}, Requested: ${requestedAmount.toString()}`,
          );
        }

        // Create transfer via payment provider BEFORE deducting balance
        // This ensures we don't deduct if provider rejects the transfer
        const transferResult = await provider.createTransfer({
          userId: dto.userId,
          amount: dto.amount,
          currency: cryptocurrency,
          comment: dto.comment,
          destination: dto.destination, // Pass destination for providers that need it (e.g., YooKassa)
        });

        if (transferResult.err) {
          this.logger.error(`Failed to create transfer with provider ${providerType}`, transferResult.val);
          throw toError(transferResult.val || 'Failed to create transfer with payment provider');
        }

        transfer = transferResult.val;
        transferCreated = true;

        // Now deduct balance atomically within the locked transaction
        // FIXED: Deduct from REQUESTED currency balance, not always RUB
        const newBalance = toDbString(subtract(availableAmount, requestedAmount), 8);
        await this.userBalanceRepository.createOrUpdateBalance(userId, dto.currency, newBalance);

        // Save transaction to database
        const transaction = em.create(PaymentTransactionEntity, {
          userId,
          type: PaymentType.Withdraw,
          provider: providerType,
          providerTransactionId: transfer.transferId,
          amount: dto.amount,
          currency: cryptocurrency,
          status: PaymentStatus.Processing,
          description: dto.comment || `Withdrawal ${dto.amount} ${cryptocurrency}`,
          fee: transfer.fee || null,
          metadata: {
            telegramUserId: dto.userId,
            balanceBefore: balanceBeforeTransaction,
            balanceAfter: newBalance,
            balanceLockedAt: new Date().toISOString(),
            provider: providerType,
          },
        });

        await em.persist(transaction).flush();

        this.logger.log(
          `Withdrawal created: ${transaction.id} (provider: ${providerType}, transferId: ${transfer.transferId})`,
        );

        // Return transaction to outer scope
        return transaction;
      });

      // Build response DTO from saved transaction
      const response: TransferResponseDto = {
        id: result.id,
        userId: dto.userId,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        comment: dto.comment,
        createdAt: result.createdAt?.toISOString() || new Date().toISOString(),
        completedAt: (transfer as PaymentTransfer | null)?.completedAt?.toISOString(),
      };

      return Ok(response);
    } catch (error) {
      this.logger.error('Error creating withdrawal', error);

      // CRITICAL: Rollback balance using captured balanceBeforeTransaction
      // Only rollback if we successfully deducted (transfer was created with provider)
      if (transferCreated && balanceBeforeTransaction !== null) {
        try {
          // FIXED: Rollback in REQUESTED currency, not always RUB
          await this.userBalanceRepository.createOrUpdateBalance(userId, dto.currency, balanceBeforeTransaction);

          this.logger.warn(
            `Balance rollback performed for user ${userId} in ${dto.currency}: restored to ${balanceBeforeTransaction}`,
          );
        } catch (rollbackError) {
          this.logger.error('CRITICAL: Failed to rollback balance after withdrawal failure', {
            userId,
            currency: dto.currency,
            originalBalance: balanceBeforeTransaction,
            error: rollbackError,
          });
          // This is a critical error - balance was deducted but transaction failed
          // Manual intervention may be required
        }
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

      // Get the provider that was used for this transaction
      const provider = this.providerFactory.getProvider(transaction.provider);

      // Get status from provider
      const providerResult = await provider.getInvoice(invoiceId);

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
   * Handles all webhook event types: invoice_paid, invoice_expired, invoice_cancelled,
   * transfer_completed, transfer_failed
   *
   * @param updateDto - Webhook update data from payment provider
   * @param requestId - Unique request ID for tracking and debugging
   */
  async processWebhook(updateDto: WebhookUpdateDto, requestId?: string): AsyncResult<PaymentTransactionEntity, Error> {
    const logContext = { requestId, updateType: updateDto.updateType, payloadId: updateDto.payload.id };

    try {
      this.logger.log(`Processing webhook: ${updateDto.updateType}`, logContext);

      // Route to appropriate handler based on webhook type using Map-based lookup
      type WebhookHandler = (
        updateDto: WebhookUpdateDto,
        logContext: Record<string, unknown>,
      ) => Promise<AsyncResult<PaymentTransactionEntity, Error>>;

      const webhookHandlers: Record<string, WebhookHandler> = {
        invoice_paid: this.handleInvoicePaid.bind(this),
        invoice_expired: this.handleInvoiceExpired.bind(this),
        invoice_cancelled: this.handleInvoiceCancelled.bind(this),
        transfer_completed: this.handleTransferCompleted.bind(this),
        transfer_failed: this.handleTransferFailed.bind(this),
      };

      const handler = webhookHandlers[updateDto.updateType];
      if (!handler) {
        this.logger.warn(`Unsupported webhook type: ${updateDto.updateType}`, logContext);

        return Err(new Error(`Unsupported webhook type: ${updateDto.updateType}`));
      }

      return await handler(updateDto, logContext);
    } catch (error) {
      this.logger.error('Error processing webhook', { ...logContext, error: toError(error).message });

      return Err(toError(error));
    }
  }

  /**
   * Handle invoice_paid webhook event
   * Credits user balance when invoice is successfully paid
   */
  private async handleInvoicePaid(
    updateDto: WebhookUpdateDto,
    logContext: Record<string, unknown>,
  ): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      const invoiceId = updateDto.payload.id;

      // Find transaction by provider transaction ID
      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: invoiceId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for webhook invoice: ${invoiceId}`, logContext);

        return Err(new NotFoundException(`Transaction not found for invoice: ${invoiceId}`));
      }

      // Idempotency: Skip if already processed
      if (transaction.status === PaymentStatus.Completed) {
        this.logger.log(`Webhook already processed for invoice: ${invoiceId}`, logContext);

        return Ok(transaction);
      }

      // Update transaction status and metadata
      transaction.status = PaymentStatus.Completed;
      transaction.paidAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        webhookData: updateDto.payload.data,
        requestId: logContext.requestId,
      };

      await this.em.flush();

      // Credit user balance
      await this.creditUserBalance(transaction);

      this.logger.log(`Invoice paid webhook processed successfully: ${invoiceId}`, {
        ...logContext,
        transactionId: transaction.id,
        amount: transaction.amount,
      });

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing invoice_paid webhook', { ...logContext, error: toError(error).message });

      return Err(toError(error));
    }
  }

  /**
   * Handle invoice_expired webhook event
   * Marks invoice as expired when payment deadline is reached
   */
  private async handleInvoiceExpired(
    updateDto: WebhookUpdateDto,
    logContext: Record<string, unknown>,
  ): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      const invoiceId = updateDto.payload.id;

      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: invoiceId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for expired invoice: ${invoiceId}`, logContext);

        return Err(new NotFoundException(`Transaction not found for invoice: ${invoiceId}`));
      }

      // Skip if already in terminal state
      if ([PaymentStatus.Completed, PaymentStatus.Expired, PaymentStatus.Cancelled].includes(transaction.status)) {
        this.logger.log(`Invoice already in terminal state: ${transaction.status}`, logContext);

        return Ok(transaction);
      }

      // Update transaction to expired
      transaction.status = PaymentStatus.Expired;
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        requestId: logContext.requestId,
      };

      await this.em.flush();

      this.logger.log(`Invoice expired webhook processed: ${invoiceId}`, {
        ...logContext,
        transactionId: transaction.id,
      });

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing invoice_expired webhook', { ...logContext, error: toError(error).message });

      return Err(toError(error));
    }
  }

  /**
   * Handle invoice_cancelled webhook event
   * Marks invoice as cancelled
   */
  private async handleInvoiceCancelled(
    updateDto: WebhookUpdateDto,
    logContext: Record<string, unknown>,
  ): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      const invoiceId = updateDto.payload.id;

      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: invoiceId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for cancelled invoice: ${invoiceId}`, logContext);

        return Err(new NotFoundException(`Transaction not found for invoice: ${invoiceId}`));
      }

      // Skip if already in terminal state
      if ([PaymentStatus.Completed, PaymentStatus.Expired, PaymentStatus.Cancelled].includes(transaction.status)) {
        this.logger.log(`Invoice already in terminal state: ${transaction.status}`, logContext);

        return Ok(transaction);
      }

      // Update transaction to cancelled
      transaction.status = PaymentStatus.Cancelled;
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        requestId: logContext.requestId,
      };

      await this.em.flush();

      this.logger.log(`Invoice cancelled webhook processed: ${invoiceId}`, {
        ...logContext,
        transactionId: transaction.id,
      });

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing invoice_cancelled webhook', {
        ...logContext,
        error: toError(error).message,
      });

      return Err(toError(error));
    }
  }

  /**
   * Handle transfer_completed webhook event
   * Marks withdrawal transfer as completed
   */
  private async handleTransferCompleted(
    updateDto: WebhookUpdateDto,
    logContext: Record<string, unknown>,
  ): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      const transferId = updateDto.payload.id;

      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: transferId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for completed transfer: ${transferId}`, logContext);

        return Err(new NotFoundException(`Transaction not found for transfer: ${transferId}`));
      }

      // Idempotency: Skip if already completed
      if (transaction.status === PaymentStatus.Completed) {
        this.logger.log(`Transfer already completed: ${transferId}`, logContext);

        return Ok(transaction);
      }

      // Update transaction to completed
      transaction.status = PaymentStatus.Completed;
      transaction.paidAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        webhookData: updateDto.payload.data,
        requestId: logContext.requestId,
      };

      await this.em.flush();

      this.logger.log(`Transfer completed webhook processed: ${transferId}`, {
        ...logContext,
        transactionId: transaction.id,
        amount: transaction.amount,
      });

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing transfer_completed webhook', {
        ...logContext,
        error: toError(error).message,
      });

      return Err(toError(error));
    }
  }

  /**
   * Handle transfer_failed webhook event
   * Marks withdrawal transfer as failed and refunds user balance
   */
  private async handleTransferFailed(
    updateDto: WebhookUpdateDto,
    logContext: Record<string, unknown>,
  ): AsyncResult<PaymentTransactionEntity, Error> {
    try {
      const transferId = updateDto.payload.id;

      const transaction = await this.transactionRepository.findOne({
        providerTransactionId: transferId,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found for failed transfer: ${transferId}`, logContext);

        return Err(new NotFoundException(`Transaction not found for transfer: ${transferId}`));
      }

      // Skip if already in terminal state
      if ([PaymentStatus.Completed, PaymentStatus.Failed].includes(transaction.status)) {
        this.logger.log(`Transfer already in terminal state: ${transaction.status}`, logContext);

        return Ok(transaction);
      }

      // Update transaction to failed
      transaction.status = PaymentStatus.Failed;
      transaction.metadata = {
        ...transaction.metadata,
        webhookProcessedAt: new Date().toISOString(),
        webhookData: updateDto.payload.data,
        requestId: logContext.requestId,
      };

      await this.em.flush();

      // Refund user balance if this was a withdrawal
      if (transaction.type === PaymentType.Withdraw) {
        await this.refundUserBalance(transaction, logContext);
      }

      this.logger.log(`Transfer failed webhook processed: ${transferId}`, {
        ...logContext,
        transactionId: transaction.id,
      });

      return Ok(transaction);
    } catch (error) {
      this.logger.error('Error processing transfer_failed webhook', { ...logContext, error: toError(error).message });

      return Err(toError(error));
    }
  }

  /**
   * Refund user balance after failed withdrawal
   * Internal helper method for reversing balance deduction
   *
   * SECURITY: Uses pessimistic locking to prevent race condition where multiple
   * concurrent refund requests could both pass idempotency check and double-refund
   *
   * FIXED: Added pessimistic locking for atomic idempotency check + refund
   * FIXED: Now refunds in correct currency (was always RUB)
   */
  private async refundUserBalance(
    transaction: PaymentTransactionEntity,
    logContext: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Map transaction currency to CurrencyCode for balance operations
      const currencyCode = this.mapCryptocurrencyToCurrencyCode(transaction.currency);

      // Use database transaction with pessimistic locking to prevent race conditions
      await this.em.transactional(async (em) => {
        // CRITICAL: Reload transaction with pessimistic lock for atomic idempotency check
        // This prevents race condition where two concurrent refunds both pass the check
        const lockedTransaction = await em.findOne(
          PaymentTransactionEntity,
          { id: transaction.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!lockedTransaction) {
          throw new Error(`Transaction not found: ${transaction.id}`);
        }

        // Atomic idempotency check - now safe from race conditions
        if (lockedTransaction.metadata?.['balanceRefunded']) {
          this.logger.warn(`Balance already refunded for transaction: ${transaction.id}`, logContext);

          return;
        }

        this.logger.log(
          `Refunding balance for user ${lockedTransaction.userId}: ${lockedTransaction.amount} ${lockedTransaction.currency}`,
          logContext,
        );

        // Get current balance
        const balance = await this.userBalanceRepository.findByUserAndCurrency(lockedTransaction.userId, currencyCode);

        if (!balance) {
          throw new Error(
            `Balance not found for user ${lockedTransaction.userId} in currency ${lockedTransaction.currency}`,
          );
        }

        const refundAmount = decimal(lockedTransaction.amount);
        const currentBalance = decimal(balance.balance);
        const newBalance = toDbString(add(currentBalance, refundAmount), 8);

        // Update balance with proper currency
        await this.userBalanceRepository.createOrUpdateBalance(lockedTransaction.userId, currencyCode, newBalance);

        // Mark as refunded atomically within the locked transaction
        lockedTransaction.metadata = {
          ...lockedTransaction.metadata,
          balanceRefunded: true,
          balanceRefundedAt: new Date().toISOString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance,
          currency: lockedTransaction.currency, // Track which currency was refunded
        };

        // Flush happens automatically at end of transactional block
      });

      this.logger.log(`Balance refunded successfully for transaction: ${transaction.id}`, logContext);
    } catch (error) {
      this.logger.error(`Failed to refund balance for transaction: ${transaction.id}`, {
        ...logContext,
        error: toError(error).message,
      });

      throw error;
    }
  }

  /**
   * Sync transaction status from payment provider
   * Manually synchronize status when needed
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
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

      // Get the provider that was used for this transaction
      const provider = this.providerFactory.getProvider(transaction.provider);

      // Get latest status based on transaction type
      let providerResult;
      if (transaction.type === PaymentType.TopUp) {
        providerResult = await provider.getInvoice(transaction.providerTransactionId);
      } else {
        providerResult = await provider.getTransfer(transaction.providerTransactionId);
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
   * Internal helper method with idempotency check and pessimistic locking to prevent race conditions
   *
   * SECURITY: Uses pessimistic locking (lockMode: LockMode.PESSIMISTIC_WRITE) to prevent
   * double-crediting in case of duplicate webhook processing or concurrent requests
   */
  private async creditUserBalance(transaction: PaymentTransactionEntity): Promise<void> {
    try {
      // Use a database transaction with pessimistic write locking to prevent race conditions
      await this.em.transactional(async (em) => {
        // Reload transaction with pessimistic lock to ensure atomic idempotency check
        // This prevents race condition where two webhooks could both pass the check
        const lockedTransaction = await em.findOne(
          PaymentTransactionEntity,
          { id: transaction.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!lockedTransaction) {
          throw new Error(`Transaction not found: ${transaction.id}`);
        }

        // Atomic idempotency check - now safe from race conditions
        if (lockedTransaction.metadata?.['balanceCredited']) {
          this.logger.warn(`Balance already credited for transaction: ${transaction.id}`);

          return;
        }

        this.logger.log(
          `Crediting balance for user ${lockedTransaction.userId}: ${lockedTransaction.amount} ${lockedTransaction.currency}`,
        );

        // Map transaction currency to CurrencyCode for balance operations
        const currencyCode = this.mapCryptocurrencyToCurrencyCode(lockedTransaction.currency);

        // Get current balance in the correct currency
        const balance = await this.userBalanceRepository.findByUserAndCurrency(lockedTransaction.userId, currencyCode);

        if (!balance) {
          throw new Error(
            `Balance not found for user ${lockedTransaction.userId} in currency ${lockedTransaction.currency}`,
          );
        }

        const creditAmount = decimal(lockedTransaction.amount);
        const currentBalance = decimal(balance.balance);
        const newBalance = toDbString(add(currentBalance, creditAmount), 8);

        // Update balance with correct currency
        await this.userBalanceRepository.createOrUpdateBalance(lockedTransaction.userId, currencyCode, newBalance);

        // Mark as credited atomically within the locked transaction
        lockedTransaction.metadata = {
          ...lockedTransaction.metadata,
          balanceCredited: true,
          balanceCreditedAt: new Date().toISOString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance,
          currency: lockedTransaction.currency, // Track which currency was credited
        };

        // Flush happens automatically at end of transactional block
      });

      this.logger.log(`Balance credited successfully for transaction: ${transaction.id}`);
    } catch (error) {
      this.logger.error(`Failed to credit balance for transaction: ${transaction.id}`, error);
      throw error;
    }
  }
}
