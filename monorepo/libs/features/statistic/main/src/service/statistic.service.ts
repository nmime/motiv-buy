import { Injectable } from '@nestjs/common';
import {
  IStatisticService,
  StatisticQueryDto,
  StatisticResponseDto,
  StatisticType,
} from '@app/feature-statistic-shared';

@Injectable()
export class StatisticService implements IStatisticService {
  async getStatistic(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto> {
    // TODO: Implement database queries with filtering
    const mockData = this.generateMockData(query.type);
    const shareToken = await this.generateShareToken(userId, query);

    return {
      ...mockData,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  async getSharedStatistic(shareToken: string): Promise<StatisticResponseDto> {
    // TODO: Validate share token and get associated query parameters
    return {
      peopleCount: 1200,
      amount: 12500.75,
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  private generateMockData(type?: StatisticType) {
    if (type === StatisticType.SALE) {
      return {
        peopleCount: 1500,
        amount: 15750.50,
      };
    } else if (type === StatisticType.PURCHASE) {
      return {
        peopleCount: 800,
        amount: 8200.25,
      };
    } else {
      return {
        peopleCount: 2300,
        amount: 7550.25,
      };
    }
  }

  private async generateShareToken(userId: string, query: StatisticQueryDto): Promise<string> {
    // TODO: Generate secure token and store query parameters
    return Math.random().toString(36).substring(2, 15);
  }
}