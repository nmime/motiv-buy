import { ChartInterval, StatisticType } from '../dto';

export interface ServiceStatisticData {
  type: StatisticType;
  countOfActions: number;
  amountEarnedOrSpent: number;
  period: string;
  generatedAt: Date;
  // Traffic Source specific
  totalReward?: number;
  activeSourcesCount?: number;
  avgRewardPerAction?: number;
  // Traffic Order specific
  completedOrders?: number;
  pendingOrders?: number;
  totalBudget?: number;
  spentAmount?: number;
  // Traffic Target specific
  activeTargetsCount?: number;
  totalOrdersCount?: number;
  avgPricePerMember?: number;
  // User specific
  activeUsersCount?: number;
  totalTransactions?: number;
  netBalanceChange?: number;
}

export interface ServiceStatisticResponse {
  data: ServiceStatisticData;
  shareLink: string;
}

export interface ServiceLineChartData {
  type: StatisticType;
  dataPoints: Array<{
    date: string;
    countOfActions: number;
    amountEarnedOrSpent: number;
  }>;
  totalActions: number;
  totalAmount: number;
  period: string;
  interval: ChartInterval;
}
