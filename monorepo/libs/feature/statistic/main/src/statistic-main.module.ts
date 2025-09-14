import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { StatisticController, StatisticPublicController } from './controller';
import { StatisticService } from './service';
import { StatisticRepository } from './repository';
import { StatisticMapper } from './mapper';

@Module({
  imports: [DatabaseModule],
  controllers: [StatisticController, StatisticPublicController],
  providers: [StatisticService, StatisticRepository, StatisticMapper],
  exports: [StatisticService, StatisticRepository, StatisticMapper],
})
export class StatisticMainModule {}
