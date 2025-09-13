import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';

export enum StatisticType {
  TRAFFIC_SOURCE = 'traffic_source',
  TRAFFIC_ORDER = 'traffic_order', 
  TRAFFIC_TARGET = 'traffic_target',
  USER = 'user',
}

export class StatisticQueryDto {
  @ApiPropertyOptional({
    description: 'Type of statistic to retrieve',
    enum: StatisticType,
    example: StatisticType.TRAFFIC_SOURCE,
  })
  @IsOptional()
  @IsEnum(StatisticType)
  type?: StatisticType;

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

  @ApiPropertyOptional({
    description: 'Optional order ID to filter by specific order',
    example: 'uuid-order-id',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Optional source ID to filter by specific traffic source',
    example: 'uuid-source-id',
  })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({
    description: 'Optional target ID to filter by specific traffic target',
    example: 'uuid-target-id',
  })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Optional user ID to filter by specific user',
    example: 'uuid-user-id',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
