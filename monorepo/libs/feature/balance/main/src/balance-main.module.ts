import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { BalanceController } from './controller/balance.controller';
import { BalanceService } from './service/balance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceMainModule {}
