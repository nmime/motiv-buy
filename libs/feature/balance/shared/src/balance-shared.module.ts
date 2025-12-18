import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { BalanceQueryService } from './service/balance-query.service';

/**
 * Balance Shared Module
 *
 * Provides shared balance-related services, DTOs, and utilities
 * for cross-domain reusability across the application.
 */
@Module({
  imports: [DatabaseModule],
  providers: [BalanceQueryService],
  exports: [BalanceQueryService],
})
export class BalanceSharedModule {}
