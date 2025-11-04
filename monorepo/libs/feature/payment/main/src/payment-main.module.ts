import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { DatabaseModule, PaymentTransactionEntity } from '@app/database';
import { AppCommonIntlModule } from '@app/common-intl';
import { CryptoBotProvider } from './provider/crypto-bot.provider';
import { HeleketProvider } from './provider/heleket.provider';
import { YooKassaProvider } from './provider/yookassa.provider';
import { PaymentProviderRegistry } from './provider/provider-registry.service';
import { PaymentService } from './service/payment.service';
import { PaymentController } from './controller/payment.controller';
import { PaymentWebhookController } from './controller/payment-webhook.controller';

/**
 * Payment Main Module
 *
 * Main payment feature module that handles cryptocurrency payment processing,
 * including top-ups, withdrawals, invoice management, and webhook processing.
 *
 * Features:
 * - Multiple payment provider integrations (CryptoBot, Heleket, YooKassa)
 * - Provider registry for dynamic provider selection
 * - Invoice creation and management
 * - Transfer/withdrawal processing
 * - Webhook handling for payment notifications
 * - Balance integration for user credits
 * - Centralized configuration via PaymentConfigModule
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([PaymentTransactionEntity]),
    PaymentSharedModule, // Includes PaymentConfigModule
    DatabaseModule, // For repository access
    AppCommonIntlModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    // Payment providers
    CryptoBotProvider,
    HeleketProvider,
    YooKassaProvider,
    // Provider registry
    PaymentProviderRegistry,
    // Payment service
    PaymentService,
  ],
  exports: [PaymentService, PaymentProviderRegistry],
})
export class PaymentMainModule {}
