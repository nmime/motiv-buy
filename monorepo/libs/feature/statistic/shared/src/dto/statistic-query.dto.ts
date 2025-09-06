import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';

export enum StatisticType {
  SALE = 'sale',
  PURCHASE = 'purchase',
}

export class StatisticQueryDto {
  @ApiPropertyOptional({
    description: 'Type of statistic',
    enum: StatisticType,
    example: StatisticType.SALE,
  })
  @IsOptional()
  @IsEnum(StatisticType)
  type?: StatisticType;

  @ApiPropertyOptional({
    description: 'Optional order ID to filter by specific order',
    example: 'uuid-order-id',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
