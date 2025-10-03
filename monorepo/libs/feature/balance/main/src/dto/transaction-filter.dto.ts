import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum TransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  TrafficPurchase = 'traffic_purchase',
  TrafficSale = 'traffic_sale',
  Refund = 'refund',
  Referral = 'referral',
}

/**
 * Transaction filter DTO for querying transaction history
 */
export class TransactionFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: TransactionType,
    example: TransactionType.Deposit,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Start date for filtering (YYYY-MM-DD or ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (YYYY-MM-DD or ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
