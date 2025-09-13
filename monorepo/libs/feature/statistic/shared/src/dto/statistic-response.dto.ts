import { ApiProperty } from '@nestjs/swagger';
import { StatisticType } from './statistic-query.dto';

export class StatisticDataDto {
  @ApiProperty({
    description: 'Type of statistic',
    enum: StatisticType,
    example: StatisticType.TRAFFIC_SOURCE,
  })
  type!: StatisticType;

  @ApiProperty({
    description: 'Count of actions/entities',
    example: 1500,
  })
  countOfActions!: number;

  @ApiProperty({
    description: 'Amount earned (positive) or spent (negative)',
    example: 15750.5,
  })
  amountEarnedOrSpent!: number;

  @ApiProperty({
    description: 'Period of the statistics',
    example: '2024-01-01 to 2024-12-31',
  })
  period!: string;

  @ApiProperty({
    description: 'Date when statistics were generated',
    example: '2024-01-15T10:30:00Z',
  })
  generatedAt!: Date;
}

export class TrafficSourceStatisticDto extends StatisticDataDto {
  @ApiProperty({
    description: 'Number of unique traffic sources',
    example: 25,
  })
  uniqueSourcesCount!: number;

  @ApiProperty({
    description: 'Total actions performed by all sources',
    example: 1500,
  })
  totalActions!: number;

  @ApiProperty({
    description: 'Average reward per action',
    example: 10.5,
  })
  avgRewardPerAction!: number;
}

export class TrafficOrderStatisticDto extends StatisticDataDto {
  @ApiProperty({
    description: 'Number of completed orders',
    example: 123,
  })
  completedOrders!: number;

  @ApiProperty({
    description: 'Number of pending orders',
    example: 45,
  })
  pendingOrders!: number;

  @ApiProperty({
    description: 'Total budget allocated',
    example: 50000,
  })
  totalBudget!: number;

  @ApiProperty({
    description: 'Amount actually spent',
    example: 35750.5,
  })
  spentAmount!: number;
}

export class TrafficTargetStatisticDto extends StatisticDataDto {
  @ApiProperty({
    description: 'Number of active targets',
    example: 15,
  })
  activeTargetsCount!: number;

  @ApiProperty({
    description: 'Total orders targeting these entities',
    example: 234,
  })
  totalOrdersCount!: number;

  @ApiProperty({
    description: 'Average price per member',
    example: 12.5,
  })
  avgPricePerMember!: number;
}

export class UserStatisticDto extends StatisticDataDto {
  @ApiProperty({
    description: 'Number of active users',
    example: 1024,
  })
  activeUsersCount!: number;

  @ApiProperty({
    description: 'Total balance changes',
    example: 2500,
  })
  totalTransactions!: number;

  @ApiProperty({
    description: 'Net balance change',
    example: 15750.5,
  })
  netBalanceChange!: number;
}

export class StatisticResponseDto {
  @ApiProperty({
    description: 'Basic statistic data',
    type: StatisticDataDto,
  })
  data!: StatisticDataDto | TrafficSourceStatisticDto | TrafficOrderStatisticDto | TrafficTargetStatisticDto | UserStatisticDto;

  @ApiProperty({
    description: 'Shareable link for this statistic',
    example: 'https://motivbuy.com/share/stats/abc123def456',
  })
  shareLink!: string;
}
