import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { CurrencyRateService } from './service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [CurrencyRateService],
  exports: [CurrencyRateService],
})
export class CurrencySharedModule {}
