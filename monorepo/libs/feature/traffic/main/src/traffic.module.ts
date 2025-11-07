import { Module } from '@nestjs/common';
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
  TrafficOrderBalanceEntity,
  TrafficOrderBalanceRepository,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficTargetEntity,
  TrafficTargetRepository,
  TrafficUserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity,
  UserBalanceHistoryRepository,
  UserBalanceRepository,
  UserEntity,
} from '@app/database';
import { TrafficOrderMapper, TrafficSourceMapper, TrafficTargetMapper } from './mapper';
import { TrafficSharedModule } from '@app/feature-traffic-shared';
import { BotSharedModule } from '@app/feature-bot-shared';

@Module({
  imports: [
    TrafficSharedModule,
    BotSharedModule,
    // Note: BotMainModule removed to prevent circular dependency
    // TelegramModerationNotifier is injected by the app layer
    MikroOrmModule.forFeature([
      ModerationRequestEntity,
      TrafficTargetEntity,
      TrafficOrderEntity,
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
    UserBalanceRepository,
    UserBalanceHistoryRepository,
  ],
  exports: [ModerationService, TrafficService, SourcePublicApiService, SourceManagementService],
})
export class TrafficMainModule {}
