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
import { PaymentConfigService } from '@app/feature-payment-shared';

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
    private readonly paymentConfigService: PaymentConfigService,
  ) {}

  private get currencySymbol(): string {
    return this.paymentConfigService.getBaseCurrencySymbol();
  }

  /**
   * Handle statistics overview
   */
  async handleStatisticsOverview(ctx: AuthenticatedBotContext): Promise<void> {
    const stats = await this.calculateUserStatistics(ctx.user.id);
    const statsText = this.formatStatisticsOverview(stats, ctx.user, ctx);
    const keyboard = this.menuHandler.createStatisticsMenuKeyboard(ctx);

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,

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
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,

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
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,

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
    const keyboard = this.menuHandler.createBackButton('menu:statistics', ctx.t('common.back'));

    await this.messageService.sendOrEditMessage(ctx, {
      text: statsText,

      replyMarkup: keyboard,
    });

    this.logger.log('Earnings statistics viewed', { userId: ctx.user.id });
  }

  /**
   * Calculate user statistics
   */
  private async calculateUserStatistics(userId: string): Promise<UserStatistics> {
    const em = this.em.fork();
    const [totalOrders, activeOrders, completedOrders] = await Promise.all([
      em.count(TrafficOrderEntity, { creator: userId }),
      em.count(TrafficOrderEntity, {
        creator: userId,
        status: TrafficOrderStatus.Active,
      }),
      em.count(TrafficOrderEntity, { creator: userId, status: TrafficOrderStatus.Completed }),
    ]);

    const earnings = await em.find(UserBalanceHistoryEntity, {
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
    const em = this.em.fork();
    const orders = await em.find(TrafficOrderEntity, { creator: userId });

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
    const em = this.em.fork();
    const orders = await em.find(
      TrafficOrderEntity,
      { creator: userId },
      { populate: ['orderSources', 'orderTargets', 'orderSources.trafficSource', 'orderTargets.trafficTarget'] },
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
    const em = this.em.fork();
    const history = await em.find(
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
    const symbol = this.currencySymbol;

    return (
      `<b>📊 ${ctx.t('statistics.overview_title')}</b>\n\n` +
      `<b>📦 ${ctx.t('statistics.orders')}:</b>\n` +
      `• ${ctx.t('statistics.total')}: ${stats.totalOrders}\n` +
      `• ${ctx.t('statistics.active')}: ${stats.activeOrders}\n` +
      `• ${ctx.t('statistics.completed')}: ${stats.completedOrders}\n\n` +
      `<b>💰 ${ctx.t('statistics.earnings')}:</b>\n` +
      `• ${ctx.t('statistics.total')}: ${symbol}${toDisplayString(stats.totalEarnings, 2)}\n` +
      `• ${ctx.t('statistics.avg_per_order')}: ${symbol}${toDisplayString(stats.avgOrderValue, 2)}\n` +
      `• ${ctx.t('statistics.referral_earnings')}: ${symbol}${toDisplayString(stats.referralEarnings, 2)}\n\n` +
      `<b>📈 ${ctx.t('statistics.performance')}:</b>\n` +
      `• ${ctx.t('statistics.success_rate')}: ${toDisplayString(stats.successRate, 1)}%\n` +
      `• ${ctx.t('statistics.total_referrals')}: ${user.referralCount}\n\n` +
      `<i>${ctx.t('statistics.select_option')}</i>`
    );
  }

  /**
   * Format detailed statistics
   */
  private formatDetailedStatistics(stats: DetailedStatistics, ctx: AuthenticatedBotContext): string {
    let text = `<b>📊 ${ctx.t('statistics.detailed_title')}</b>\n\n`;

    text += `<b>${ctx.t('statistics.orders_by_status')}:</b>\n`;
    for (const [status, count] of Object.entries(stats.ordersByStatus)) {
      text += `• ${status}: ${count}\n`;
    }

    text += `\n<b>${ctx.t('statistics.orders_by_type')}:</b>\n`;
    for (const [type, count] of Object.entries(stats.ordersByType)) {
      text += `• ${type}: ${count}\n`;
    }

    text += `\n<b>${ctx.t('statistics.total_spent')}:</b> ${this.currencySymbol}${toDisplayString(stats.totalSpent, 2)}\n`;
    text += `<b>${ctx.t('statistics.total_orders')}:</b> ${stats.totalOrders}`;

    return text;
  }

  /**
   * Format traffic statistics
   */
  private formatTrafficStatistics(stats: TrafficStatistics, ctx: AuthenticatedBotContext): string {
    return (
      `<b>🎯 ${ctx.t('statistics.traffic_title')}</b>\n\n` +
      `<b>${ctx.t('statistics.total_actions')}:</b> ${stats.totalActions}\n` +
      `<b>${ctx.t('statistics.target_actions')}:</b> ${stats.totalTargetActions}\n` +
      `<b>${ctx.t('statistics.completion_rate')}:</b> ${toDisplayString(stats.completionRate, 1)}%\n` +
      `<b>${ctx.t('statistics.total_orders')}:</b> ${stats.totalOrders}\n\n` +
      `<i>${ctx.t('statistics.keep_completing')}</i>`
    );
  }

  /**
   * Format earnings statistics
   */
  private formatEarningsStatistics(stats: EarningsStatistics, ctx: AuthenticatedBotContext): string {
    const symbol = this.currencySymbol;
    let text = `<b>💎 ${ctx.t('statistics.earnings_title')}</b>\n\n`;

    text += `<b>${ctx.t('statistics.earnings_by_type')}:</b>\n`;
    for (const [type, amount] of Object.entries(stats.earningsByType)) {
      text += `• ${type}: ${symbol}${toDisplayString(amount as number, 2)}\n`;
    }

    text += `\n<b>${ctx.t('statistics.last_7_days')}:</b> ${symbol}${toDisplayString(stats.earningsLast7Days, 2)}\n`;
    if (stats.earningsLast30Days !== undefined) {
      text += `<b>${ctx.t('statistics.last_30_days')}:</b> ${symbol}${toDisplayString(stats.earningsLast30Days, 2)}\n`;
    }

    if (stats.totalEarnings !== undefined) {
      text += `<b>${ctx.t('statistics.total_earnings')}:</b> ${symbol}${toDisplayString(stats.totalEarnings, 2)}\n`;
    }

    if (stats.totalTransactions !== undefined) {
      text += `<b>${ctx.t('statistics.total_transactions')}:</b> ${stats.totalTransactions}`;
    }

    return text;
  }

  // ===== Additional Methods (extracted from callback-router) =====

  async handleProfileStatsMenu(ctx: AuthenticatedBotContext, params: string[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.handleStatisticsOverview(ctx);

      return;
    }

    const statsHandlers: Record<string, (ctx: AuthenticatedBotContext) => Promise<void>> = {
      overview: (ctx) => this.handleStatisticsOverview(ctx),
      activity: (ctx) => this.handleDetailedStatistics(ctx),
      earnings: (ctx) => this.handleEarningsStatistics(ctx),
      performance: (ctx) => this.handleTrafficStatistics(ctx),
    };

    const [statType] = params;
    const handler = statsHandlers[statType] || statsHandlers.overview;
    await handler(ctx);
  }
}
