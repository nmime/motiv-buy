import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule } from '@app/feature-bot-main';
import { TrafficMainModule, ModerationService } from '@app/feature-traffic-main';
import { IModerationService } from '@app/feature-traffic-shared';
import { BotService } from './service';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 *
 * Note: Imports both BotMainModule and TrafficMainModule to enable dependency injection
 * of TelegramModerationNotifier (from bot) into Traffic services.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Bot domain module - contains all business logic
    BotMainModule,

    // Traffic domain module - uses TelegramModerationNotifier from BotMainModule
    TrafficMainModule,
  ],
  providers: [
    // Thin wrapper service
    BotService,

    // Wire interface to implementation (breaks circular dependency)
    // bot-main depends on IModerationService interface from traffic-shared
    // We provide the concrete ModerationService from traffic-main here
    {
      provide: IModerationService,
      useExisting: ModerationService,
    },
  ],
  exports: [BotService],
})
export class BotModule {}
