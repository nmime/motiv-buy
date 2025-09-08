import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TrafficController } from './controller';
import { TrafficService } from './service';
import { TrafficTargetEntity, TrafficOrderEntity, TrafficSourceEntity, TrafficUserEntity } from '@app/database';

@Module({
  imports: [
    MikroOrmModule.forFeature([TrafficTargetEntity, TrafficOrderEntity, TrafficSourceEntity, TrafficUserEntity]),
  ],
  controllers: [TrafficController],
  providers: [TrafficService],
  exports: [TrafficService],
})
export class UserMainModule {}
