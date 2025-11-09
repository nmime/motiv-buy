import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import { decimal, toNumber } from '@app/common-shared';
import {
  TrafficActionsRepository,
  TrafficActionStatus,
  TrafficOrderRepository,
  TrafficOrderStatus,
  TrafficSourceRepository,
  UserRepository,
  UserStatus,
} from '@app/database';
import {
  ChartDataPointDto,
  ChartInterval,
  LineChartQueryDto,
  StatisticQueryDto,
  StatisticType,
  TrafficOrderStatisticDto,
  TrafficSourceStatisticDto,
  TrafficTargetStatisticDto,
  UserStatisticDto,
} from '../dto';
import { ServiceLineChartData, ServiceStatisticResponse } from '../type';
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

  constructor(
    private readonly em: EntityManager,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly userRepository: UserRepository,
    private readonly statisticRepository: StatisticRepository,
  ) {}

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

  generateShareToken(userId: string, query?: StatisticQueryDto): string {
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID();
    const typeHash = query?.type ? String(query.type).substring(0, 3) : 'all';

    return `${typeHash}-${userId}-${timestamp}-${randomStr}`;
  }

  /**
   * Traffic Source Statistics - Permission-based access to managed sources
   * Business Rule: Users can only see sources where they have management permissions
   * Schema: TrafficSourceEntity.managedBy = userId (contractual management relationship)
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
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
    const totalRewardDecimal = decimal(
      (firstResult && typeof firstResult === 'object' && 'totalReward' in firstResult
        ? String(firstResult.totalReward)
        : '0') || '0',
    );

    return {
      type: StatisticType.TrafficSource,
      countOfActions: totalActions,
      amountEarnedOrSpent: toNumber(totalRewardDecimal), // Positive - user earns rewards from their sources
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      uniqueSourcesCount: sources.length,
      totalActions,
      avgRewardPerAction: totalActions > 0 ? toNumber(totalRewardDecimal.dividedBy(totalActions)) : 0,
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

    const totalOrders = await this.trafficOrderRepository.count(baseFilter);
    const { whereClause, parameters } = this.buildOrderWhereConditions(baseFilter);

    const [budgetResult, statusResult] = await Promise.all([
      this.getOrderBudgetStats(whereClause, parameters),
      this.getOrderStatusCounts(whereClause, parameters),
    ]);

    return {
      type: StatisticType.TrafficOrder,
      countOfActions: totalOrders,
      amountEarnedOrSpent: -budgetResult.totalSpent,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      completedOrders: statusResult.completed,
      pendingOrders: statusResult.pending,
      totalBudget: budgetResult.totalBudget,
      spentAmount: budgetResult.totalSpent,
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
    const targetConditions = this.buildTargetWhereConditions(userId, query);
    const orderConditions = this.buildTargetOrderWhereConditions(userId, query);

    const [targetStats, orderStats] = await Promise.all([
      this.getTargetStats(targetConditions.conditions, targetConditions.parameters),
      this.getTargetOrderStats(orderConditions.conditions, orderConditions.parameters),
    ]);

    return {
      type: StatisticType.TrafficTarget,
      countOfActions: orderStats.totalOrders,
      amountEarnedOrSpent: orderStats.totalEarned,
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeTargetsCount: targetStats.activeTargets,
      totalOrdersCount: orderStats.totalOrders,
      avgPricePerMember: targetStats.avgPricePerMember,
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

    const netBalanceChangeDecimal = decimal(
      (userTransactionStats && typeof userTransactionStats === 'object' && 'netBalanceChange' in userTransactionStats
        ? String(userTransactionStats.netBalanceChange)
        : '0') || '0',
    );

    return {
      type: StatisticType.User,
      countOfActions: totalTransactions,
      amountEarnedOrSpent: toNumber(netBalanceChangeDecimal),
      period: this.formatPeriod(query.fromDate, query.endDate),
      generatedAt: new Date(),
      activeUsersCount,
      totalTransactions,
      netBalanceChange: toNumber(netBalanceChangeDecimal),
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

  /**
   * Helper: Build WHERE conditions for traffic orders
   */
  private buildOrderWhereConditions(baseFilter: {
    creator: string;
    orderId?: string;
    createdAt?: { $gte?: Date; $lte?: Date };
  }): { whereClause: string; parameters: unknown[] } {
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    let paramIndex = 1;

    if (baseFilter.creator) {
      conditions.push(`tor.creator = $${paramIndex}`);
      parameters.push(baseFilter.creator);
      paramIndex++;
    }

    if (baseFilter.orderId) {
      conditions.push(`tor.order_id = $${paramIndex}`);
      parameters.push(baseFilter.orderId);
      paramIndex++;
    }

    if (baseFilter.createdAt?.$gte) {
      conditions.push(`tor.created_at >= $${paramIndex}`);
      parameters.push(baseFilter.createdAt.$gte);
      paramIndex++;
    }

    if (baseFilter.createdAt?.$lte) {
      conditions.push(`tor.created_at <= $${paramIndex}`);
      parameters.push(baseFilter.createdAt.$lte);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, parameters };
  }

  /**
   * Helper: Get order budget statistics
   */
  private async getOrderBudgetStats(
    whereClause: string,
    parameters: unknown[],
  ): Promise<{ totalBudget: number; totalSpent: number }> {
    const result = await this.em.getConnection().execute(
      `SELECT COALESCE(SUM(CAST(budget AS DECIMAL)), 0) as "totalBudget",
              COALESCE(SUM(CAST(spent AS DECIMAL)), 0) as "totalSpent"
       FROM traffic_orders tor ${whereClause}`,
      parameters,
    );

    const row = this.getFirstRow(result);
    const totalBudgetDecimal = this.safeParseDecimal(row, 'totalBudget');
    const totalSpentDecimal = this.safeParseDecimal(row, 'totalSpent');

    return {
      totalBudget: toNumber(totalBudgetDecimal),
      totalSpent: toNumber(totalSpentDecimal),
    };
  }

  /**
   * Helper: Get order status counts
   */
  private async getOrderStatusCounts(
    whereClause: string,
    parameters: unknown[],
  ): Promise<{ completed: number; pending: number }> {
    const result = await this.em.getConnection().execute(
      `SELECT
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Completed}' THEN 1 END) as "completedOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Pending}' THEN 1 END) as "pendingOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.InProgress}' THEN 1 END) as "inProgressOrders",
        COUNT(CASE WHEN tor.status = '${TrafficOrderStatus.Active}' THEN 1 END) as "activeOrders"
       FROM traffic_orders tor ${whereClause}`,
      parameters,
    );

    const row = this.getFirstRow(result);
    const pendingOrders = this.safeParseInt(row, 'pendingOrders');
    const inProgressOrders = this.safeParseInt(row, 'inProgressOrders');
    const activeOrders = this.safeParseInt(row, 'activeOrders');

    return {
      completed: this.safeParseInt(row, 'completedOrders'),
      pending: pendingOrders + inProgressOrders + activeOrders,
    };
  }

  /**
   * Helper: Build WHERE conditions for traffic targets
   */
  private buildTargetWhereConditions(
    userId: string,
    query: StatisticQueryDto,
  ): { conditions: string; parameters: unknown[] } {
    const conditions: string[] = ['tt.managed_by = $1'];
    const parameters: unknown[] = [userId];
    let paramIndex = 2;

    if (query.targetId) {
      conditions.push(`tt.id = $${paramIndex}`);
      parameters.push(query.targetId);
      paramIndex++;
    }

    if (query.fromDate) {
      conditions.push(`tt.created_at >= $${paramIndex}`);
      parameters.push(new Date(query.fromDate));
      paramIndex++;
    }

    if (query.endDate) {
      conditions.push(`tt.created_at <= $${paramIndex}`);
      parameters.push(new Date(query.endDate));
      paramIndex++;
    }

    return { conditions: conditions.join(' AND '), parameters };
  }

  /**
   * Helper: Build WHERE conditions for target orders
   */
  private buildTargetOrderWhereConditions(
    userId: string,
    query: StatisticQueryDto,
  ): { conditions: string; parameters: unknown[] } {
    const conditions: string[] = ['tt.managed_by = $1', 'tor.status = $2'];
    const parameters: unknown[] = [userId, TrafficOrderStatus.Completed];
    let paramIndex = 3;

    if (query.targetId) {
      conditions.push(`tt.id = $${paramIndex}`);
      parameters.push(query.targetId);
      paramIndex++;
    }

    if (query.fromDate) {
      conditions.push(`tor.completed_at >= $${paramIndex}`);
      parameters.push(new Date(query.fromDate));
      paramIndex++;
    }

    if (query.endDate) {
      conditions.push(`tor.completed_at <= $${paramIndex}`);
      parameters.push(new Date(query.endDate));
      paramIndex++;
    }

    return { conditions: conditions.join(' AND '), parameters };
  }

  /**
   * Helper: Get target statistics
   */
  private async getTargetStats(
    whereConditions: string,
    parameters: unknown[],
  ): Promise<{ activeTargets: number; avgPricePerMember: number }> {
    const result = await this.em.getConnection().execute(
      `SELECT COUNT(tt.id) as "totalTargets",
              SUM(CASE WHEN tt.is_active = true THEN 1 ELSE 0 END) as "activeTargets",
              AVG(CAST(tt.price_per_member as DECIMAL)) as "avgPricePerMember"
       FROM traffic_targets tt
       WHERE ${whereConditions}`,
      parameters,
    );

    const row = this.getFirstRow(result);
    const avgPriceDecimal = this.safeParseDecimal(row, 'avgPricePerMember');

    return {
      activeTargets: this.safeParseInt(row, 'activeTargets'),
      avgPricePerMember: toNumber(avgPriceDecimal),
    };
  }

  /**
   * Helper: Get target order statistics
   */
  private async getTargetOrderStats(
    whereConditions: string,
    parameters: unknown[],
  ): Promise<{ totalOrders: number; totalEarned: number }> {
    const result = await this.em.getConnection().execute(
      `SELECT COUNT(tor.id) as "totalOrders",
              COALESCE(SUM(CAST(tor.spent_amount as DECIMAL)), 0) as "totalEarned"
       FROM traffic_orders tor
       LEFT JOIN traffic_targets tt ON tor.traffic_target_id = tt.id
       WHERE ${whereConditions}`,
      parameters,
    );

    const row = this.getFirstRow(result);
    const totalEarnedDecimal = this.safeParseDecimal(row, 'totalEarned');

    return {
      totalOrders: this.safeParseInt(row, 'totalOrders'),
      totalEarned: toNumber(totalEarnedDecimal),
    };
  }

  /**
   * Helper: Safely get first row from query result
   */
  private getFirstRow(result: unknown): Record<string, unknown> | null {
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }

    const [firstRow] = result;

    return firstRow && typeof firstRow === 'object' ? (firstRow as Record<string, unknown>) : null;
  }

  /**
   * Helper: Safely parse integer from query result
   */
  private safeParseInt(row: Record<string, unknown> | null, field: string): number {
    if (!row || !(field in row)) {
      return 0;
    }

    const value = String(row[field] ?? '0');

    return parseInt(value, 10) || 0;
  }

  /**
   * Helper: Safely parse Decimal from query result
   * Returns Decimal for precision-safe monetary calculations
   */
  private safeParseDecimal(row: Record<string, unknown> | null, field: string): Decimal {
    if (!row || !(field in row)) {
      return decimal(0);
    }

    const value = String(row[field] ?? '0');

    return decimal(value);
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
}
