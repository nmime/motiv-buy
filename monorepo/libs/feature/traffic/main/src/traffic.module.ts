import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficService, SourceBotService } from './service';
import { SourceBotController } from './controller';
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
  controllers: [SourceBotController],
  providers: [
    TrafficService,
    SourceBotService,
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
    TrafficTargetRepository,
    TrafficSourceRepository,
    TrafficOrderRepository,
    TrafficActionsRepository,
  ],
  exports: [TrafficService, SourceBotService],
})
export class TrafficMainModule {}
