import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StatisticType } from './statistic-query.dto';

export enum ChartInterval {
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
  Month = 'month',
}

export class LineChartQueryDto {
  @ApiProperty({
    description: 'Type of statistic for line chart',
    enum: StatisticType,
    example: StatisticType.TrafficSource,
  })
  @IsEnum(StatisticType)
  type!: StatisticType;

  @ApiProperty({
    description: 'Start date for chart data (YYYY-MM-DD or ISO 8601)',
    example: '2024-01-01',
  })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date for chart data (YYYY-MM-DD or ISO 8601)',
    example: '2024-12-31',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Chart data interval (minimum is hour)',
    enum: ChartInterval,
    default: ChartInterval.Hour,
    example: ChartInterval.Hour,
  })
  @IsOptional()
  @IsEnum(ChartInterval)
  interval?: ChartInterval = ChartInterval.Hour;
}

export class ChartDataPointDto {
  @ApiProperty({
    description:
      'Date/time point (format depends on interval: hour=YYYY-MM-DDTHH:00, day=YYYY-MM-DD, week=YYYY-MM-DD, month=YYYY-MM)',
    example: '2024-01-15T14:00',
  })
  date!: string;

  @ApiProperty({
    description: 'Count of actions for this time point',
    example: 150,
  })
  countOfActions!: number;

  @ApiProperty({
    description: 'Amount earned or spent for this time point',
    example: 1250.5,
  })
  amountEarnedOrSpent!: number;
}

export class LineChartResponseDto {
  @ApiProperty({
    description: 'Type of statistic',
    enum: StatisticType,
    example: StatisticType.TrafficSource,
  })
  type!: StatisticType;

  @ApiProperty({
    description: 'Chart data points',
    type: [ChartDataPointDto],
  })
  dataPoints!: ChartDataPointDto[];

  @ApiProperty({
    description: 'Total count across all data points',
    example: 4500,
  })
  totalActions!: number;

  @ApiProperty({
    description: 'Total amount across all data points',
    example: 37500.75,
  })
  totalAmount!: number;

  @ApiProperty({
    description: 'Chart period description',
    example: '2024-01-01 to 2024-12-31',
  })
  period!: string;

  @ApiProperty({
    description: 'Chart data interval used',
    enum: ChartInterval,
    example: ChartInterval.Hour,
  })
  interval!: ChartInterval;

  @ApiProperty({
    description: 'When the chart data was generated',
    example: '2024-01-15T10:30:00Z',
  })
  generatedAt!: Date;
}
