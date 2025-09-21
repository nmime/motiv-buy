import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotMainModule } from '@app/feature-bot-main';
import { BotService } from './service';

/**
 * Bot Application Module
 *
 * Thin composition root that wires up domain modules for bot functionality.
 * No business logic should be implemented here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Bot domain module - contains all business logic
    BotMainModule,
  ],
  providers: [
    // Thin wrapper service
    BotService,
  ],
  exports: [BotService],
})
export class BotModule {}
