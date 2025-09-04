import { ApiProperty } from '@nestjs/swagger';

export class StatisticResponseDto {
  @ApiProperty({ description: 'Number of people' })
  peopleCount: number;

  @ApiProperty({ description: 'Total money amount' })
  moneyAmount: number;

  @ApiProperty({ description: 'Period of the statistic' })
  period: string;
}