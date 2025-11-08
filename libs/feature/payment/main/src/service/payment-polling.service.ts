import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EntityManager, EntityRepository, LockMode } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentConfigService, PaymentUpdateStrategy } from '@app/feature-payment-shared';
import { PaymentTransactionEntity, PaymentType, PaymentStatus, PaymentProvider } from '@app/database';
import { toError } from '@app/common-shared';

/**
 * Payment Polling Service
 *
 * Periodically polls payment providers for pending transaction status updates.
 * Supports configurable polling strategies per provider and automatic status synchronization.
 *
 * ARCHITECTURE:
 * =============
 * - Runs on configurable interval (default: 30 seconds)
 * - Processes pending transactions in batches
 * - Supports per-provider polling enable/disable
 * - Prevents duplicate processing with pessimistic locking
 * - Gracefully handles provider API errors
 *
 * POLLING STRATEGIES:
 * ===================
 * 1. WEBHOOK_ONLY: Polling disabled, relies on webhooks
 * 2. POLLING_ONLY: Polling enabled, no webhook dependency
 * 3. HYBRID: Both polling and webhooks (most reliable)
 *
 * USAGE:
 * ======
 * Service starts automatically on module init.
 * Configuration via environment variables:
 * - PAYMENT_POLLING_ENABLED=true
 * - PAYMENT_POLLING_INTERVAL=30000 (milliseconds)
 * - PAYMENT_POLLING_MAX_PENDING_AGE=1440 (minutes)
 * - PAYMENT_POLLING_BATCH_SIZE=50
 */
