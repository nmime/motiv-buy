import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentTransactionEntity } from '@app/database';
import { CurrencySharedModule } from '@app/feature-currency-shared';
import { PaymentConfigModule } from './config/payment-config.module';
import { CryptoBotProvider } from './provider/crypto-bot.provider';
import { HeleketProvider } from './provider/heleket.provider';
import { YooKassaProvider } from './provider/yookassa.provider';
import { PaymentProviderFactory } from './service/payment-provider.factory';
import { ProviderRoutingService } from './service/provider-routing.service';
import { PaymentService } from './service/payment.service';
import { PaymentEventService } from './service/payment-event.service';

/**
 * Payment Shared Module
 *
 * Global module that exports shared payment-related types, enums, interfaces, DTOs,
 * configuration services, payment providers, and payment service.
 *
 * This module provides type definitions, shared contracts, centralized configuration,
 * and core payment functionality used by other modules.
 */
@Global()
@Module({
  imports: [PaymentConfigModule, CurrencySharedModule, MikroOrmModule.forFeature([PaymentTransactionEntity])],
  providers: [
    // Payment providers
    CryptoBotProvider,
    HeleketProvider,
    YooKassaProvider,
    // Services
    PaymentProviderFactory,
    ProviderRoutingService,
    PaymentService,
    PaymentEventService,
  ],
  exports: [
    PaymentConfigModule,
    MikroOrmModule, // Export repository for PaymentMainModule's PaymentPollingService
    // Payment providers
    CryptoBotProvider,
    HeleketProvider,
    YooKassaProvider,
    // Services
    PaymentProviderFactory,
    ProviderRoutingService,
    PaymentService,
    PaymentEventService,
  ],
})
export class PaymentSharedModule {}
