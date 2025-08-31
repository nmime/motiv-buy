import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficController } from './controller/traffic.controller';
import { TrafficService } from './service/traffic.service';
import { 
  TrafficBuyerEntity, 
  TrafficOrderEntity, 
  TrafficSourceEntity, 
  TrafficUserEntity 
} from '@app/database';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      TrafficBuyerEntity,
      TrafficOrderEntity,
      TrafficSourceEntity,
      TrafficUserEntity
    ])
  ],
  controllers: [TrafficController],
  providers: [TrafficService],
  exports: [TrafficService],
})
export class UserMainModule {}