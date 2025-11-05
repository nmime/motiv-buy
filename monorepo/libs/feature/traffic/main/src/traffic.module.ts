import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficService } from './service';
import {
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
      UserEntity,
    ]),
  ],
  controllers: [],
  providers: [
    TrafficService,
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
    TrafficTargetRepository,
    TrafficSourceRepository,
    TrafficOrderRepository,
  ],
  exports: [TrafficService],
})
export class TrafficMainModule {}
