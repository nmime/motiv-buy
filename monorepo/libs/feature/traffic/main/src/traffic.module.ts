import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficController } from './controller';
import { TrafficOrderController } from './controller/traffic-order.controller';
import { TrafficTargetController } from './controller/traffic-target.controller';
import { TrafficSourceController } from './controller/traffic-source.controller';
import { TrafficService } from './service';
import {
  TrafficTargetEntity,
  TrafficOrderEntity,
  TrafficSourceEntity,
  TrafficUserEntity,
  UserEntity,
} from '@app/database';
import { TrafficTargetMapper, TrafficSourceMapper, TrafficOrderMapper } from './mapper';

@Module({
  imports: [
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
  ],
  exports: [TrafficService],
})
export class TrafficMainModule {}
