import { Injectable } from '@nestjs/common';
import {
  StatisticResponseDto,
  LineChartResponseDto,
  ShareTokenResponseDto,
  ChartDataPointDto,
  StatisticType,
} from '../dto';
import { ServiceStatisticResponse, ServiceLineChartData, ServiceStatisticData } from '../type';

@Injectable()
export class StatisticMapper {
  /**
   * Map service statistic response to DTO
   */
  toStatisticResponse(serviceResponse: ServiceStatisticResponse): StatisticResponseDto {
    return {
      data: this.mapStatisticData(serviceResponse.data),
      shareLink: serviceResponse.shareLink,
    };
  }

  /**
   * Map service line chart response to DTO
   */
  toLineChartResponse(serviceData: ServiceLineChartData): LineChartResponseDto {
    return {
      type: serviceData.type,
      dataPoints: serviceData.dataPoints.map(
        (point): ChartDataPointDto => ({
          date: point.date,
          countOfActions: point.countOfActions,
          amountEarnedOrSpent: point.amountEarnedOrSpent,
        }),
      ),
      totalActions: serviceData.totalActions,
      totalAmount: serviceData.totalAmount,
      period: serviceData.period,
      interval: serviceData.interval,
      generatedAt: new Date(),
    };
  }

  /**
   * Map service statistic data to appropriate DTO type
   */
  private mapStatisticData(data: ServiceStatisticData) {
    switch (data.type) {
      case StatisticType.TrafficSource:
        return {
          type: data.type,
          countOfActions: data.countOfActions,
          amountEarnedOrSpent: data.amountEarnedOrSpent,
          period: data.period,
          generatedAt: data.generatedAt,
          totalReward: data.totalReward ?? 0,
          activeSourcesCount: data.activeSourcesCount ?? 0,
          avgRewardPerAction: data.avgRewardPerAction ?? 0,
        };
      case StatisticType.TrafficOrder:
        return {
          type: data.type,
          countOfActions: data.countOfActions,
          amountEarnedOrSpent: data.amountEarnedOrSpent,
          period: data.period,
          generatedAt: data.generatedAt,
          completedOrders: data.completedOrders ?? 0,
          pendingOrders: data.pendingOrders ?? 0,
          totalBudget: data.totalBudget ?? 0,
          spentAmount: data.spentAmount ?? 0,
        };
      case StatisticType.TrafficTarget:
        return {
          type: data.type,
          countOfActions: data.countOfActions,
          amountEarnedOrSpent: data.amountEarnedOrSpent,
          period: data.period,
          generatedAt: data.generatedAt,
          activeTargetsCount: data.activeTargetsCount ?? 0,
          totalOrdersCount: data.totalOrdersCount ?? 0,
          avgPricePerMember: data.avgPricePerMember ?? 0,
        };
      case StatisticType.User:
        return {
          type: data.type,
          countOfActions: data.countOfActions,
          amountEarnedOrSpent: data.amountEarnedOrSpent,
          period: data.period,
          generatedAt: data.generatedAt,
          activeUsersCount: data.activeUsersCount ?? 0,
          totalTransactions: data.totalTransactions ?? 0,
          netBalanceChange: data.netBalanceChange ?? 0,
        };
      default:
        return {
          type: data.type,
          countOfActions: data.countOfActions,
          amountEarnedOrSpent: data.amountEarnedOrSpent,
          period: data.period,
          generatedAt: data.generatedAt,
        };
    }
  }

  /**
   * Map share token generation to response DTO
   */
  toShareTokenResponse(shareToken: string): ShareTokenResponseDto {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      shareToken,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
      expiresAt,
    };
  }
}
