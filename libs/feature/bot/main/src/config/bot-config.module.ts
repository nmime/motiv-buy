import { Global, Module } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';

/**
 * Bot Configuration Module
 *
 * Global module that provides centralized bot configuration.
 * Exports BotConfigService for type-safe access to bot settings.
 */
@Global()
@Module({
  imports: [],
  providers: [BotConfigService],
  exports: [BotConfigService],
})
export class BotConfigModule {}
