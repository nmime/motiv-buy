import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule, ModerationServiceToken } from '@app/feature-bot-main';
import { TrafficMainModule, ModerationService } from '@app/feature-traffic-main';
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

    // Provide ModerationService for dependency injection across circular boundaries
    {
      provide: ModerationServiceToken,
      useExisting: ModerationService,
    },
  ],
  exports: [BotService],
})
export class BotModule {}
