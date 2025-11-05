import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { DatabaseModule, PaymentTransactionEntity } from '@app/database';
import { CryptoBotProvider } from './provider/crypto-bot.provider';
import { HelekeProvider } from './provider/heleket.provider';
import { YooKassaProvider } from './provider/yookassa.provider';
import { PaymentProviderFactory } from './service/payment-provider.factory';
import { PaymentService } from './service/payment.service';
import { PaymentController } from './controller/payment.controller';
import { PaymentWebhookController } from './controller/payment-webhook.controller';

/**
 * Payment Main Module
 *
 * Main payment feature module that handles payment processing across multiple providers,
 * including top-ups, withdrawals, invoice management, and webhook processing.
 *
 * Features:
 * - Multiple payment provider integrations (CryptoBot, Heleket, YooKassa)
 * - Each provider has isolated context and configuration
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
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [CryptoBotProvider, HelekeProvider, YooKassaProvider, PaymentProviderFactory, PaymentService],
  exports: [PaymentService, PaymentProviderFactory, CryptoBotProvider, HelekeProvider, YooKassaProvider],
})
export class PaymentMainModule {}
