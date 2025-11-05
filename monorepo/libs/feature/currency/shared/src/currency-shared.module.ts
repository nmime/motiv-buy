import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database';
import { CurrencyRateService } from './service/currency-rate.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), DatabaseModule],
  providers: [CurrencyRateService],
  exports: [CurrencyRateService],
})
export class CurrencySharedModule {}
