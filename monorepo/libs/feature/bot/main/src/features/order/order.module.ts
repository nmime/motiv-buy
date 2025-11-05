/**
 * Order Feature Module
 *
 * Provides order management functionality including:
 * - Order creation flow (A1-A6)
 * - Order configuration and editing
 * - Order statistics and analytics
 * - Sub-handlers for modular organization
 */

import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderHandler } from './order.handler';
import { OrderConfigHandler, OrderCreationHandler, OrderEditHandler, OrderManagementHandler } from './handlers';

@Module({
  providers: [
    OrderService,
    OrderHandler,
    OrderCreationHandler,
    OrderManagementHandler,
    OrderConfigHandler,
    OrderEditHandler,
  ],
  exports: [OrderService, OrderHandler],
})
export class OrderModule {}
