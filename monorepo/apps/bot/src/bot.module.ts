import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule } from '@app/feature-bot-main';
import { TrafficMainModule, ModerationService } from '@app/feature-traffic-main';
import { IModerationService } from '@app/feature-traffic-shared';
import { NotificationMainModule } from '@app/feature-notification-main';
import { BotService } from './service';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Integrates notification system for scheduled notifications and event processing.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Bot domain module - contains all business logic
    BotMainModule,

    // Traffic domain module - integrates with bot and notification systems
    TrafficMainModule,

    // Notification module - enables scheduled notification processing
    NotificationMainModule,
  ],
  providers: [
    // Thin wrapper service
    BotService,

    // Wire abstract class to implementation (breaks circular dependency)
    // bot-main depends on IModerationService abstract class from traffic-shared
    // We provide the concrete ModerationService from traffic-main here
    {
      provide: IModerationService,
      useExisting: ModerationService,
    },
  ],
  exports: [BotService],
})
export class BotModule {}