@Injectable()
export class PaymentPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentPollingService.name);
  private pollingIntervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isEnabled = false;
  private interval: number;
  private maxPendingAge: number;
  private batchSize: number;
  private providerConfig: {
    cryptoBot: boolean;
    heleke: boolean;
    yooKassa: boolean;
  };

  constructor(
    @InjectRepository(PaymentTransactionEntity)
    private readonly transactionRepository: EntityRepository<PaymentTransactionEntity>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly paymentConfig: PaymentConfigService,
    private readonly em: EntityManager,
  ) {
    // Load polling configuration
    const pollingConfig = this.paymentConfig.getPollingConfig();
    this.isEnabled = pollingConfig?.enabled ?? false;
    this.interval = pollingConfig?.interval ?? 30000; // 30 seconds default
    this.maxPendingAge = pollingConfig?.maxPendingAge ?? 1440; // 24 hours default
    this.batchSize = pollingConfig?.batchSize ?? 50;
    this.providerConfig = {
      cryptoBot: pollingConfig?.providers?.cryptoBot ?? true,
      heleke: pollingConfig?.providers?.heleke ?? true,
      yooKassa: pollingConfig?.providers?.yooKassa ?? true,
    };

    this.logger.log(
      `PaymentPollingService initialized (enabled: ${this.isEnabled}, interval: ${this.interval}ms, maxPendingAge: ${this.maxPendingAge}min, batchSize: ${this.batchSize})`,
    );
  }

  /**
   * Start polling service on module initialization
   */
  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.log('Polling service is disabled via configuration');

      return;
    }

    // Check if any provider has polling enabled
    const hasPollingEnabled =
      this.isProviderPollingEnabled(PaymentProvider.CryptoBot) ||
      this.isProviderPollingEnabled(PaymentProvider.Heleket) ||
      this.isProviderPollingEnabled(PaymentProvider.YooKassa);

    if (!hasPollingEnabled) {
      this.logger.log('Polling service disabled: all providers use webhook-only strategy');

      return;
    }

    this.startPolling();
  }

  /**
   * Stop polling service on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    this.stopPolling();
  }

  /**
   * Start the polling interval
   */
  private startPolling(): void {
    if (this.pollingIntervalId) {
      this.logger.warn('Polling already running, skipping start');

      return;
    }

    this.logger.log(`Starting polling service with ${this.interval}ms interval`);

    // Run immediately on start
    this.pollPendingTransactions().catch((error) => {
      this.logger.error('Error during initial polling', error);
    });

    // Then run on interval
    this.pollingIntervalId = setInterval(() => {
      this.pollPendingTransactions().catch((error) => {
        this.logger.error('Error during polling interval', error);
      });
    }, this.interval);
  }

  /**
   * Stop the polling interval
   */
  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      this.logger.log('Polling service stopped');
    }
  }

  /**
   * Check if polling is enabled for a specific provider
   */
  private isProviderPollingEnabled(provider: PaymentProvider): boolean {
    // Get provider configuration
    let updateStrategy: PaymentUpdateStrategy | undefined;

    if (provider === PaymentProvider.CryptoBot) {
      const config = this.paymentConfig.getCryptoBotConfig();
      updateStrategy = config?.updateStrategy;
    } else if (provider === PaymentProvider.Heleket) {
      const config = this.paymentConfig.getHelekeConfig();
      updateStrategy = config?.updateStrategy;
    } else if (provider === PaymentProvider.YooKassa) {
      const config = this.paymentConfig.getYooKassaConfig();
      updateStrategy = config?.updateStrategy;
    }

    // Default to HYBRID if not specified
    const strategy = updateStrategy ?? PaymentUpdateStrategy.Hybrid;

    // Polling enabled for POLLING and HYBRID strategies
    const pollingEnabled = strategy === PaymentUpdateStrategy.Polling || strategy === PaymentUpdateStrategy.Hybrid;

    // Also check provider-specific config
    const providerEnabled = this.providerConfig[this.getProviderConfigKey(provider)];

    return pollingEnabled && providerEnabled;
  }

  /**
   * Get provider config key
   */
  private getProviderConfigKey(provider: PaymentProvider): 'cryptoBot' | 'heleke' | 'yooKassa' {
    const mapping: Record<PaymentProvider, 'cryptoBot' | 'heleke' | 'yooKassa'> = {
      [PaymentProvider.CryptoBot]: 'cryptoBot',
      [PaymentProvider.Heleket]: 'heleke',
      [PaymentProvider.YooKassa]: 'yooKassa',
    };

    return mapping[provider];
  }

  /**
   * Poll pending transactions and update their status
   * Main polling logic that runs on interval
   */
  private async pollPendingTransactions(): Promise<void> {
    // Prevent concurrent polling
    if (this.isPolling) {
      this.logger.debug('Polling already in progress, skipping this interval');

      return;
    }

    this.isPolling = true;

    try {
      const startTime = Date.now();

      // Calculate cutoff time for pending transactions
      const cutoffDate = new Date(Date.now() - this.maxPendingAge * 60 * 1000);

      // Find pending transactions that need polling
      const pendingStatuses = [PaymentStatus.Pending, PaymentStatus.Processing];

      const transactions = await this.transactionRepository.find(
        {
          status: { $in: pendingStatuses },
          createdAt: { $gte: cutoffDate },
        },
        {
          limit: this.batchSize,
          orderBy: { createdAt: 'ASC' },
        },
      );

      if (transactions.length === 0) {
        this.logger.debug('No pending transactions to poll');

        return;
      }

      this.logger.log(`Polling ${transactions.length} pending transactions`);

      let updated = 0;
      let failed = 0;
      let skipped = 0;

      // Process each transaction
      for (const transaction of transactions) {
        try {
          // Check if polling is enabled for this provider
          if (!this.isProviderPollingEnabled(transaction.provider)) {
            skipped++;
            continue;
          }

          // Poll provider for status update
          // eslint-disable-next-line no-await-in-loop
          const result = await this.pollTransactionStatus(transaction);

          if (result) {
            updated++;
          }
        } catch (error) {
          failed++;
          this.logger.error(`Failed to poll transaction ${transaction.id}`, toError(error));
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Polling completed in ${duration}ms: ${updated} updated, ${failed} failed, ${skipped} skipped`);
    } catch (error) {
      this.logger.error('Error during polling cycle', toError(error));
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single transaction status from provider
   * Returns true if transaction was updated, false otherwise
   */
  private async pollTransactionStatus(transaction: PaymentTransactionEntity): Promise<boolean> {
    try {
      // Get the appropriate provider
      const provider = this.providerFactory.getProvider(transaction.provider);

      if (!transaction.providerTransactionId) {
        this.logger.warn(`Transaction ${transaction.id} has no provider transaction ID, skipping`);

        return false;
      }

      // Fetch latest status from provider
      let providerResult;
      if (transaction.type === PaymentType.TopUp) {
        providerResult = await provider.getInvoice(transaction.providerTransactionId);
      } else {
        providerResult = await provider.getTransfer(transaction.providerTransactionId);
      }

      if (providerResult.err) {
        this.logger.warn(
          `Failed to get status from provider for transaction ${transaction.id}: ${providerResult.val.message}`,
        );

        return false;
      }

      const providerData = providerResult.val;

      // Check if status changed
      if (transaction.status === providerData.status) {
        this.logger.debug(`Transaction ${transaction.id} status unchanged (${transaction.status})`);

        return false;
      }

      // Use pessimistic locking to prevent race conditions with webhook updates
      await this.em.transactional(async (em) => {
        // Reload transaction with lock
        const lockedTransaction = await em.findOne(
          PaymentTransactionEntity,
          { id: transaction.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!lockedTransaction) {
          throw new Error(`Transaction not found: ${transaction.id}`);
        }

        // Double-check status hasn't been updated by webhook
        if (lockedTransaction.status === providerData.status) {
          this.logger.debug(`Transaction ${transaction.id} already updated by webhook, skipping`);

          return;
        }

        // Update transaction
        const oldStatus = lockedTransaction.status;
        lockedTransaction.status = providerData.status;

        if ('paidAt' in providerData && providerData.paidAt) {
          lockedTransaction.paidAt = providerData.paidAt;
        }

        if ('completedAt' in providerData && providerData.completedAt) {
          lockedTransaction.paidAt = providerData.completedAt;
        }

        lockedTransaction.fee = providerData.fee || null;

        // Add polling metadata
        lockedTransaction.metadata = {
          ...lockedTransaction.metadata,
          lastPolledAt: new Date().toISOString(),
          pollingUpdateSource: 'polling_service',
        };

        this.logger.log(
          `Transaction ${transaction.id} status updated via polling: ${oldStatus} -> ${providerData.status}`,
        );
      });

      return true;
    } catch (error) {
      this.logger.error(`Error polling transaction ${transaction.id}`, toError(error));

      throw error;
    }
  }

  /**
   * Manually trigger polling (useful for testing or admin actions)
   */
  async triggerManualPoll(): Promise<void> {
    this.logger.log('Manual polling triggered');
    await this.pollPendingTransactions();
  }

  /**
   * Get polling status information
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    interval: number;
    maxPendingAge: number;
    batchSize: number;
    providers: Record<string, boolean>;
  } {
    return {
      enabled: this.isEnabled,
      running: this.pollingIntervalId !== null,
      interval: this.interval,
      maxPendingAge: this.maxPendingAge,
      batchSize: this.batchSize,
      providers: {
        cryptoBot: this.isProviderPollingEnabled(PaymentProvider.CryptoBot),
        heleke: this.isProviderPollingEnabled(PaymentProvider.Heleket),
        yooKassa: this.isProviderPollingEnabled(PaymentProvider.YooKassa),
      },
    };
  }
}
