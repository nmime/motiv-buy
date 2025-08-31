import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BalanceController } from './controller/balance.controller';
import { BalanceService } from './service/balance.service';
import { 
  UserEntity,
  UserBalanceEntity,
  UserBalanceHistoryEntity 
} from '@app/database';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      UserEntity,
      UserBalanceEntity,
      UserBalanceHistoryEntity
    ])
  ],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceMainModule {}