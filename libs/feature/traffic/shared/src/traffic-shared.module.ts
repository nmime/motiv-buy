import { Module } from '@nestjs/common';
import { BotSharedModule } from '@app/feature-bot-shared';
import { BotTokenValidationService } from './service';

/**
 * Traffic Shared Module
 *
 * Provides shared traffic-related services, DTOs, guards, and utilities
 * for cross-domain reusability across the application.
 *
 * Imports BotSharedModule to access IBotTokenValidator for real Telegram API validation
 */
@Module({
  imports: [BotSharedModule],
  providers: [BotTokenValidationService],
  exports: [BotTokenValidationService],
})
export class TrafficSharedModule {}
