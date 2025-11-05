import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum StatisticType {
  TrafficSource = 'traffic_source',
  TrafficOrder = 'traffic_order',
  TrafficTarget = 'traffic_target',
  User = 'user',
}

export class StatisticQueryDto {
  @ApiPropertyOptional({
    description: 'Type of statistic to retrieve',
    enum: StatisticType,
    example: StatisticType.TrafficSource,
  })
  @IsEnum(StatisticType)
  type!: StatisticType;

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

  @ApiPropertyOptional({
    description: 'Optional action ID to filter by specific action',
    example: 'uuid-action-id',
  })
  @IsOptional()
  @IsUUID()
  actionId?: string;

  @ApiPropertyOptional({
    description: 'Resource-specific filtering by owner/creator',
    example: true,
    default: true,
  })
  @IsOptional()
  filterByOwnership?: boolean = true;
}
