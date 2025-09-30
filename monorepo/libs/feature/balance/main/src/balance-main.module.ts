import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { BalanceService } from './service/balance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceMainModule {}
