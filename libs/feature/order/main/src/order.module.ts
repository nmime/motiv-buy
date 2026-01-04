import { Module } from '@nestjs/common';
import { OrderService } from './order.service';

/**
 * Order Module
 *
 * Provides order business logic services.
 * The channel service must be provided by the importing module.
 */
@Module({
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
