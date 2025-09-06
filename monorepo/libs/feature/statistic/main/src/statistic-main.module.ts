import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { StatisticController } from './controller/statistic.controller';
import { StatisticService } from './service/statistic.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StatisticController],
  providers: [StatisticService],
  exports: [StatisticService],
})
export class StatisticMainModule {}
