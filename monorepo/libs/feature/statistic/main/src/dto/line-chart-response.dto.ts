import { ApiProperty } from '@nestjs/swagger';

/**
 * Single data point in the chart
 */
export class ChartDataPoint {
  @ApiProperty({
    description: 'Data point date/time',
    example: '2024-01-01T00:00:00Z',
  })
  date!: Date;

  @ApiProperty({
    description: 'Count value for this data point',
    example: 150,
  })
  count!: number;

  @ApiProperty({
    description: 'Amount value for this data point',
    example: 1250.5,
  })
  amount!: number;
}

/**
 * Line chart response DTO containing time-series data
 */
export class LineChartResponseDto {
  @ApiProperty({
    description: 'Array of chart data points',
    type: [ChartDataPoint],
  })
  dataPoints!: ChartDataPoint[];

  @ApiProperty({
    description: 'Total count across all data points',
    example: 5000,
  })
  totalCount!: number;

  @ApiProperty({
    description: 'Total amount across all data points',
    example: 42500.75,
  })
  totalAmount!: number;

  @ApiProperty({
    description: 'Chart period start date',
    example: '2024-01-01T00:00:00Z',
  })
  periodStart!: Date;

  @ApiProperty({
    description: 'Chart period end date',
    example: '2024-01-31T23:59:59Z',
  })
  periodEnd!: Date;
}
