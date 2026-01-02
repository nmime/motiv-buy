import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ModerationService, SourceManagementService, SourcePublicApiService, TrafficService } from './service';
import {
  SourceBalanceController,
  TrafficSourceManagementController,
  TrafficSourcePublicController,
} from './controller';
import {
  ModerationRequestEntity,
  ModerationRequestRepository,
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficOrderBalanceEntity,
  TrafficOrderBalanceRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderSourceEntity,
  TrafficOrderTargetEntity,
  TrafficSourceBalanceEntity,
  TrafficSourceBalanceHistoryEntity,
  TrafficSourceBalanceRepository,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficTargetEntity,
  TrafficTargetRepository,
  TrafficUserEntity,
  TrafficUserRepository,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
  UserEntity,
} from '@app/database';
import { TrafficOrderMapper, TrafficSourceMapper, TrafficTargetMapper } from './mapper';
import { TrafficSharedModule } from '@app/feature-traffic-shared';
import { BotSharedModule } from '@app/feature-bot-shared';
import { BalanceSharedModule } from '@app/feature-balance-shared';

@Module({
  imports: [
    ThrottlerModule,
    TrafficSharedModule,
    BotSharedModule,
    BalanceSharedModule,
    // Note: BotMainModule removed to prevent circular dependency
    // TelegramModerationNotifier is injected by the app layer
    MikroOrmModule.forFeature([
      ModerationRequestEntity,
      TrafficTargetEntity,
      TrafficOrderEntity,
      TrafficOrderSourceEntity,
      TrafficOrderTargetEntity,
      TrafficOrderBalanceEntity,
      TrafficSourceEntity,
      TrafficSourceBalanceEntity,
      TrafficSourceBalanceHistoryEntity,
      TrafficUserEntity,
      TrafficActionsEntity,
      UserEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity,
    ]),
  ],
  controllers: [TrafficSourcePublicController, TrafficSourceManagementController, SourceBalanceController],
  providers: [
    ModerationService,
    TrafficService,
    SourcePublicApiService,
    SourceManagementService,
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
    ModerationRequestRepository,
    TrafficTargetRepository,
    TrafficSourceRepository,
    TrafficOrderRepository,
    TrafficOrderBalanceRepository,
    TrafficActionsRepository,
    TrafficUserRepository,
    UserBalanceRepository,
    UserBalanceHistoryRepository,
    TrafficSourceBalanceRepository,
  ],
  exports: [ModerationService, TrafficService, SourcePublicApiService, SourceManagementService],
})
export class TrafficMainModule {}
