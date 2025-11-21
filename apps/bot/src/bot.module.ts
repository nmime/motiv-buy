import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule } from '@app/feature-bot-main';
import { TrafficMainModule } from '@app/feature-traffic-main';
import { NotificationMainModule } from '@app/feature-notification-main';
import { BotService } from './service';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Architecture:
 * - All handlers and services are provided by BotMainModule
 * - This module only provides the thin wrapper BotService
 * - Follows proper NestJS module architecture with no duplicate providers
 *
 * Integrates notification system for scheduled notifications and event processing.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Bot domain module - contains all business logic and handlers
    BotMainModule,

    // Traffic domain module - integrates with bot and notification systems
    TrafficMainModule,

    // Notification module - enables scheduled notification processing
    NotificationMainModule,
  ],
  providers: [
    // Only the thin wrapper service is provided here
    // All other services and handlers are provided by BotMainModule
    BotService,
  ],
  exports: [BotService],
})
export class BotModule {}
