import { Injectable } from '@nestjs/common';
import { 
  TrafficOrderRepository, 
  TrafficTargetRepository, 
  TrafficSourceRepository,
  TrafficActionsRepository,
  UserRepository,
  UserBalanceHistoryRepository 
} from '@app/database';
import { 
  StatisticQueryDto, 
  StatisticResponseDto,
  StatisticDataDto,
  TrafficSourceStatisticDto,
  TrafficOrderStatisticDto,
  TrafficTargetStatisticDto,
  UserStatisticDto,
  StatisticType,
  LineChartQueryDto,
  LineChartResponseDto,
  ChartDataPointDto,
  ChartInterval
} from '@app/feature-statistic-shared';

interface IStatisticService {
  getStatistics(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto>;
  getLineChartData(userId: string, query: LineChartQueryDto): Promise<LineChartResponseDto>;
  getSharedStatistic(shareToken: string): Promise<StatisticResponseDto>;
}

@Injectable()
export class StatisticService implements IStatisticService {
  constructor(
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficTargetRepository: TrafficTargetRepository,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly userRepository: UserRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
  ) {}

  async getStatistics(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto> {
    let statisticData: StatisticDataDto;

    switch (query.type) {
      case StatisticType.TRAFFIC_SOURCE:
        statisticData = await this.getTrafficSourceStatistics(userId, query);
        break;
      case StatisticType.TRAFFIC_ORDER:
        statisticData = await this.getTrafficOrderStatistics(userId, query);
        break;
      case StatisticType.TRAFFIC_TARGET:
        statisticData = await this.getTrafficTargetStatistics(userId, query);
        break;
      case StatisticType.USER:
        statisticData = await this.getUserStatistics(userId, query);
        break;
      default:
        throw new Error(`Unsupported statistic type: ${query.type}`);
    }

    const shareToken = await this.generateShareToken(userId, query);

    return {
      data: statisticData,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  async getLineChartData(userId: string, query: LineChartQueryDto): Promise<LineChartResponseDto> {
    let dataPoints: ChartDataPointDto[];

    switch (query.type) {
      case StatisticType.TRAFFIC_SOURCE:
        dataPoints = await this.getTrafficSourceChartData(userId, query);
        break;
      case StatisticType.TRAFFIC_ORDER:
        dataPoints = await this.getTrafficOrderChartData(userId, query);
        break;
      case StatisticType.TRAFFIC_TARGET:
        dataPoints = await this.getTrafficTargetChartData(userId, query);
        break;
      case StatisticType.USER:
        dataPoints = await this.getUserChartData(userId, query);
        break;
      default:
        throw new Error(`Unsupported chart type: ${query.type}`);
    }

    const totalActions = dataPoints.reduce((sum, point) => sum + point.countOfActions, 0);
    const totalAmount = dataPoints.reduce((sum, point) => sum + point.amountEarnedOrSpent, 0);

    return {
      type: query.type,
      dataPoints,
      totalActions,
      totalAmount,
      period: this.formatPeriod(query.fromDate, query.endDate),
      interval: query.interval || ChartInterval.Hour,
      generatedAt: new Date(),
    };
  }

  async getSharedStatistic(shareToken: string): Promise<StatisticResponseDto> {
    // TODO: Implement share token validation and lookup from database
    // For now return mock data
    const mockData: StatisticDataDto = {
      type: StatisticType.TRAFFIC_SOURCE,
      countOfActions: 1200,
      amountEarnedOrSpent: 12500.75,
      period: 'shared',
      generatedAt: new Date(),
    };

    return {
      data: mockData,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  private async getTrafficSourceStatistics(userId: string, query: StatisticQueryDto): Promise<TrafficSourceStatisticDto> {
    const qb = this.trafficSourceRepository.createQueryBuilder('source');
    
    if (query.sourceId) {
      qb.andWhere('source.id = :sourceId', { sourceId: query.sourceId });
    }
    
    qb.leftJoinAndSelect('source.actions', 'actions');
    qb.leftJoinAndSelect('source.managedBy', 'manager', 'manager.id = :userId', { userId });

    if (query.fromDate) {
      qb.andWhere('actions.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.endDate) {
      qb.andWhere('actions.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    const sources = await qb.getMany();
    
    const totalActions = sources.reduce((sum, source) => sum + (source.actions?.length || 0), 0);
    const totalReward = sources.reduce((sum, source) => 
      sum + (source.actions?.reduce((actionSum, action) => actionSum + parseFloat(action.reward || '0'), 0) || 0), 0
    );

    return {
      type: StatisticType.TRAFFIC_SOURCE,
      countOfActions: totalActions,
      amountEarnedOrSpent: totalReward,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      uniqueSourcesCount: sources.length,
      totalActions,
      avgRewardPerAction: totalActions > 0 ? totalReward / totalActions : 0,
    };
  }

  private async getTrafficOrderStatistics(userId: string, query: StatisticQueryDto): Promise<TrafficOrderStatisticDto> {
    const qb = this.trafficOrderRepository.createQueryBuilder('order');
    
    qb.leftJoin('order.creator', 'creator');
    qb.andWhere('creator.id = :userId', { userId });

    if (query.orderId) {
      qb.andWhere('order.id = :orderId', { orderId: query.orderId });
    }
    if (query.fromDate) {
      qb.andWhere('order.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.endDate) {
      qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    const orders = await qb.getMany();
    
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;
    const totalBudget = orders.reduce((sum, order) => sum + parseFloat(order.totalBudget), 0);
    const spentAmount = orders.reduce((sum, order) => sum + parseFloat(order.spentAmount), 0);

    return {
      type: StatisticType.TRAFFIC_ORDER,
      countOfActions: orders.length,
      amountEarnedOrSpent: -spentAmount, // negative because it's spending
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      completedOrders,
      pendingOrders,
      totalBudget,
      spentAmount,
    };
  }

  private async getTrafficTargetStatistics(userId: string, query: StatisticQueryDto): Promise<TrafficTargetStatisticDto> {
    const qb = this.trafficTargetRepository.createQueryBuilder('target');
    
    qb.leftJoinAndSelect('target.orders', 'orders');
    qb.leftJoin('target.managedBy', 'manager');
    qb.andWhere('manager.id = :userId', { userId });

    if (query.targetId) {
      qb.andWhere('target.id = :targetId', { targetId: query.targetId });
    }
    if (query.fromDate) {
      qb.andWhere('orders.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.endDate) {
      qb.andWhere('orders.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    const targets = await qb.getMany();
    
    const activeTargets = targets.filter(target => target.isActive).length;
    const totalOrders = targets.reduce((sum, target) => sum + (target.orders?.length || 0), 0);
    const avgPrice = targets.length > 0 ? 
      targets.reduce((sum, target) => sum + parseFloat(target.pricePerMember || '0'), 0) / targets.length : 0;

    const totalEarned = targets.reduce((sum, target) => 
      sum + (target.orders?.reduce((orderSum, order) => orderSum + parseFloat(order.spentAmount), 0) || 0), 0
    );

    return {
      type: StatisticType.TRAFFIC_TARGET,
      countOfActions: totalOrders,
      amountEarnedOrSpent: totalEarned,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeTargetsCount: activeTargets,
      totalOrdersCount: totalOrders,
      avgPricePerMember: avgPrice,
    };
  }

  private async getUserStatistics(userId: string, query: StatisticQueryDto): Promise<UserStatisticDto> {
    const userQb = this.userRepository.createQueryBuilder('user');
    
    if (query.fromDate) {
      userQb.andWhere('user.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.endDate) {
      userQb.andWhere('user.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    const users = await userQb.getMany();
    const activeUsers = users.filter(user => user.isActive).length;

    // Get balance history for the specified user or all users
    const balanceQb = this.userBalanceHistoryRepository.createQueryBuilder('balance');
    
    if (query.userId) {
      balanceQb.leftJoin('balance.user', 'user');
      balanceQb.andWhere('user.id = :userId', { userId: query.userId });
    }
    if (query.fromDate) {
      balanceQb.andWhere('balance.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.endDate) {
      balanceQb.andWhere('balance.createdAt <= :endDate', { endDate: new Date(query.endDate) });
    }

    const transactions = await balanceQb.getMany();
    const netBalanceChange = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    return {
      type: StatisticType.USER,
      countOfActions: transactions.length,
      amountEarnedOrSpent: netBalanceChange,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeUsersCount: activeUsers,
      totalTransactions: transactions.length,
      netBalanceChange,
    };
  }

  private async getTrafficSourceChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const qb = this.trafficActionsRepository.createQueryBuilder('action');
    qb.leftJoin('action.trafficSource', 'source');
    qb.leftJoin('source.managedBy', 'manager');
    qb.andWhere('manager.id = :userId', { userId });
    qb.andWhere('action.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    qb.andWhere('action.createdAt <= :endDate', { endDate: new Date(query.endDate) });

    const actions = await qb.getMany();
    return this.groupDataByInterval(actions, query.interval || ChartInterval.Hour, 'createdAt');
  }

  private async getTrafficOrderChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const qb = this.trafficOrderRepository.createQueryBuilder('order');
    qb.leftJoin('order.creator', 'creator');
    qb.andWhere('creator.id = :userId', { userId });
    qb.andWhere('order.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(query.endDate) });

    const orders = await qb.getMany();
    return this.groupDataByInterval(orders, query.interval || ChartInterval.Hour, 'createdAt');
  }

  private async getTrafficTargetChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const qb = this.trafficOrderRepository.createQueryBuilder('order');
    qb.leftJoin('order.trafficTarget', 'target');
    qb.leftJoin('target.managedBy', 'manager');
    qb.andWhere('manager.id = :userId', { userId });
    qb.andWhere('order.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    qb.andWhere('order.createdAt <= :endDate', { endDate: new Date(query.endDate) });

    const orders = await qb.getMany();
    return this.groupDataByInterval(orders, query.interval || ChartInterval.Hour, 'createdAt');
  }

  private async getUserChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const qb = this.userBalanceHistoryRepository.createQueryBuilder('balance');
    qb.leftJoin('balance.user', 'user');
    qb.andWhere('user.id = :userId', { userId });
    qb.andWhere('balance.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    qb.andWhere('balance.createdAt <= :endDate', { endDate: new Date(query.endDate) });

    const transactions = await qb.getMany();
    return this.groupDataByInterval(transactions, query.interval || ChartInterval.Hour, 'createdAt');
  }

  private groupDataByInterval(
    data: any[], 
    interval: ChartInterval, 
    dateField: string
  ): ChartDataPointDto[] {
    const groups = new Map<string, { count: number; amount: number }>();

    data.forEach(item => {
      const date = new Date(item[dateField]);
      let groupKey: string;

      switch (interval) {
        case ChartInterval.Hour:
          groupKey = date.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00
          break;
        case ChartInterval.Day:
          groupKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case ChartInterval.Week:
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = weekStart.toISOString().split('T')[0];
          break;
        case ChartInterval.Month:
          groupKey = date.toISOString().slice(0, 7); // YYYY-MM
          break;
        default:
          groupKey = date.toISOString().slice(0, 13) + ':00'; // Default to hour
      }

      const existing = groups.get(groupKey) || { count: 0, amount: 0 };
      existing.count += 1;
      
      // Handle different amount fields based on data type
      if (item.reward) {
        existing.amount += parseFloat(item.reward || '0');
      } else if (item.spentAmount) {
        existing.amount += parseFloat(item.spentAmount || '0');
      } else if (item.amount) {
        existing.amount += parseFloat(item.amount || '0');
      }
      
      groups.set(groupKey, existing);
    });

    return Array.from(groups.entries())
      .map(([date, { count, amount }]) => ({
        date,
        countOfActions: count,
        amountEarnedOrSpent: amount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private formatPeriod(fromDate?: string, endDate?: string): string {
    if (fromDate && endDate) {
      return `${fromDate} to ${endDate}`;
    }
    if (fromDate) {
      return `From ${fromDate}`;
    }
    if (endDate) {
      return `Until ${endDate}`;
    }
    return 'All time';
  }

  async generateShareToken(userId: string, query?: StatisticQueryDto): Promise<string> {
    // Generate a secure token (in a real app, store this in database with expiration)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const typeHash = query?.type ? query.type.substring(0, 3) : 'all';
    return `${typeHash}-${userId.substring(0, 8)}-${timestamp}-${randomStr}`;
  }
}
