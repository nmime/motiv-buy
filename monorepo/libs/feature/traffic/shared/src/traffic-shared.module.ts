import { Module } from '@nestjs/common';
import { BotTokenValidationService } from './service';

/**
 * Traffic Shared Module
 *
 * Provides shared traffic-related services, DTOs, guards, and utilities
 * for cross-domain reusability across the application.
 */
@Module({
  imports: [],
  providers: [BotTokenValidationService],
  exports: [BotTokenValidationService],
})
export class TrafficSharedModule {}
