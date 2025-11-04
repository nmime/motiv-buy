import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database';
import { PaymentMainModule } from '@app/feature-payment-main';
import { BalanceService } from './service/balance.service';
import { CurrencyRateService } from './service/currency-rate.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), DatabaseModule, PaymentMainModule],
  providers: [BalanceService, CurrencyRateService],
  exports: [BalanceService, CurrencyRateService],
})
export class BalanceMainModule {}
