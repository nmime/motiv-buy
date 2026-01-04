import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaymentConfigService, PaymentService, PaymentUpdateStrategy } from '@app/feature-payment-shared';
import { PaymentProvider, PaymentStatus, PaymentTransactionEntity } from '@app/database';
import { toError } from '@app/common-shared';

/**
 * Polls payment providers for pending transaction status updates.
 *
 * Strategies:
 * - WEBHOOK: Disabled polling, relies on webhooks only
 * - POLLING: Enabled polling, no webhook dependency
 * - HYBRID: Both polling and webhooks (default, most reliable)
 *
 * Configuration (environment variables):
 * - PAYMENT_POLLING_ENABLED: Enable/disable polling (default: true)
 * - PAYMENT_POLLING_INTERVAL: Poll interval in ms (default: 30000)
 * - PAYMENT_POLLING_MAX_PENDING_AGE: Max age in minutes (default: 1440)
 * - PAYMENT_POLLING_BATCH_SIZE: Transactions per batch (default: 50)
 */
@Injectable()
export class PaymentPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentPollingService.name);

  private pollingIntervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private readonly config: {
    enabled: boolean;
    interval: number;
    maxPendingAge: number;
    batchSize: number;
    invoiceExpiration: number;
    providers: Record<string, boolean>;
  };

  private readonly providerConfigKeys: Record<PaymentProvider, keyof typeof this.config.providers> = {
    [PaymentProvider.CryptoBot]: 'cryptoBot',
    [PaymentProvider.Heleket]: 'heleke',
    [PaymentProvider.YooKassa]: 'yooKassa',
  };

  constructor(
    private readonly em: EntityManager,
    private readonly paymentConfig: PaymentConfigService,
    private readonly paymentService: PaymentService,
  ) {
    const pollingConfig = this.paymentConfig.getPollingConfig();

    const limitsConfig = this.paymentConfig.getLimitsConfig();

    this.config = {
      enabled: pollingConfig?.enabled ?? true,
      interval: pollingConfig?.interval ?? 30000,
      maxPendingAge: pollingConfig?.maxPendingAge ?? 1440,
      batchSize: pollingConfig?.batchSize ?? 50,
      invoiceExpiration: limitsConfig?.invoiceExpiration ?? 86400,
      providers: {
        cryptoBot: pollingConfig?.providers?.cryptoBot ?? true,
        heleke: pollingConfig?.providers?.heleke ?? true,
        yooKassa: pollingConfig?.providers?.yooKassa ?? true,
      },
    };

    this.logger.log(
      `Initialized (enabled: ${this.config.enabled}, interval: ${this.config.interval}ms, batch: ${this.config.batchSize})`,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Polling disabled via configuration');

      return;
    }

    const hasPollingProvider = Object.values(PaymentProvider).some((p) => this.isProviderPollingEnabled(p));

    if (!hasPollingProvider) {
      this.logger.log('Polling disabled: all providers use webhook-only strategy');

      return;
    }

    this.startPolling();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopPolling();
  }

  triggerManualPoll(): Promise<void> {
    this.logger.log('Manual poll triggered');

    return this.pollPendingTransactions();
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      running: this.pollingIntervalId !== null,
      interval: this.config.interval,
      maxPendingAge: this.config.maxPendingAge,
      batchSize: this.config.batchSize,
      providers: Object.fromEntries(Object.values(PaymentProvider).map((p) => [p, this.isProviderPollingEnabled(p)])),
    };
  }

  private startPolling(): void {
    if (this.pollingIntervalId) {
      this.logger.warn('Polling already running');

      return;
    }

    this.logger.log(`Starting polling (interval: ${this.config.interval}ms)`);

    this.pollPendingTransactions().catch((e) => this.logger.error('Initial poll error', e));

    this.pollingIntervalId = setInterval(() => {
      this.pollPendingTransactions().catch((e) => this.logger.error('Poll interval error', e));
    }, this.config.interval);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      this.logger.log('Polling stopped');
    }
  }

  private isProviderPollingEnabled(provider: PaymentProvider): boolean {
    const strategyGetters: Record<PaymentProvider, () => PaymentUpdateStrategy | undefined> = {
      [PaymentProvider.CryptoBot]: () => this.paymentConfig.getCryptoBotConfig()?.updateStrategy,
      [PaymentProvider.Heleket]: () => this.paymentConfig.getHelekeConfig()?.updateStrategy,
      [PaymentProvider.YooKassa]: () => this.paymentConfig.getYooKassaConfig()?.updateStrategy,
    };

    const strategy = strategyGetters[provider]() ?? PaymentUpdateStrategy.Hybrid;
    const strategyAllows = strategy === PaymentUpdateStrategy.Polling || strategy === PaymentUpdateStrategy.Hybrid;
    const configKey = this.providerConfigKeys[provider];

    return strategyAllows && this.config.providers[configKey];
  }

  private async pollPendingTransactions(): Promise<void> {
    if (this.isPolling) {
      this.logger.debug('Poll already in progress, skipping');

      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      const em = this.em.fork();
      const cutoffDate = new Date(Date.now() - this.config.maxPendingAge * 60 * 1000);

      const transactions = await em.find(
        PaymentTransactionEntity,
        {
          status: { $in: [PaymentStatus.Pending, PaymentStatus.Processing] },
          createdAt: { $gte: cutoffDate },
        },
        {
          limit: this.config.batchSize,
          orderBy: { createdAt: 'ASC' },
        },
      );

      if (transactions.length === 0) {
        return;
      }

      const results = { updated: 0, failed: 0, skipped: 0 };

      for (const tx of transactions) {
        if (!this.isProviderPollingEnabled(tx.provider)) {
          results.skipped++;
          continue;
        }

        try {
          // eslint-disable-next-line no-await-in-loop
          const wasUpdated = await this.syncTransaction(tx);
          if (wasUpdated) {
            results.updated++;
          }
        } catch (error) {
          results.failed++;
          this.logger.error(`Poll failed for ${tx.id}`, toError(error));
        }
      }

      // Only log if something changed
      if (results.updated > 0 || results.failed > 0) {
        const duration = Date.now() - startTime;
        this.logger.log(`Poll: ${results.updated} updated, ${results.failed} failed (${duration}ms)`);
      }
    } catch (error) {
      this.logger.error('Poll cycle error', toError(error));
    } finally {
      this.isPolling = false;
    }
  }

  private async syncTransaction(transaction: PaymentTransactionEntity): Promise<boolean> {
    if (!transaction.providerTransactionId) {
      this.logger.warn(`Transaction ${transaction.id} missing provider ID, skipping`);

      return false;
    }

    // Auto-expire old pending invoices (configurable via PAYMENT_INVOICE_EXPIRATION)
    const invoiceExpirationMs = this.config.invoiceExpiration * 1000;
    const transactionCreatedAt = transaction.createdAt ?? new Date();
    const transactionAge = Date.now() - transactionCreatedAt.getTime();

    if (transactionAge > invoiceExpirationMs && transaction.status === PaymentStatus.Pending) {
      const em = this.em.fork();
      const tx = await em.findOne(PaymentTransactionEntity, { id: transaction.id });

      if (tx) {
        tx.status = PaymentStatus.Expired;
        await em.flush();
        this.logger.log(`${transaction.id}: ${transaction.status} -> expired (invoice timeout)`);

        return true;
      }
    }

    const result = await this.paymentService.syncTransactionStatus(transaction.id);

    if (result.err) {
      this.logger.warn(`Sync failed for ${transaction.id}: ${result.val.message}`);

      return false;
    }

    const synced = result.val;
    const statusChanged = synced.status !== transaction.status;

    if (statusChanged) {
      this.logger.log(`${transaction.id}: ${transaction.status} -> ${synced.status}`);
    }

    return statusChanged;
  }
}
