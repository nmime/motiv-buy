import { Module } from '@nestjs/common';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { DatabaseModule } from '@app/database';
import { AppCommonIntlModule } from '@app/common-intl';
import { PaymentPollingService } from './service/payment-polling.service';
import { PaymentController } from './controller/payment.controller';
import { PaymentWebhookController } from './controller/payment-webhook.controller';

/**
 * Payment Main Module
 *
 * Main payment feature module that handles payment processing across multiple providers,
 * including top-ups, withdrawals, invoice management, webhook and polling processing.
 *
 * Features:
 * - Multiple payment provider integrations (CryptoBot, Heleket, YooKassa) - from PaymentSharedModule
 * - Smart routing system for dynamic provider selection - from PaymentSharedModule
 * - Each provider has isolated context and configuration
 * - Invoice creation and management
 * - Transfer/withdrawal processing
 * - Webhook handling for payment notifications (push-based)
 * - Polling service for status updates (pull-based)
 * - Hybrid update strategies (webhook + polling for maximum reliability)
 * - Balance integration for user credits
 * - Internationalization support
 * - Centralized configuration via PaymentConfigModule
 *
 * Note: Core payment providers and services are now in PaymentSharedModule.
 * This module adds controllers, polling service, and webhooks.
 */
@Module({
  imports: [
    PaymentSharedModule, // Core providers, services, and config
    DatabaseModule, // For repository access
    AppCommonIntlModule, // For I18n support
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    // Only main-specific services
    PaymentPollingService,
  ],
  exports: [
    // Note: PaymentService, PaymentProviderFactory, and providers
    // are exported from @Global() PaymentSharedModule and are
    // automatically available everywhere
    PaymentPollingService,
  ],
})
export class PaymentMainModule {}
