/**
 * Statistics Action Handler
 *
 * Handles user statistics and analytics actions including
 * overview, detailed stats, traffic analytics, and earnings.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity, TrafficOrderEntity, TrafficOrderStatus, UserBalanceHistoryEntity } from '@app/database';
import { MenuActionHandler } from './menu-action.handler';
import { decimal, sum, toNumber, toDisplayString } from '@app/common-shared/util';

interface UserStatistics {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalEarnings: number;
  avgOrderValue: number;
  successRate: number;
  referralEarnings: number;
}

@Injectable()
export class StatisticsActionHandler {
  private readonly logger = new Logger(StatisticsActionHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly menuHandler: MenuActionHandler,
  ) {}

  /**
   * Handle statistics overview
   */
  async handleStatisticsOverview(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const stats = await this.calculateUserStatistics(user.id);
      const statsText = this.formatStatisticsOverview(stats, user);
      const keyboard = this.menuHandler.createStatisticsMenuKeyboard();

      await ctx.replyWithHTML(statsText, { reply_markup: keyboard });

      this.logger.log('Statistics overview viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle detailed statistics
   */
  async handleDetailedStatistics(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const stats = await this.calculateDetailedStatistics(user.id);
      const statsText = this.formatDetailedStatistics(stats);
      const keyboard = this.menuHandler.createBackButton('menu:statistics');

      await ctx.replyWithHTML(statsText, { reply_markup: keyboard });

      this.logger.log('Detailed statistics viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle traffic statistics
   */
  async handleTrafficStatistics(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const trafficStats = await this.calculateTrafficStatistics(user.id);
      const statsText = this.formatTrafficStatistics(trafficStats);
      const keyboard = this.menuHandler.createBackButton('menu:statistics');

      await ctx.replyWithHTML(statsText, { reply_markup: keyboard });

      this.logger.log('Traffic statistics viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
  }

  /**
   * Handle earnings statistics
   */
  async handleEarningsStatistics(ctx: BotContext): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Please authenticate first using /start');

        return;
      }

      const user = await this.findUserByTelegramId(ctx.from.id.toString());

      if (!user) {
        await ctx.reply('User not found. Please use /start to register.');

        return;
      }

      const earningsStats = await this.calculateEarningsStatistics(user.id);
      const statsText = this.formatEarningsStatistics(earningsStats);
      const keyboard = this.menuHandler.createBackButton('menu:statistics');

      await ctx.replyWithHTML(statsText, { reply_markup: keyboard });

      this.logger.log('Earnings statistics viewed', { userId: user.id });
    } catch (error) {
      await this.menuHandler.handleMenuError(ctx, error as Error);
    }
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

    // Calculate total earnings from balance history
    const earnings = await this.em.find(UserBalanceHistoryEntity, {
      user: userId,
      amount: { $gt: '0' },
    });

    const totalEarnings = toNumber(sum(earnings.map((e) => e.amount)));

    const avgOrderValue = totalOrders > 0 ? toNumber(decimal(totalEarnings).div(totalOrders)) : 0;
    const successRate = totalOrders > 0 ? toNumber(decimal(completedOrders).div(totalOrders).mul(100)) : 0;

    // Calculate referral earnings
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
  private async calculateDetailedStatistics(userId: string) {
    const orders = await this.em.find(TrafficOrderEntity, { creator: userId });

    const ordersByStatus = orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;

        return acc;
      },
      {} as Record<string, number>,
    );

    const ordersByType = orders.reduce(
      (acc, order) => {
        acc[order.type] = (acc[order.type] || 0) + 1;

        return acc;
      },
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
  private async calculateTrafficStatistics(userId: string) {
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
  private async calculateEarningsStatistics(userId: string) {
    const history = await this.em.find(
      UserBalanceHistoryEntity,
      { user: userId },
      { orderBy: { createdAt: 'DESC' }, limit: 100 },
    );

    const earningsByType = history.reduce(
      (acc, entry) => {
        const amount = decimal(entry.amount);
        if (amount.greaterThan(0)) {
          acc[entry.type] = toNumber(decimal(acc[entry.type] || 0).plus(amount));
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
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return await this.em.findOne(UserEntity, { telegramId });
  }

  /**
   * Format statistics overview
   */
  private formatStatisticsOverview(stats: UserStatistics, user: UserEntity): string {
    return (
      '<b>📊 Statistics Overview</b>\n\n' +
      `<b>📦 Orders:</b>\n` +
      `• Total: ${stats.totalOrders}\n` +
      `• Active: ${stats.activeOrders}\n` +
      `• Completed: ${stats.completedOrders}\n\n` +
      `<b>💰 Earnings:</b>\n` +
      `• Total: $${toDisplayString(stats.totalEarnings, 2)}\n` +
      `• Avg per Order: $${toDisplayString(stats.avgOrderValue, 2)}\n` +
      `• Referral Earnings: $${toDisplayString(stats.referralEarnings, 2)}\n\n` +
      `<b>📈 Performance:</b>\n` +
      `• Success Rate: ${toDisplayString(stats.successRate, 1)}%\n` +
      `• Total Referrals: ${user.referralCount}\n\n` +
      `<i>Select an option below for detailed statistics.</i>`
    );
  }

  /**
   * Format detailed statistics
   */
  private formatDetailedStatistics(stats: any): string {
    let text = '<b>📊 Detailed Statistics</b>\n\n';

    text += '<b>Orders by Status:</b>\n';
    for (const [status, count] of Object.entries(stats.ordersByStatus)) {
      text += `• ${status}: ${count}\n`;
    }

    text += '\n<b>Orders by Type:</b>\n';
    for (const [type, count] of Object.entries(stats.ordersByType)) {
      text += `• ${type}: ${count}\n`;
    }

    text += `\n<b>Total Spent:</b> $${toDisplayString(stats.totalSpent, 2)}\n`;
    text += `<b>Total Orders:</b> ${stats.totalOrders}`;

    return text;
  }

  /**
   * Format traffic statistics
   */
  private formatTrafficStatistics(stats: any): string {
    return (
      '<b>🎯 Traffic Statistics</b>\n\n' +
      `<b>Total Actions Completed:</b> ${stats.totalActions}\n` +
      `<b>Target Actions:</b> ${stats.totalTargetActions}\n` +
      `<b>Completion Rate:</b> ${toDisplayString(stats.completionRate, 1)}%\n` +
      `<b>Total Orders:</b> ${stats.totalOrders}\n\n` +
      `<i>Keep completing orders to improve your statistics!</i>`
    );
  }

  /**
   * Format earnings statistics
   */
  private formatEarningsStatistics(stats: any): string {
    let text = '<b>💎 Earnings Statistics</b>\n\n';

    text += '<b>Earnings by Type:</b>\n';
    for (const [type, amount] of Object.entries(stats.earningsByType)) {
      text += `• ${type}: $${toDisplayString(amount as number, 2)}\n`;
    }

    text += `\n<b>Last 7 Days:</b> $${toDisplayString(stats.earningsLast7Days, 2)}\n`;
    text += `<b>Total Transactions:</b> ${stats.totalTransactions}`;

    return text;
  }
}
