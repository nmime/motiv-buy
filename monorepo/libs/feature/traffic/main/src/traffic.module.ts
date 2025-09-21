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
import { ITrafficTargetRepository, ITrafficSourceRepository, ITrafficOrderRepository } from './repository';

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
  controllers: [TrafficController, TrafficOrderController, TrafficTargetController, TrafficSourceController],
  providers: [
    TrafficService,
    // Repository implementations
    {
      provide: ITrafficTargetRepository,
      useClass: TrafficTargetMapper,
    },
    {
      provide: ITrafficSourceRepository,
      useClass: TrafficSourceMapper,
    },
    {
      provide: ITrafficOrderRepository,
      useClass: TrafficOrderMapper,
    },
    // Mapper implementations
    TrafficTargetMapper,
    TrafficSourceMapper,
    TrafficOrderMapper,
  ],
  exports: [
    TrafficService,
    TrafficController,
    TrafficOrderController,
    TrafficTargetController,
    TrafficSourceController,
    ITrafficTargetRepository,
    ITrafficSourceRepository,
    ITrafficOrderRepository,
  ],
})
export class TrafficMainModule {}
