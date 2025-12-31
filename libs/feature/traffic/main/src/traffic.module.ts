import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ModerationService, SourceManagementService, SourcePublicApiService, TrafficService } from './service';
import { TrafficSourceManagementController, TrafficSourcePublicController } from './controller';
import {
  ModerationRequestEntity,
  ModerationRequestRepository,
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficOrderSourceEntity,
  TrafficOrderTargetEntity,
  TrafficOrderBalanceEntity,
  TrafficOrderBalanceRepository,
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
      TrafficUserEntity,
      TrafficActionsEntity,
      UserEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity,
    ]),
  ],
  controllers: [TrafficSourcePublicController, TrafficSourceManagementController],
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
  ],
  exports: [ModerationService, TrafficService, SourcePublicApiService, SourceManagementService],
})
export class TrafficMainModule {}
