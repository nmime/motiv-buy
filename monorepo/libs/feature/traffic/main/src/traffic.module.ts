import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficService } from './service';
import {
  TrafficTargetEntity,
  TrafficOrderEntity,
  TrafficSourceEntity,
  TrafficUserEntity,
  UserEntity,
  TrafficTargetRepository,
  TrafficSourceRepository,
  TrafficOrderRepository,
} from '@app/database';
import { TrafficTargetMapper, TrafficSourceMapper, TrafficOrderMapper } from './mapper';
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
