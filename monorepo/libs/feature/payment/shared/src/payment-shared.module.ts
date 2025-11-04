import { Global, Module } from '@nestjs/common';
import { PaymentConfigModule } from './config/payment-config.module';

/**
 * Payment Shared Module
 *
 * Global module that exports shared payment-related types, enums, interfaces, DTOs,
 * and configuration services for cross-domain reusability across the application.
 *
 * This module provides type definitions, shared contracts, and centralized configuration
 * used by other payment-related modules.
 */
@Global()
@Module({
  imports: [PaymentConfigModule],
  providers: [],
  exports: [PaymentConfigModule],
})
export class PaymentSharedModule {}
