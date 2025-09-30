import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { StatisticService } from './service';
import { StatisticRepository } from './repository';
import { StatisticMapper } from './mapper';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [StatisticService, StatisticRepository, StatisticMapper],
  exports: [StatisticService, StatisticRepository, StatisticMapper],
})
export class StatisticMainModule {}
