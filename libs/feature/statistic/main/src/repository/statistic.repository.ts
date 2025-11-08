import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { TrafficOrderStatus, UserStatus } from '@app/database';

export interface StatisticDateFilter {
  fromDate?: Date;
  endDate?: Date;
}

export interface AggregatedStats {
  count: number;
  sum: number;
  avg: number;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  amount: number;
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[complex object]';
  }
}

/**
 * Optimized repository for statistics queries with proper resource filtering
 * All queries use database-level aggregations and efficient joins
 */
@Injectable()
export class StatisticRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get user statistics with proper user filtering
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async getUserStatistics(
    userId: string,
    dateFilter?: StatisticDateFilter,
  ): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalTransactions: number;
    netBalanceChange: number;
    userSpecificTransactions?: number;
    userSpecificBalance?: number;
  }> {
    // Base user counts using raw SQL through EntityManager
    let userStatsQuery = `
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = $1 THEN 1 END) as active_users
      FROM users u
      WHERE ${this.buildDateFilter('created_at', dateFilter)}
    `;

    const params: unknown[] = [UserStatus.Active];

    if (userId) {
      userStatsQuery += ' AND id = $2';
      params.push(userId);
    }

    const userStatsRaw = await this.em.getConnection().execute(userStatsQuery, params);
    const userStats = Array.isArray(userStatsRaw) ? userStatsRaw : [];

    // Balance statistics using raw SQL
    let balanceStatsQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as net_balance_change
      FROM user_balance_history ubh
      LEFT JOIN users u ON ubh.user_id = u.id
      WHERE ${this.buildDateFilter('ubh.created_at', dateFilter)}
    `;

    const balanceParams: unknown[] = [];
    let balanceParamIndex = 1;

    if (userId) {
      balanceStatsQuery += ` AND u.id = $${balanceParamIndex}`;
      balanceParams.push(userId);
      balanceParamIndex++;
    }

    const balanceStatsRaw = await this.em.getConnection().execute(balanceStatsQuery, balanceParams);
    const balanceStats = Array.isArray(balanceStatsRaw) ? balanceStatsRaw : [];

    const userRow: Record<string, unknown> =
      userStats[0] && typeof userStats[0] === 'object' ? (userStats[0] as Record<string, unknown>) : {};

    const balanceRow: Record<string, unknown> =
      balanceStats[0] && typeof balanceStats[0] === 'object' ? (balanceStats[0] as Record<string, unknown>) : {};

    return {
      totalUsers: Number(userRow && 'total_users' in userRow ? userRow['total_users'] : 0) || 0,
      activeUsers: Number(userRow && 'active_users' in userRow ? userRow['active_users'] : 0) || 0,
      totalTransactions:
        Number(balanceRow && 'total_transactions' in balanceRow ? balanceRow['total_transactions'] : 0) || 0,
      netBalanceChange:
        Number(balanceRow && 'net_balance_change' in balanceRow ? balanceRow['net_balance_change'] : 0) || 0,
    };
  }

  /**
   * Get traffic source statistics with proper source filtering
  // eslint-disable-next-line sonarjs/cognitive-complexity
   */
  async getTrafficSourceStatistics(
    userId: string,
    sourceId?: string,
    dateFilter?: StatisticDateFilter,
  ): Promise<{
    uniqueSourcesCount: number;
    totalActions: number;
    totalReward: number;
    avgRewardPerAction: number;
  }> {
    // Traffic source statistics using raw SQL
    let query = `
      SELECT
        COUNT(DISTINCT ts.id) as unique_sources_count,
        COUNT(ta.id) as total_actions,
        COALESCE(SUM(CAST(ta.reward AS DECIMAL)), 0) as total_reward
      FROM traffic_sources ts
      LEFT JOIN traffic_actions ta ON ts.id = ta.traffic_source_id
      LEFT JOIN traffic_orders tor ON ta.traffic_order_id = tor.id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (ts.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (sourceId) {
      query += ` AND ts.id = $${paramIndex}`;
      params.push(sourceId);
      paramIndex++;
    }

    // Apply date filtering to actions
    if (dateFilter?.fromDate || dateFilter?.endDate) {
      const dateConditions: string[] = [];

      if (dateFilter.fromDate) {
        dateConditions.push(`ta.created_at >= $${paramIndex}`);
        params.push(dateFilter.fromDate);
        paramIndex++;
      }

      if (dateFilter.endDate) {
        dateConditions.push(`ta.created_at <= $${paramIndex}`);
        params.push(dateFilter.endDate);
        paramIndex++;
      }

      if (dateConditions.length > 0) {
        query += ` AND (${dateConditions.join(' AND ')})`;
      }
    }

    const statsRaw = await this.em.getConnection().execute(query, params);
    const stats: unknown[] = Array.isArray(statsRaw) ? statsRaw : [];
    const result: Record<string, unknown> =
      stats[0] && typeof stats[0] === 'object' ? (stats[0] as Record<string, unknown>) : {};

    const totalActions = Number(result && 'total_actions' in result ? result['total_actions'] : 0) || 0;
    const totalReward = Number(result && 'total_reward' in result ? result['total_reward'] : 0) || 0;

    return {
      uniqueSourcesCount: Number(result && 'unique_sources_count' in result ? result['unique_sources_count'] : 0) || 0,
      totalActions,
      totalReward,
      avgRewardPerAction: totalActions > 0 ? totalReward / totalActions : 0,
    };
  }

  /**
  // eslint-disable-next-line sonarjs/cognitive-complexity
   * Get traffic target statistics with proper target filtering
   */
  async getTrafficTargetStatistics(
    userId: string,
    targetId?: string,
    dateFilter?: StatisticDateFilter,
  ): Promise<{
    activeTargetsCount: number;
    totalOrdersCount: number;
    totalEarned: number;
    avgPricePerMember: number;
  }> {
    // Traffic target statistics using raw SQL
    let query = `
      SELECT
        COUNT(DISTINCT CASE WHEN tt.is_active = true THEN tt.id END) as active_targets_count,
        COUNT(tor.id) as total_orders_count,
        COALESCE(SUM(CAST(tor.spent_amount AS DECIMAL)), 0) as total_earned
      FROM traffic_targets tt
      LEFT JOIN traffic_orders tor ON tt.id = tor.traffic_target_id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (tt.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (targetId) {
      query += ` AND tt.id = $${paramIndex}`;
      params.push(targetId);
      paramIndex++;
    }

    // Apply date filtering to orders
    if (dateFilter?.fromDate || dateFilter?.endDate) {
      const dateConditions: string[] = [];

      if (dateFilter.fromDate) {
        dateConditions.push(`tor.created_at >= $${paramIndex}`);
        params.push(dateFilter.fromDate);
        paramIndex++;
      }

      if (dateFilter.endDate) {
        dateConditions.push(`tor.created_at <= $${paramIndex}`);
        params.push(dateFilter.endDate);
        paramIndex++;
      }

      if (dateConditions.length > 0) {
        query += ` AND (${dateConditions.join(' AND ')})`;
      }
    }

    const statsRaw = await this.em.getConnection().execute(query, params);
    const stats: unknown[] = Array.isArray(statsRaw) ? statsRaw : [];
    const result: Record<string, unknown> =
      stats[0] && typeof stats[0] === 'object' ? (stats[0] as Record<string, unknown>) : {};

    const totalOrders = Number(result && 'total_orders_count' in result ? result['total_orders_count'] : 0) || 0;
    const totalEarned = Number(result && 'total_earned' in result ? result['total_earned'] : 0) || 0;

    return {
      activeTargetsCount: Number(result && 'active_targets_count' in result ? result['active_targets_count'] : 0) || 0,
      totalOrdersCount: totalOrders,
      totalEarned,
      avgPricePerMember: totalOrders > 0 ? totalEarned / totalOrders : 0,
    };
  }

  /**
   * Get traffic order statistics with proper order filtering
   */
  async getTrafficOrderStatistics(
    userId: string,
    orderId?: string,
    dateFilter?: StatisticDateFilter,
  ): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalBudget: number;
    spentAmount: number;
  }> {
    // Traffic order statistics using raw SQL
    let query = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = $2 THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = $3 THEN 1 END) as pending_orders,
        COALESCE(SUM(CAST(total_budget AS DECIMAL)), 0) as total_budget,
        COALESCE(SUM(CAST(spent_amount AS DECIMAL)), 0) as spent_amount
      FROM traffic_orders tor
      WHERE creator_id = $1
    `;

    const params: unknown[] = [userId, TrafficOrderStatus.Completed, TrafficOrderStatus.Pending];
    let paramIndex = 4;

    if (orderId) {
      query += ` AND id = $${paramIndex}`;
      params.push(orderId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('created_at', dateFilter)}`;

    const statsRaw = await this.em.getConnection().execute(query, params);
    const stats: unknown[] = Array.isArray(statsRaw) ? statsRaw : [];
    const result: Record<string, unknown> =
      stats[0] && typeof stats[0] === 'object' ? (stats[0] as Record<string, unknown>) : {};

    return {
      totalOrders: Number(result && 'total_orders' in result ? result['total_orders'] : 0) || 0,
      completedOrders: Number(result && 'completed_orders' in result ? result['completed_orders'] : 0) || 0,
      pendingOrders: Number(result && 'pending_orders' in result ? result['pending_orders'] : 0) || 0,
      totalBudget: Number(result && 'total_budget' in result ? result['total_budget'] : 0) || 0,
      spentAmount: Number(result && 'spent_amount' in result ? result['spent_amount'] : 0) || 0,
    };
  }

  /**
   * Get traffic action statistics with proper action filtering
   */
  async getTrafficActionStatistics(
    userId: string,
    resourceId?: string,
    resourceType: 'source' | 'order' = 'source',
    dateFilter?: StatisticDateFilter,
  ): Promise<{
    totalActions: number;
    completedActions: number;
    pendingActions: number;
    totalReward: number;
  }> {
    // Traffic action statistics using raw SQL
    let query = `
      SELECT
        COUNT(*) as total_actions,
        COUNT(CASE WHEN ta.status = $2 THEN 1 END) as completed_actions,
        COUNT(CASE WHEN ta.status = $3 THEN 1 END) as pending_actions,
        COALESCE(SUM(CAST(ta.reward AS DECIMAL)), 0) as total_reward
      FROM traffic_actions ta
      LEFT JOIN traffic_sources ts ON ta.traffic_source_id = ts.id
      LEFT JOIN traffic_orders tor ON ta.traffic_order_id = tor.id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (ts.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId, 'completed', 'pending'];
    let paramIndex = 4;

    if (resourceId) {
      if (resourceType === 'source') {
        query += ` AND ta.traffic_source_id = $${paramIndex}`;
      } else {
        query += ` AND ta.traffic_order_id = $${paramIndex}`;
      }

      params.push(resourceId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('ta.created_at', dateFilter)}`;

    const statsRaw = await this.em.getConnection().execute(query, params);
    const stats: unknown[] = Array.isArray(statsRaw) ? statsRaw : [];
    const result: Record<string, unknown> =
      stats[0] && typeof stats[0] === 'object' ? (stats[0] as Record<string, unknown>) : {};

    return {
      totalActions: Number(result && 'total_actions' in result ? result['total_actions'] : 0) || 0,
      completedActions: Number(result && 'completed_actions' in result ? result['completed_actions'] : 0) || 0,
      pendingActions: Number(result && 'pending_actions' in result ? result['pending_actions'] : 0) || 0,
      totalReward: Number(result && 'total_reward' in result ? result['total_reward'] : 0) || 0,
    };
  }

  /**
   * Get time-series chart data for any entity type
   */
  async getTimeSeriesData(
    userId: string,
    entityType: 'source' | 'target' | 'order' | 'action' | 'user',
    resourceId?: string,
    dateFilter?: StatisticDateFilter,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<TimeSeriesData[]> {
    const dateFormat = this.getDateFormatForInterval(interval);

    switch (entityType) {
      case 'source':
        return this.getSourceTimeSeriesData(userId, resourceId, dateFilter, dateFormat);
      case 'target':
        return this.getTargetTimeSeriesData(userId, resourceId, dateFilter, dateFormat);
      case 'order':
        return this.getOrderTimeSeriesData(userId, resourceId, dateFilter, dateFormat);
      case 'action':
        return this.getActionTimeSeriesData(userId, resourceId, dateFilter, dateFormat);
      case 'user':
        return this.getUserTimeSeriesData(userId, resourceId, dateFilter, dateFormat);
      default:
        return [];
    }
  }

  /**
   * Helper method to build date filter conditions
   */
  private buildDateFilter(dateColumn: string, dateFilter?: StatisticDateFilter): string {
    const conditions = [];
    if (dateFilter?.fromDate) {
      conditions.push(`${dateColumn} >= '${dateFilter.fromDate.toISOString()}'`);
    }

    if (dateFilter?.endDate) {
      conditions.push(`${dateColumn} <= '${dateFilter.endDate.toISOString()}'`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  /**
   * Get PostgreSQL date format string for different intervals
   */
  private getDateFormatForInterval(interval: string): string {
    switch (interval) {
      case 'hour':
        return "TO_CHAR(created_at, 'YYYY-MM-DD HH24:00:00')";
      case 'day':
        return "TO_CHAR(created_at, 'YYYY-MM-DD')";
      case 'week':
        return "TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')";
      case 'month':
        return "TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD')";
      default:
        return "TO_CHAR(created_at, 'YYYY-MM-DD')";
    }
  }

  private async getSourceTimeSeriesData(
    userId: string,
    sourceId?: string,
    dateFilter?: StatisticDateFilter,
    dateFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')",
  ): Promise<TimeSeriesData[]> {
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(ta.reward AS DECIMAL)), 0) as amount
      FROM traffic_actions ta
      LEFT JOIN traffic_sources ts ON ta.traffic_source_id = ts.id
      LEFT JOIN traffic_orders tor ON ta.traffic_order_id = tor.id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (ts.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (sourceId) {
      query += ` AND ta.traffic_source_id = $${paramIndex}`;
      params.push(sourceId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('ta.created_at', dateFilter)}`;
    query += ` GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`;

    const resultsRaw = await this.em.getConnection().execute(query, params);
    const results = Array.isArray(resultsRaw) ? resultsRaw : [];

    return results
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
      .map((row) => ({
        date: safeStringify(row && 'date' in row ? row['date'] : ''),
        count: Number(row && 'count' in row ? row['count'] : 0) || 0,
        amount: Number(row && 'amount' in row ? row['amount'] : 0) || 0,
      }));
  }

  private async getTargetTimeSeriesData(
    userId: string,
    targetId?: string,
    dateFilter?: StatisticDateFilter,
    dateFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')",
  ): Promise<TimeSeriesData[]> {
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(tor.spent_amount AS DECIMAL)), 0) as amount
      FROM traffic_orders tor
      LEFT JOIN traffic_targets tt ON tor.traffic_target_id = tt.id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (tt.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (targetId) {
      query += ` AND tor.traffic_target_id = $${paramIndex}`;
      params.push(targetId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('tor.created_at', dateFilter)}`;
    query += ` GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`;

    const resultsRaw = await this.em.getConnection().execute(query, params);
    const results = Array.isArray(resultsRaw) ? resultsRaw : [];

    return results
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
      .map((row) => ({
        date: safeStringify(row && 'date' in row ? row['date'] : ''),
        count: Number(row && 'count' in row ? row['count'] : 0) || 0,
        amount: Number(row && 'amount' in row ? row['amount'] : 0) || 0,
      }));
  }

  private async getOrderTimeSeriesData(
    userId: string,
    orderId?: string,
    dateFilter?: StatisticDateFilter,
    dateFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')",
  ): Promise<TimeSeriesData[]> {
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(spent_amount AS DECIMAL)), 0) as amount
      FROM traffic_orders tor
      WHERE creator_id = $1
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (orderId) {
      query += ` AND id = $${paramIndex}`;
      params.push(orderId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('created_at', dateFilter)}`;
    query += ` GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`;

    const resultsRaw = await this.em.getConnection().execute(query, params);
    const results = Array.isArray(resultsRaw) ? resultsRaw : [];

    return results
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
      .map((row) => ({
        date: safeStringify(row && 'date' in row ? row['date'] : ''),
        count: Number(row && 'count' in row ? row['count'] : 0) || 0,
        amount: Number(row && 'amount' in row ? row['amount'] : 0) || 0,
      }));
  }

  private async getActionTimeSeriesData(
    userId: string,
    actionId?: string,
    dateFilter?: StatisticDateFilter,
    dateFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')",
  ): Promise<TimeSeriesData[]> {
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(ta.reward AS DECIMAL)), 0) as amount
      FROM traffic_actions ta
      LEFT JOIN traffic_sources ts ON ta.traffic_source_id = ts.id
      LEFT JOIN traffic_orders tor ON ta.traffic_order_id = tor.id
      LEFT JOIN users u ON tor.creator_id = u.id
      WHERE (ts.managed_by_id = $1 OR u.id = $1)
    `;

    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (actionId) {
      query += ` AND ta.id = $${paramIndex}`;
      params.push(actionId);
      paramIndex++;
    }

    query += ` AND ${this.buildDateFilter('ta.created_at', dateFilter)}`;
    query += ` GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`;

    const resultsRaw = await this.em.getConnection().execute(query, params);
    const results = Array.isArray(resultsRaw) ? resultsRaw : [];

    return results
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
      .map((row) => ({
        date: safeStringify(row && 'date' in row ? row['date'] : ''),
        count: Number(row && 'count' in row ? row['count'] : 0) || 0,
        amount: Number(row && 'amount' in row ? row['amount'] : 0) || 0,
      }));
  }

  private async getUserTimeSeriesData(
    userId: string,
    specificUserId?: string,
    dateFilter?: StatisticDateFilter,
    dateFormat = "TO_CHAR(created_at, 'YYYY-MM-DD')",
  ): Promise<TimeSeriesData[]> {
    let query = `
      SELECT
        ${dateFormat} as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as amount
      FROM user_balance_history ubh
      LEFT JOIN users u ON ubh.user_id = u.id
      WHERE u.id = $1
    `;

    const params: unknown[] = [specificUserId || userId];

    query += ` AND ${this.buildDateFilter('ubh.created_at', dateFilter)}`;
    query += ` GROUP BY ${dateFormat} ORDER BY ${dateFormat} ASC`;

    const resultsRaw = await this.em.getConnection().execute(query, params);
    const results = Array.isArray(resultsRaw) ? resultsRaw : [];

    return results
      .filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
      .map((row) => ({
        date: safeStringify(row && 'date' in row ? row['date'] : ''),
        count: Number(row && 'count' in row ? row['count'] : 0) || 0,
        amount: Number(row && 'amount' in row ? row['amount'] : 0) || 0,
      }));
  }
}
