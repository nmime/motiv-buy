import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { PaymentMainModule } from '@app/feature-payment-main';
import { CurrencySharedModule } from '@app/feature-currency-shared';
import { BalanceService } from './service/balance.service';

@Module({
  imports: [ConfigModule, DatabaseModule, PaymentMainModule, CurrencySharedModule],
  providers: [BalanceService],
  exports: [BalanceService, CurrencySharedModule],
})
export class BalanceMainModule {}
