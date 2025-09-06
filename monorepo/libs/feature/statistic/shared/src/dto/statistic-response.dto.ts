import { ApiProperty } from '@nestjs/swagger';

export class StatisticDataDto {
  @ApiProperty({
    description: 'Number of people (visitors for sales, sources for purchases)',
    example: 1500,
  })
  peopleCount!: number;

  @ApiProperty({
    description: 'Amount of money (earned for sales, spent for purchases)',
    example: 15750.5,
  })
  amount!: number;
}

export class StatisticResponseDto extends StatisticDataDto {
  @ApiProperty({
    description: 'Shareable link for this statistic',
    example: 'https://motivbuy.com/share/stats/abc123def456',
  })
  shareLink!: string;
}
