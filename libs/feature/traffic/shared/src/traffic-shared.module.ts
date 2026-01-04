import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BotSharedModule } from '@app/feature-bot-shared';
import {
  TrafficActionsEntity,
  TrafficOrderBalanceEntity,
  TrafficOrderEntity,
  TrafficSourceBalanceEntity,
  TrafficSourceBalanceHistoryEntity,
  TrafficSourceBalanceRepository,
  TrafficSourceEntity,
  TrafficSourceRepository,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserBalanceRepository,
} from '@app/database';
import { BotTokenValidationService, SourceBalanceService, TrafficActionService } from './service';

/**
 * Traffic Shared Module
 *
 * Provides shared traffic-related services, DTOs, guards, and utilities
 * for cross-domain reusability across the application.
 *
 * Imports BotSharedModule for BotFactoryService (bot token validation)
 */
@Module({
  imports: [
    BotSharedModule,
    MikroOrmModule.forFeature([
      TrafficSourceEntity,
      TrafficSourceBalanceEntity,
      TrafficSourceBalanceHistoryEntity,
      TrafficActionsEntity,
      TrafficOrderEntity,
      TrafficOrderBalanceEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity,
    ]),
  ],
  providers: [
    BotTokenValidationService,
    SourceBalanceService,
    TrafficActionService,
    TrafficSourceRepository,
    TrafficSourceBalanceRepository,
    UserBalanceRepository,
  ],
  exports: [BotTokenValidationService, SourceBalanceService, TrafficActionService, TrafficSourceBalanceRepository],
})
export class TrafficSharedModule {}
