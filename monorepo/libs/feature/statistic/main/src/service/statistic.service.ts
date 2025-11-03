import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import * as crypto from 'crypto';
import {
  TrafficOrderRepository,
  TrafficSourceRepository,
  TrafficActionsRepository,
  UserRepository,
  TrafficOrderStatus,
  UserStatus,
  TrafficActionStatus,
} from '@app/database';
import {
  StatisticQueryDto,
  TrafficSourceStatisticDto,
  TrafficOrderStatisticDto,
  TrafficTargetStatisticDto,
  UserStatisticDto,
  StatisticType,
  LineChartQueryDto,
  ChartDataPointDto,
  ChartInterval,
} from '../dto';
import { ServiceStatisticResponse, ServiceLineChartData } from '../type';
import { StatisticRepository, TimeSeriesData } from '../repository/statistic.repository';

/**
 * Statistic Service - Business relationship-based filtering with permission checks
 *
 * Business Relationships:
 * - Sources and targets have contractual relationships with pricing and terms
 * - Users can have permission-based access to manage sources, targets, and orders
 * - Traffic users can interact with multiple targets with different permission levels
 *
 * StatisticType defines the level of fetching statistics:
 * - Traffic Sources: filtered by managedBy permission (contractual management access)
 * - Traffic Targets: filtered by managedBy permission (contractual management access)
 * - Traffic Orders: filtered by creator permission (order creation rights)
 * - Users: aggregated view across all resources with user's permission levels (sources managed, targets managed, orders created)
 */
@Injectable()
export class StatisticService {
  constructor(
    private readonly em: EntityManager,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly userRepository: UserRepository,
    private readonly statisticRepository: StatisticRepository,
  ) {}

  private readonly statisticHandlers = {
    [StatisticType.TrafficSource]: (userId: string, query: StatisticQueryDto) =>
      this.getTrafficSourceStatistics(userId, query),
    [StatisticType.TrafficOrder]: (userId: string, query: StatisticQueryDto) =>
      this.getTrafficOrderStatistics(userId, query),
    [StatisticType.TrafficTarget]: (userId: string, query: StatisticQueryDto) =>
      this.getTrafficTargetStatistics(userId, query),
    [StatisticType.User]: (userId: string, query: StatisticQueryDto) => this.getUserStatistics(userId, query),
  };

  private readonly chartDataHandlers = {
    [StatisticType.TrafficSource]: (userId: string, query: LineChartQueryDto) =>
      this.getTrafficSourceChartData(userId, query),
    [StatisticType.TrafficOrder]: (userId: string, query: LineChartQueryDto) =>
      this.getTrafficOrderChartData(userId, query),
    [StatisticType.TrafficTarget]: (userId: string, query: LineChartQueryDto) =>
      this.getTrafficTargetChartData(userId, query),
    [StatisticType.User]: (userId: string, query: LineChartQueryDto) => this.getUserChartData(userId, query),
  };

