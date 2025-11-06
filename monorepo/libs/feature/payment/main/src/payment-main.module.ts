import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import {
  DatabaseModule,
  PaymentTransactionEntity,
  PaymentProviderRepository,
  ProviderCurrencyRepository,
  ProviderRoutingRepository,
} from '@app/database';
import { CurrencySharedModule } from '@app/feature-currency-shared';
import { AppCommonIntlModule } from '@app/common-intl';
import { CryptoBotProvider } from './provider/crypto-bot.provider';
import { HelekeProvider } from './provider/heleket.provider';
import { YooKassaProvider } from './provider/yookassa.provider';
import { PaymentProviderFactory } from './service/payment-provider.factory';
import { PaymentService } from './service/payment.service';
import { ProviderRoutingService } from './service/provider-routing.service';
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
 * - Multiple payment provider integrations (CryptoBot, Heleket, YooKassa)
 * - Smart routing system for dynamic provider selection
 * - Each provider has isolated context and configuration
 * - Invoice creation and management
 * - Transfer/withdrawal processing
 * - Webhook handling for payment notifications (push-based)
 * - Polling service for status updates (pull-based)
 * - Hybrid update strategies (webhook + polling for maximum reliability)
 * - Balance integration for user credits
 * - Internationalization support
 * - Centralized configuration via PaymentConfigModule
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([PaymentTransactionEntity]),
    PaymentSharedModule, // Includes PaymentConfigModule
    DatabaseModule, // For repository access
    CurrencySharedModule, // For CurrencyRateService
    AppCommonIntlModule, // For I18n support
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    // Payment providers
    CryptoBotProvider,
    HelekeProvider,
    YooKassaProvider,
    // Services
    PaymentProviderFactory,
    PaymentService,
    ProviderRoutingService,
    PaymentPollingService,
    // Repositories for routing
    PaymentProviderRepository,
    ProviderCurrencyRepository,
    ProviderRoutingRepository,
  ],
  exports: [
    PaymentService,
    PaymentProviderFactory,
    PaymentPollingService,
    CryptoBotProvider,
    HelekeProvider,
    YooKassaProvider,
  ],
})
export class PaymentMainModule {}
