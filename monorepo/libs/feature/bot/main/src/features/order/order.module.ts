/**
 * Order Feature Module
 */

import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderHandler } from './order.handler';

@Module({
  providers: [OrderService, OrderHandler],
  exports: [OrderService, OrderHandler],
})
export class OrderModule {}