  async getStatistics(userId: string, query: StatisticQueryDto): Promise<ServiceStatisticResponse> {
    if (!query.type) {
      throw new Error('Statistic type is required');
    }

    // Validate date range
    if (query.fromDate && query.endDate) {
      const fromDate = new Date(query.fromDate);
      const endDate = new Date(query.endDate);

      if (fromDate > endDate) {
        throw new Error('fromDate must be before endDate');
      }
    }

    const handler = this.statisticHandlers[query.type];
    if (!handler) {
      throw new Error(`Unsupported statistic type: ${String(query.type)}`);
    }

    const statisticData = await handler(userId, query);
    const shareToken = this.generateShareToken(userId, query);

    return {
      data: statisticData,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  async getLineChartData(userId: string, query: LineChartQueryDto): Promise<ServiceLineChartData> {
    // Validate required parameters
    if (!query.fromDate || !query.endDate) {
      throw new Error('Both fromDate and endDate are required for chart data');
    }

    // Validate date range
    const fromDate = new Date(query.fromDate);
    const endDate = new Date(query.endDate);

    if (isNaN(fromDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD or ISO 8601');
    }

    if (fromDate > endDate) {
      throw new Error('fromDate must be before endDate');
    }

    // Validate date range is not too large (max 1 year)
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - fromDate.getTime() > oneYearInMs) {
      throw new Error('Date range cannot exceed 1 year');
    }

    const handler = this.chartDataHandlers[query.type];
    if (!handler) {
      throw new Error(`Unsupported chart type: ${String(query.type)}`);
    }

    const dataPoints = await handler(userId, query);
    const totalActions = dataPoints.reduce((sum, point) => sum + point.countOfActions, 0);
    const totalAmount = dataPoints.reduce((sum, point) => sum + point.amountEarnedOrSpent, 0);

    return {
      type: query.type,
      dataPoints,
      totalActions,
      totalAmount,
      period: this.formatPeriod(query.fromDate, query.endDate),
      interval: query.interval ?? ChartInterval.Hour,
    };
  }

  async getSharedStatistic(shareToken: string): Promise<ServiceStatisticResponse> {
    const { userId, statisticType } = this.validateAndParseShareToken(shareToken);
    const query: StatisticQueryDto = { type: statisticType };

    const handler = this.statisticHandlers[statisticType];
    const statisticData = await handler(userId, query);

    return {
      data: statisticData,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  async getSharedLineChartData(shareToken: string, query: LineChartQueryDto): Promise<ServiceLineChartData> {
    const { userId, statisticType } = this.validateAndParseShareToken(shareToken);

    // Validate required parameters
    if (!query.fromDate || !query.endDate) {
      throw new Error('Both fromDate and endDate are required for chart data');
    }

    // Validate date range
    const fromDate = new Date(query.fromDate);
    const endDate = new Date(query.endDate);

    if (isNaN(fromDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD or ISO 8601');
    }

    if (fromDate > endDate) {
      throw new Error('fromDate must be before endDate');
    }

    // Validate date range is not too large (max 1 year)
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - fromDate.getTime() > oneYearInMs) {
      throw new Error('Date range cannot exceed 1 year');
    }

    const handler = this.chartDataHandlers[statisticType];
    const dataPoints = await handler(userId, query);

    const totalActions = dataPoints.reduce((sum, point) => sum + point.countOfActions, 0);
    const totalAmount = dataPoints.reduce((sum, point) => sum + point.amountEarnedOrSpent, 0);

    return {
      type: statisticType,
      dataPoints,
      totalActions,
      totalAmount,
      period: this.formatPeriod(query.fromDate, query.endDate),
      interval: query.interval ?? ChartInterval.Hour,
    };
  }

  /**
   * Traffic Source Statistics - Permission-based access to managed sources
   * Business Rule: Users can only see sources where they have management permissions
   * Schema: TrafficSourceEntity.managedBy = userId (contractual management relationship)
   */
  private async getTrafficSourceStatistics(
    userId: string,
    query: StatisticQueryDto,
  ): Promise<TrafficSourceStatisticDto> {
    // Build base filter for sources managed by user
    const baseFilter = {
      managedBy: userId,
      isActive: true,
      ...(query.sourceId && { id: query.sourceId }),
      ...(query.fromDate || query.endDate
        ? {
            createdAt: {
              ...(query.fromDate && { $gte: new Date(query.fromDate) }),
              ...(query.endDate && { $lte: new Date(query.endDate) }),
            },
          }
        : {}),
    };

    // Get user's sources first
    const sources = await this.trafficSourceRepository.find(baseFilter);
    const sourceIds = sources.map((s) => s.id);

    if (sourceIds.length === 0) {
      return {
        type: StatisticType.TrafficSource,
        countOfActions: 0,
        amountEarnedOrSpent: 0,
        period: this.formatPeriod(query.fromDate, query.endDate),
        generatedAt: new Date(),
        uniqueSourcesCount: 0,
        totalActions: 0,
        avgRewardPerAction: 0,
      };
    }

    // Build actions filter for aggregation
    const actionsFilter = {
      trafficSource: { $in: sourceIds },
      status: TrafficActionStatus.Completed,
      ...(query.fromDate || query.endDate
        ? {
            completedAt: {
              ...(query.fromDate && { $gte: new Date(query.fromDate) }),
              ...(query.endDate && { $lte: new Date(query.endDate) }),
            },
          }
        : {}),
    };

    // Database-level aggregation without fetching records
    const totalActions = await this.trafficActionsRepository.count(actionsFilter);

    // Database SUM aggregation for rewards using native SQL
    const whereConditions: string[] = [];
    const parameters: unknown[] = [];
    let paramIndex = 1;

    if (actionsFilter.trafficSource) {
      whereConditions.push(`ta.traffic_source_id = ANY($${paramIndex})`);
      parameters.push(actionsFilter.trafficSource.$in);
      paramIndex++;
    }

    if (actionsFilter.status) {
      whereConditions.push(`ta.status = $${paramIndex}`);
      parameters.push(actionsFilter.status);
      paramIndex++;
    }

    if (actionsFilter.completedAt?.$gte) {
      whereConditions.push(`ta.completed_at >= $${paramIndex}`);
      parameters.push(actionsFilter.completedAt.$gte);
      paramIndex++;
    }

    if (actionsFilter.completedAt?.$lte) {
      whereConditions.push(`ta.completed_at <= $${paramIndex}`);
      parameters.push(actionsFilter.completedAt.$lte);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const rewardSumResult = await this.em
      .getConnection()
      .execute(
        `SELECT COALESCE(SUM(CAST(reward AS DECIMAL)), 0) as "totalReward" FROM traffic_actions ta ${whereClause}`,
        parameters,
      );

    const firstResult = Array.isArray(rewardSumResult) && rewardSumResult.length > 0 ? rewardSumResult[0] : null;
    const totalReward = parseFloat(
      (firstResult && typeof firstResult === 'object' && 'totalReward' in firstResult
        ? String(firstResult.totalReward)
        : '0') || '0',
    );

    return {
      type: StatisticType.TrafficSource,
      countOfActions: totalActions,
      amountEarnedOrSpent: totalReward, // Positive - user earns rewards from their sources
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      uniqueSourcesCount: sources.length,
      totalActions,
      avgRewardPerAction: totalActions > 0 ? totalReward / totalActions : 0,
    };
  }

  /**
   * Traffic Order Statistics - Permission-based access to created orders
   * Business Rule: Users can only see orders where they have creation rights
   * Schema: TrafficOrderEntity.creator = userId (order creation permission)
   */
  private async getTrafficOrderStatistics(userId: string, query: StatisticQueryDto): Promise<TrafficOrderStatisticDto> {
    // Build base filter for orders created by user
    const baseFilter = {
      creator: userId,
      ...(query.orderId && { orderId: query.orderId }),
      ...(query.fromDate || query.endDate
        ? {
            createdAt: {
              ...(query.fromDate && { $gte: new Date(query.fromDate) }),
              ...(query.endDate && { $lte: new Date(query.endDate) }),
            },
          }
        : {}),
    };

    // Database-level aggregation for order statistics
    const totalOrders = await this.trafficOrderRepository.count(baseFilter);

    // Get budget sum and spent sum with database aggregation using native SQL
    const orderWhereConditions: string[] = [];
    const orderParameters: unknown[] = [];
    let orderParamIndex = 1;

    if (baseFilter.creator) {
      orderWhereConditions.push(`tor.creator = $${orderParamIndex}`);
      orderParameters.push(baseFilter.creator);
      orderParamIndex++;
    }

    if (baseFilter.orderId) {
      orderWhereConditions.push(`tor.order_id = $${orderParamIndex}`);
      orderParameters.push(baseFilter.orderId);
      orderParamIndex++;
    }

    if (baseFilter.createdAt?.$gte) {
      orderWhereConditions.push(`tor.created_at >= $${orderParamIndex}`);
      orderParameters.push(baseFilter.createdAt.$gte);
      orderParamIndex++;
    }

    if (baseFilter.createdAt?.$lte) {
      orderWhereConditions.push(`tor.created_at <= $${orderParamIndex}`);
      orderParameters.push(baseFilter.createdAt.$lte);
      orderParamIndex++;
    }

    const orderWhereClause = orderWhereConditions.length > 0 ? `WHERE ${orderWhereConditions.join(' AND ')}` : '';
    const budgetSumResult = await this.em
      .getConnection()
      .execute(
        `SELECT COALESCE(SUM(CAST(budget AS DECIMAL)), 0) as "totalBudget", COALESCE(SUM(CAST(spent AS DECIMAL)), 0) as "totalSpent" FROM traffic_orders tor ${orderWhereClause}`,
        orderParameters,
      );

    const firstBudgetResult = Array.isArray(budgetSumResult) && budgetSumResult.length > 0 ? budgetSumResult[0] : null;

    const totalBudget = parseFloat(
      (firstBudgetResult && typeof firstBudgetResult === 'object' && 'totalBudget' in firstBudgetResult
        ? String(firstBudgetResult.totalBudget)
        : '0') || '0',
    );

    const totalSpent = parseFloat(
      (firstBudgetResult && typeof firstBudgetResult === 'object' && 'totalSpent' in firstBudgetResult
        ? String(firstBudgetResult.totalSpent)
        : '0') || '0',
    );

    // Database-level conditional counting for order statuses
    const statusCountsResult = await this.em.getConnection().execute(
      `SELECT
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Completed}' THEN 1 END) as "completedOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Pending}' THEN 1 END) as "pendingOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.InProgress}' THEN 1 END) as "inProgressOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Active}' THEN 1 END) as "activeOrders"
       FROM traffic_orders tor ${orderWhereClause}`,
      orderParameters,
    );

    const statusCounts =
      Array.isArray(statusCountsResult) && statusCountsResult.length > 0 ? statusCountsResult[0] : null;

    const completedOrders = parseInt(
      (statusCounts && typeof statusCounts === 'object' && 'completedOrders' in statusCounts
        ? String(statusCounts.completedOrders)
        : '0') || '0',
      10,
    );

    const pendingOrders = parseInt(
      (statusCounts && typeof statusCounts === 'object' && 'pendingOrders' in statusCounts
        ? String(statusCounts.pendingOrders)
        : '0') || '0',
      10,
    );

    const inProgressOrders = parseInt(
      (statusCounts && typeof statusCounts === 'object' && 'inProgressOrders' in statusCounts
        ? String(statusCounts.inProgressOrders)
        : '0') || '0',
      10,
    );

    const activeOrders = parseInt(
      (statusCounts && typeof statusCounts === 'object' && 'activeOrders' in statusCounts
        ? String(statusCounts.activeOrders)
        : '0') || '0',
      10,
    );

    const pendingOrdersCount = pendingOrders + inProgressOrders + activeOrders;

    return {
      type: StatisticType.TrafficOrder,
      countOfActions: totalOrders,
      amountEarnedOrSpent: -totalSpent, // Negative because user is spending money
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      completedOrders,
      pendingOrders: pendingOrdersCount,
      totalBudget,
      spentAmount: totalSpent,
    };
  }

  /**
   * Traffic Target Statistics - Permission-based access to managed targets
   * Business Rule: Users can interact with multiple targets with different permission levels
   * Schema: TrafficTargetEntity.managedBy = userId (contractual management relationship)
   */
  private async getTrafficTargetStatistics(
    userId: string,
    query: StatisticQueryDto,
  ): Promise<TrafficTargetStatisticDto> {
    // Use parallel database aggregations for efficient calculation with native SQL
    const targetWhereConditions: string[] = [`tt.managed_by = $1`];
    const targetParameters: unknown[] = [userId];
    let targetParamIndex = 2;

    if (query.targetId) {
      targetWhereConditions.push(`tt.id = $${targetParamIndex}`);
      targetParameters.push(query.targetId);
      targetParamIndex++;
    }

    if (query.fromDate) {
      targetWhereConditions.push(`tt.created_at >= $${targetParamIndex}`);
      targetParameters.push(new Date(query.fromDate));
      targetParamIndex++;
    }

    if (query.endDate) {
      targetWhereConditions.push(`tt.created_at <= $${targetParamIndex}`);
      targetParameters.push(new Date(query.endDate));
      targetParamIndex++;
    }

    const orderTargetWhereConditions: string[] = [`tt.managed_by = $1`, `tor.status = $2`];
    const orderTargetParameters: unknown[] = [userId, TrafficOrderStatus.Completed];
    let orderTargetParamIndex = 3;

    if (query.targetId) {
      orderTargetWhereConditions.push(`tt.id = $${orderTargetParamIndex}`);
      orderTargetParameters.push(query.targetId);
      orderTargetParamIndex++;
    }

    if (query.fromDate) {
      orderTargetWhereConditions.push(`tor.completed_at >= $${orderTargetParamIndex}`);
      orderTargetParameters.push(new Date(query.fromDate));
      orderTargetParamIndex++;
    }

    if (query.endDate) {
      orderTargetWhereConditions.push(`tor.completed_at <= $${orderTargetParamIndex}`);
      orderTargetParameters.push(new Date(query.endDate));
    }

    const [targetStatsResults, orderStatsResults] = await Promise.all([
      // Get target count and average price per member with native SQL
      this.em.getConnection().execute(
        `SELECT COUNT(tt.id) as "totalTargets",
                SUM(CASE WHEN tt.is_active = true THEN 1 ELSE 0 END) as "activeTargets",
                AVG(CAST(tt.price_per_member as DECIMAL)) as "avgPricePerMember"
         FROM traffic_targets tt
         WHERE ${targetWhereConditions.join(' AND ')}`,
        targetParameters,
      ),

      // Get orders for user's targets with aggregated earnings
      this.em.getConnection().execute(
        `SELECT COUNT(tor.id) as "totalOrders",
                COALESCE(SUM(CAST(tor.spent_amount as DECIMAL)), 0) as "totalEarned"
         FROM traffic_orders tor
         LEFT JOIN traffic_targets tt ON tor.traffic_target_id = tt.id
         WHERE ${orderTargetWhereConditions.join(' AND ')}`,
        orderTargetParameters,
      ),
    ]);

    const targetStats =
      Array.isArray(targetStatsResults) && targetStatsResults.length > 0 ? targetStatsResults[0] : null;

    const orderStats = Array.isArray(orderStatsResults) && orderStatsResults.length > 0 ? orderStatsResults[0] : null;

    const activeTargetsCount = parseInt(
      (targetStats && typeof targetStats === 'object' && 'activeTargets' in targetStats
        ? String(targetStats.activeTargets)
        : '0') || '0',
      10,
    );

    const totalOrdersCount = parseInt(
      (orderStats && typeof orderStats === 'object' && 'totalOrders' in orderStats
        ? String(orderStats.totalOrders)
        : '0') || '0',
      10,
    );

    const totalEarned = parseFloat(
      (orderStats && typeof orderStats === 'object' && 'totalEarned' in orderStats
        ? String(orderStats.totalEarned)
        : '0') || '0',
    );

    const avgPricePerMember = parseFloat(
      (targetStats && typeof targetStats === 'object' && 'avgPricePerMember' in targetStats
        ? String(targetStats.avgPricePerMember)
        : '0') || '0',
    );

    return {
      type: StatisticType.TrafficTarget,
      countOfActions: totalOrdersCount,
      amountEarnedOrSpent: totalEarned, // Positive because user earns from their targets
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeTargetsCount,
      totalOrdersCount,
      avgPricePerMember,
    };
  }

  /**
   * User Statistics - Aggregated view across all permission levels
   * Business Rule: StatisticType.User provides comprehensive view of user's activity across all resources
   * Schema: Aggregates from all TrafficTargets (managedBy), TrafficOrders (creator), and TrafficSources (managedBy)
   * Permission Model: Shows combined metrics based on user's contractual relationships and creation rights
   */
  private async getUserStatistics(userId: string, query: StatisticQueryDto): Promise<UserStatisticDto> {
    // Use the specific userId parameter for user-specific stats
    const targetUserId = query.userId || userId;

    // Use parallel database aggregations for efficient calculation with native SQL
    const userWhereConditions: string[] = [`ubh.user_id = $1`];
    const userParameters: unknown[] = [targetUserId];
    let userParamIndex = 2;

    userWhereConditions.push(`ubh.status = $${userParamIndex}`);
    userParameters.push('completed');
    userParamIndex++;

    if (query.fromDate) {
      userWhereConditions.push(`ubh.created_at >= $${userParamIndex}`);
      userParameters.push(new Date(query.fromDate));
      userParamIndex++;
    }

    if (query.endDate) {
      userWhereConditions.push(`ubh.created_at <= $${userParamIndex}`);
      userParameters.push(new Date(query.endDate));
    }

    const [userTransactionStatsResults, activeUsersCount] = await Promise.all([
      // Aggregate user balance transactions with native SQL
      this.em.getConnection().execute(
        `SELECT COUNT(ubh.id) as "totalTransactions", COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as "netBalanceChange"
         FROM user_balance_history ubh
         WHERE ${userWhereConditions.join(' AND ')}`,
        userParameters,
      ),

      // Count active users efficiently
      this.userRepository.count({ status: UserStatus.Active }),
    ]);

    const userTransactionStats =
      Array.isArray(userTransactionStatsResults) && userTransactionStatsResults.length > 0
        ? userTransactionStatsResults[0]
        : null;

    const totalTransactions = parseInt(
      (userTransactionStats && typeof userTransactionStats === 'object' && 'totalTransactions' in userTransactionStats
        ? String(userTransactionStats.totalTransactions)
        : '0') || '0',
      10,
    );

    const netBalanceChange = parseFloat(
      (userTransactionStats && typeof userTransactionStats === 'object' && 'netBalanceChange' in userTransactionStats
        ? String(userTransactionStats.netBalanceChange)
        : '0') || '0',
    );

    return {
      type: StatisticType.User,
      countOfActions: totalTransactions,
      amountEarnedOrSpent: netBalanceChange,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeUsersCount,
      totalTransactions,
      netBalanceChange,
    };
  }

  /**
   * Chart Data Methods - All with proper resource filtering
   * Implemented using repository time-series aggregation methods
   */

  private async getTrafficSourceChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const dateFilter = {
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const interval = query.interval ?? ChartInterval.Hour;
    const timeSeriesData = await this.statisticRepository.getTimeSeriesData(
      userId,
      'source',
      undefined,
      dateFilter,
      interval,
    );

    return timeSeriesData.map((point: TimeSeriesData) => ({
      date: point.date,
      countOfActions: point.count,
      amountEarnedOrSpent: point.amount,
    }));
  }

  private async getTrafficOrderChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const dateFilter = {
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const interval = query.interval ?? ChartInterval.Hour;
    const timeSeriesData = await this.statisticRepository.getTimeSeriesData(
      userId,
      'order',
      undefined,
      dateFilter,
      interval,
    );

    return timeSeriesData.map((point: TimeSeriesData) => ({
      date: point.date,
      countOfActions: point.count,
      amountEarnedOrSpent: -point.amount, // Negative because user is spending
    }));
  }

  private async getTrafficTargetChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const dateFilter = {
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const interval = query.interval ?? ChartInterval.Hour;
    const timeSeriesData = await this.statisticRepository.getTimeSeriesData(
      userId,
      'target',
      undefined,
      dateFilter,
      interval,
    );

    return timeSeriesData.map((point: TimeSeriesData) => ({
      date: point.date,
      countOfActions: point.count,
      amountEarnedOrSpent: point.amount, // Positive because user earns from targets
    }));
  }

  private async getUserChartData(userId: string, query: LineChartQueryDto): Promise<ChartDataPointDto[]> {
    const dateFilter = {
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const targetUserId = query.userId || userId;
    const interval = query.interval ?? ChartInterval.Hour;
    const timeSeriesData = await this.statisticRepository.getTimeSeriesData(
      userId,
      'user',
      targetUserId,
      dateFilter,
      interval,
    );

    return timeSeriesData.map((point: TimeSeriesData) => ({
      date: point.date,
      countOfActions: point.count,
      amountEarnedOrSpent: point.amount,
    }));
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

  private validateAndParseShareToken(shareToken: string): { userId: string; statisticType: StatisticType } {
    const tokenParts = shareToken.split('-');
    if (tokenParts.length !== 4) {
      throw new Error('Invalid share token format');
    }

    const [typeHash, userId, timestampStr] = tokenParts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      throw new Error('Invalid share token timestamp');
    }

    const tokenAge = Date.now() - timestamp;
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    if (tokenAge > sevenDaysInMs) {
      throw new Error('Share token has expired');
    }

    const typeMapping: Record<string, StatisticType> = {
      tra: StatisticType.TrafficSource,
      ord: StatisticType.TrafficOrder,
      tar: StatisticType.TrafficTarget,
      use: StatisticType.User,
      all: StatisticType.User,
    };

    const statisticType = typeMapping[typeHash];
    if (!statisticType) {
      throw new Error('Invalid share token type');
    }

    return { userId, statisticType };
  }

  generateShareToken(userId: string, query?: StatisticQueryDto): string {
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID();
    const typeHash = query?.type ? String(query.type).substring(0, 3) : 'all';

    return `${typeHash}-${userId}-${timestamp}-${randomStr}`;
  }
}
