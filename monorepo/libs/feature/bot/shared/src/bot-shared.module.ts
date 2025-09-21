import { Module } from '@nestjs/common';

/**
 * Bot Shared Module
 *
 * Minimal shared module that exports only essential types, DTOs, enums,
 * and utilities for other modules to consume. Contains no business logic.
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class BotSharedModule {}
