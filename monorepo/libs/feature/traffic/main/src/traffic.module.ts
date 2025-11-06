import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SourceManagementService, SourcePublicApiService, TrafficService } from './service';
import { TrafficSourceManagementController, TrafficSourcePublicController } from './controller';
import {
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

@Module({
  imports: [
    TrafficSharedModule,
    MikroOrmModule.forFeature([
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
    TrafficService,
    SourcePublicApiService,
    SourceManagementService,
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
    TrafficTargetRepository,
    TrafficSourceRepository,
    TrafficOrderRepository,
    TrafficOrderBalanceRepository,
    TrafficActionsRepository,
    UserBalanceRepository,
    UserBalanceHistoryRepository,
  ],
  exports: [TrafficService, SourcePublicApiService, SourceManagementService],
})
export class TrafficMainModule {}
