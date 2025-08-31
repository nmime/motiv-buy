import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { StatisticController } from './controller/statistic.controller';
import { StatisticService } from './service/statistic.service';
import { 
  UserEntity,
  TrafficOrderEntity, 
  TrafficActionsEntity,
  UserBalanceHistoryEntity 
} from '@app/database';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      UserEntity,
      TrafficOrderEntity,
      TrafficActionsEntity,
      UserBalanceHistoryEntity
    ])
  ],
  controllers: [StatisticController],
  providers: [StatisticService],
  exports: [StatisticService],
})
export class StatisticMainModule {}