import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsDateString, IsOptional } from 'class-validator';
import { StatisticType } from './statistic-query.dto';

export enum ChartInterval {
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

/**
 * Line chart query DTO for time-series chart data
 */
export class LineChartQueryDto {
  @ApiPropertyOptional({
    description: 'Type of statistic for chart data (optional for public endpoints with share token)',
    enum: StatisticType,
    example: StatisticType.TrafficSource,
  })
  @IsOptional()
  @IsEnum(StatisticType)
  type?: StatisticType;

  @ApiProperty({
    description: 'Chart start date (YYYY-MM-DD or ISO 8601)',
    example: '2024-01-01',
  })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'Chart end date (YYYY-MM-DD or ISO 8601)',
    example: '2024-01-31',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Data grouping interval',
    enum: ChartInterval,
    example: ChartInterval.Day,
    default: ChartInterval.Hour,
  })
  @IsOptional()
  @IsEnum(ChartInterval)
  interval?: ChartInterval = ChartInterval.Hour;

  @ApiPropertyOptional({
    description: 'Optional user ID for user-specific chart data',
    example: 'uuid-user-id',
  })
  @IsOptional()
  userId?: string;
}
