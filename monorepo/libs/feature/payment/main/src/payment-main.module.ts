import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { DatabaseModule } from '@app/database';
import { PaymentTransactionEntity } from './entity/payment-transaction.entity';
import { CryptoBotProvider } from './provider/crypto-bot.provider';
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
 * - CryptoBot payment provider integration
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
  providers: [CryptoBotProvider, PaymentService],
  exports: [PaymentService, CryptoBotProvider],
})
export class PaymentMainModule {}
