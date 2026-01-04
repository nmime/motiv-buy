import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrencyRateService } from './currency-rate.service';

/**
 * Currency Rate Scheduler Service
 *
 * Handles scheduled currency rate updates.
 * This service is exported but NOT provided in CurrencySharedModule.
 * It should only be registered as provider in the bot application.
 *
 * Cron jobs:
 * - updateAllRates: Every 10 minutes
 * - cleanupOldRates: Daily at 3 AM
 */
@Injectable()
export class CurrencyRateSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyRateSchedulerService.name);

  constructor(private readonly currencyRateService: CurrencyRateService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Currency rate scheduler initializing');
    setTimeout(() => {
      this.performInitialization().catch((error) => {
        this.logger.error('Initialization failed', { error });
      });
    }, 1000);
  }

  private async performInitialization(): Promise<void> {
    await this.currencyRateService.updateAllRates();
    this.logger.log('Currency rate scheduler ready');
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleRateUpdate(): Promise<void> {
    await this.currencyRateService.updateAllRates();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleRateCleanup(): Promise<void> {
    await this.currencyRateService.cleanupOldRates();
  }
}
