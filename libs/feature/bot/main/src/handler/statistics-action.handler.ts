/**
 * Statistics Action Handler
 *
 * Handles user statistics and analytics actions including
 * overview, detailed stats, traffic analytics, and earnings.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedBotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { TrafficOrderEntity, TrafficOrderStatus, UserBalanceHistoryEntity, UserEntity } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, sum, toDisplayString, toNumber } from '@app/common-shared';
import { MessageService } from '../service/message.service';

interface UserStatistics {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalEarnings: number;
  avgOrderValue: number;
  successRate: number;
  referralEarnings: number;
}

interface DetailedStatistics {
  ordersByStatus: Record<string, number>;
  ordersByType: Record<string, number>;
  totalSpent: string | number;
  totalOrders: number;
}

interface TrafficStatistics {
  totalActions: number;
  totalTargetActions: number;
  completionRate: string | number;
  totalOrders: number;
}

interface EarningsStatistics {
  earningsByType: Record<string, number>;
  earningsLast7Days: string | number;
  earningsLast30Days?: string | number;
  totalEarnings?: string | number;
  totalTransactions?: number;
}

@Injectable()
export class StatisticsActionHandler {
  private readonly logger = new Logger(StatisticsActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {}

  /**
   * Handle statistics overview
   */
  async handleStatisticsOverview(ctx: AuthenticatedBotContext): Promise<void> {
    const stats = await this.calculateUserStatistics(ctx.user.id);
    const statsText = this.formatStatisticsOverview(stats, ctx.user, ctx);
    const keyboard = this.menuHandler.createStatisticsMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    this.logger.log('Statistics overview viewed', { userId: ctx.user.id });
  }

  /**
   * Handle detailed statistics
   */
  async handleDetailedStatistics(ctx: AuthenticatedBotContext): Promise<void> {
    const stats = await this.calculateDetailedStatistics(ctx.user.id);
    const statsText = this.formatDetailedStatistics(stats, ctx);
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    this.logger.log('Detailed statistics viewed', { userId: ctx.user.id });
  }

  /**
   * Handle traffic statistics
   */
  async handleTrafficStatistics(ctx: AuthenticatedBotContext): Promise<void> {
    const trafficStats = await this.calculateTrafficStatistics(ctx.user.id);
    const statsText = this.formatTrafficStatistics(trafficStats, ctx);
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    this.logger.log('Traffic statistics viewed', { userId: ctx.user.id });
  }

  /**
   * Handle earnings statistics
   */
  async handleEarningsStatistics(ctx: AuthenticatedBotContext): Promise<void> {
    const earningsStats = await this.calculateEarningsStatistics(ctx.user.id);
    const statsText = this.formatEarningsStatistics(earningsStats, ctx);
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });

    this.logger.log('Earnings statistics viewed', { userId: ctx.user.id });
  }

  /**
   * Calculate user statistics
   */
  private async calculateUserStatistics(userId: string): Promise<UserStatistics> {
    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      this.em.count(TrafficOrderEntity, { creator: userId }),
      this.em.count(TrafficOrderEntity, {
        creator: userId,
        status: { $in: [TrafficOrderStatus.Active, TrafficOrderStatus.InProgress] },
      }),
      this.em.count(TrafficOrderEntity, { creator: userId, status: TrafficOrderStatus.Completed }),
    ]);

    const earnings = await this.em.find(UserBalanceHistoryEntity, {
      user: userId,
      amount: { $gt: '0' },
    });

    const totalEarnings = toNumber(sum(earnings.map((e) => e.amount)));
    const avgOrderValue = totalOrders > 0 ? toNumber(decimal(totalEarnings).div(totalOrders)) : 0;
    const successRate = totalOrders > 0 ? toNumber(decimal(completedOrders).div(totalOrders).mul(100)) : 0;
    const referralEarnings = toNumber(sum(earnings.filter((e) => e.type === 'referral_bonus').map((e) => e.amount)));

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      totalEarnings,
      avgOrderValue,
      successRate,
      referralEarnings,
    };
  }

  /**
   * Calculate detailed statistics
   */
  private async calculateDetailedStatistics(userId: string): Promise<DetailedStatistics> {
    const orders = await this.em.find(TrafficOrderEntity, { creator: userId });

    const ordersByStatus = orders.reduce(
      (acc, order) =>
        Object.assign({}, acc, {
          [order.status]: (acc[order.status] || 0) + 1,
        }),
      {} as Record<string, number>,
    );

    const ordersByType = orders.reduce(
      (acc, order) =>
        Object.assign({}, acc, {
          [order.type]: (acc[order.type] || 0) + 1,
        }),
      {} as Record<string, number>,
    );

    const totalSpent = toNumber(sum(orders.map((order) => order.spentAmount)));

    return {
      ordersByStatus,
      ordersByType,
      totalSpent,
      totalOrders: orders.length,
    };
  }

  /**
   * Calculate traffic statistics
   */
  private async calculateTrafficStatistics(userId: string): Promise<TrafficStatistics> {
    const orders = await this.em.find(
      TrafficOrderEntity,
      { creator: userId },
      { populate: ['trafficSource', 'trafficTarget'] },
    );

    const totalActions = orders.reduce((sum, order) => sum + order.currentCount, 0);
    const totalTargetActions = orders.reduce((sum, order) => sum + order.targetCount, 0);
    const completionRate =
      totalTargetActions > 0 ? toNumber(decimal(totalActions).div(totalTargetActions).mul(100)) : 0;

    return {
      totalActions,
      totalTargetActions,
      completionRate,
      totalOrders: orders.length,
    };
  }

  /**
   * Calculate earnings statistics
   */
  private async calculateEarningsStatistics(userId: string): Promise<EarningsStatistics> {
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: userId },
      { orderBy: { createdAt: 'DESC' }, limit: 100 },
    );

    const earningsByType = history.reduce(
      (acc, entry) => {
        const amount = decimal(entry.amount);
        if (amount.greaterThan(0)) {
          return Object.assign({}, acc, {
            [entry.type]: toNumber(decimal(acc[entry.type] || 0).plus(amount)),
          });
        }

        return acc;
      },
      {} as Record<string, number>,
    );

    const last7Days = history.filter((entry) => {
      const daysDiff = (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      return daysDiff <= 7;
    });

    const earningsLast7Days = toNumber(
      sum(last7Days.filter((e) => decimal(e.amount).greaterThan(0)).map((e) => e.amount)),
    );

    return {
      earningsByType,
      earningsLast7Days,
      totalTransactions: history.length,
    };
  }

  /**
   * Format statistics overview
   */
  private formatStatisticsOverview(stats: UserStatistics, user: UserEntity, ctx: AuthenticatedBotContext): string {
    return (
      `<b>📊 ${ctx.t('statistics.overview_title', { default: 'Statistics Overview' })}</b>\n\n` +
      `<b>📦 ${ctx.t('statistics.orders', { default: 'Orders' })}:</b>\n` +
      `• ${ctx.t('statistics.total', { default: 'Total' })}: ${stats.totalOrders}\n` +
      `• ${ctx.t('statistics.active', { default: 'Active' })}: ${stats.activeOrders}\n` +
      `• ${ctx.t('statistics.completed', { default: 'Completed' })}: ${stats.completedOrders}\n\n` +
      `<b>💰 ${ctx.t('statistics.earnings', { default: 'Earnings' })}:</b>\n` +
      `• ${ctx.t('statistics.total', { default: 'Total' })}: $${toDisplayString(stats.totalEarnings, 2)}\n` +
      `• ${ctx.t('statistics.avg_per_order', { default: 'Avg per Order' })}: $${toDisplayString(stats.avgOrderValue, 2)}\n` +
      `• ${ctx.t('statistics.referral_earnings', { default: 'Referral Earnings' })}: $${toDisplayString(stats.referralEarnings, 2)}\n\n` +
      `<b>📈 ${ctx.t('statistics.performance', { default: 'Performance' })}:</b>\n` +
      `• ${ctx.t('statistics.success_rate', { default: 'Success Rate' })}: ${toDisplayString(stats.successRate, 1)}%\n` +
      `• ${ctx.t('statistics.total_referrals', { default: 'Total Referrals' })}: ${user.referralCount}\n\n` +
      `<i>${ctx.t('statistics.select_option', { default: 'Select an option below for detailed statistics.' })}</i>`
    );
  }

  /**
   * Format detailed statistics
   */
  private formatDetailedStatistics(stats: DetailedStatistics, ctx: AuthenticatedBotContext): string {
    let text = `<b>📊 ${ctx.t('statistics.detailed_title', { default: 'Detailed Statistics' })}</b>\n\n`;

    text += `<b>${ctx.t('statistics.orders_by_status', { default: 'Orders by Status' })}:</b>\n`;
    for (const [status, count] of Object.entries(stats.ordersByStatus)) {
      text += `• ${status}: ${count}\n`;
    }

    text += `\n<b>${ctx.t('statistics.orders_by_type', { default: 'Orders by Type' })}:</b>\n`;
    for (const [type, count] of Object.entries(stats.ordersByType)) {
      text += `• ${type}: ${count}\n`;
    }

    text += `\n<b>${ctx.t('statistics.total_spent', { default: 'Total Spent' })}:</b> $${toDisplayString(stats.totalSpent, 2)}\n`;
    text += `<b>${ctx.t('statistics.total_orders', { default: 'Total Orders' })}:</b> ${stats.totalOrders}`;

    return text;
  }

  /**
   * Format traffic statistics
   */
  private formatTrafficStatistics(stats: TrafficStatistics, ctx: AuthenticatedBotContext): string {
    return (
      `<b>🎯 ${ctx.t('statistics.traffic_title', { default: 'Traffic Statistics' })}</b>\n\n` +
      `<b>${ctx.t('statistics.total_actions', { default: 'Total Actions Completed' })}:</b> ${stats.totalActions}\n` +
      `<b>${ctx.t('statistics.target_actions', { default: 'Target Actions' })}:</b> ${stats.totalTargetActions}\n` +
      `<b>${ctx.t('statistics.completion_rate', { default: 'Completion Rate' })}:</b> ${toDisplayString(stats.completionRate, 1)}%\n` +
      `<b>${ctx.t('statistics.total_orders', { default: 'Total Orders' })}:</b> ${stats.totalOrders}\n\n` +
      `<i>${ctx.t('statistics.keep_completing', { default: 'Keep completing orders to improve your statistics!' })}</i>`
    );
  }

  /**
   * Format earnings statistics
   */
  private formatEarningsStatistics(stats: EarningsStatistics, ctx: AuthenticatedBotContext): string {
    let text = `<b>💎 ${ctx.t('statistics.earnings_title', { default: 'Earnings Statistics' })}</b>\n\n`;

    text += `<b>${ctx.t('statistics.earnings_by_type', { default: 'Earnings by Type' })}:</b>\n`;
    for (const [type, amount] of Object.entries(stats.earningsByType)) {
      text += `• ${type}: $${toDisplayString(amount as number, 2)}\n`;
    }

    text += `\n<b>${ctx.t('statistics.last_7_days', { default: 'Last 7 Days' })}:</b> $${toDisplayString(stats.earningsLast7Days, 2)}\n`;
    if (stats.earningsLast30Days !== undefined) {
      text += `<b>${ctx.t('statistics.last_30_days', { default: 'Last 30 Days' })}:</b> $${toDisplayString(stats.earningsLast30Days, 2)}\n`;
    }

    if (stats.totalEarnings !== undefined) {
      text += `<b>${ctx.t('statistics.total_earnings', { default: 'Total Earnings' })}:</b> $${toDisplayString(stats.totalEarnings, 2)}\n`;
    }

    if (stats.totalTransactions !== undefined) {
      text += `<b>${ctx.t('statistics.total_transactions', { default: 'Total Transactions' })}:</b> ${stats.totalTransactions}`;
    }

    return text;
  }
}
