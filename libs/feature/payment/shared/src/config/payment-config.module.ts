import { Global, Module } from '@nestjs/common';
import { PaymentConfigService } from './payment-config.service';

/**
 * Payment Configuration Module
 *
 * Global module that provides centralized payment configuration.
 * Validates environment variables using Joi schema and exports PaymentConfigService.
 */
@Global()
@Module({
  imports: [],
  providers: [PaymentConfigService],
  exports: [PaymentConfigService],
})
export class PaymentConfigModule {}
