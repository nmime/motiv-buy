/**
 * Order Feature Module (Bot UI)
 *
 * Provides order UI handlers for the bot including:
 * - Order creation flow (A1-A6)
 * - Order configuration and editing
 * - Order statistics and analytics
 * - Sub-handlers for modular organization
 */

import { Module } from '@nestjs/common';
import { BotSharedModule } from '@app/feature-bot-shared';
import { BotOrderService } from './bot-order.service';
import { OrderHandler } from './order.handler';
import { OrderConfigHandler } from './order.config.handler';
import { OrderCreationHandler } from './order.creation.handler';
import { OrderEditHandler } from './order.edit.handler';
import { OrderManagementHandler } from './order.management.handler';

@Module({
  imports: [BotSharedModule],
  providers: [
    BotOrderService,
    OrderHandler,
    OrderCreationHandler,
    OrderManagementHandler,
    OrderConfigHandler,
    OrderEditHandler,
  ],
  exports: [BotOrderService, OrderHandler],
})
export class OrderModule {}
