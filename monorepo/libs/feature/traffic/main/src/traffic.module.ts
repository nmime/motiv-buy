import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SourceManagementService, SourceTaskService, TrafficService } from './service';
import { TrafficSourceManagementController, TrafficSourcePublicController } from './controller';
import {
  TrafficActionsEntity,
  TrafficActionsRepository,
  TrafficOrderEntity,
  TrafficOrderRepository,
  TrafficSourceEntity,
  TrafficSourceRepository,
  TrafficTargetEntity,
  TrafficTargetRepository,
  TrafficUserEntity,
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
      TrafficSourceEntity,
      TrafficUserEntity,
      TrafficActionsEntity,
      UserEntity,
    ]),
  ],
  controllers: [TrafficSourcePublicController, TrafficSourceManagementController],
  providers: [
    TrafficService,
    SourceTaskService,
    SourceManagementService,
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
    TrafficTargetRepository,
    TrafficSourceRepository,
    TrafficOrderRepository,
    TrafficActionsRepository,
  ],
  exports: [TrafficService, SourceTaskService, SourceManagementService],
})
export class TrafficMainModule {}
