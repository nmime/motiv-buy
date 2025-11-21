import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { PaymentMainModule } from '@app/feature-payment-main';
import { CurrencySharedModule } from '@app/feature-currency-shared';
import { BalanceService } from './service/balance.service';
import { BalanceController } from './controller/balance.controller';

@Module({
  imports: [ConfigModule, DatabaseModule, PaymentMainModule, CurrencySharedModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceMainModule {}
