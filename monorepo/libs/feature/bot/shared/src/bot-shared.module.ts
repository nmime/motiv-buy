import { Module } from '@nestjs/common';
import { RedisModule } from '@app/common-redis';
import { DatabaseModule } from '@app/database';

/**
 * Bot Shared Module
 * 
 * Shared utilities and services for bot functionality.
 * Provides common bot types, DTOs, and utility functions
 * that can be reused across bot implementations.
 * 
 * @module BotSharedModule
 */
@Module({
  imports: [
    RedisModule,
    DatabaseModule,
  ],
  providers: [],
  exports: [],
})
export class BotSharedModule {}