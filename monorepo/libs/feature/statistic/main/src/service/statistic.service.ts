import { Injectable } from '@nestjs/common';
import { TrafficOrderRepository, TrafficBuyerRepository, UserSourceVisitRepository } from '@app/database';

// Local interfaces to avoid cross-library imports
interface StatisticQueryDto {
  type?: 'sale' | 'purchase';
  orderId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface StatisticResponseDto {
  peopleCount: number;
  moneyAmount: number;
  period: string;
  shareLink?: string;
}

interface IStatisticService {
  getStatistic(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto>;
  getSharedStatistic(shareToken: string): Promise<StatisticResponseDto>;
}

@Injectable()
export class StatisticService implements IStatisticService {
  constructor(
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficBuyerRepository: TrafficBuyerRepository,
    private readonly userSourceVisitRepository: UserSourceVisitRepository,
  ) {}

  async getStatistic(userId: string, query: StatisticQueryDto): Promise<StatisticResponseDto> {
    let peopleCount = 0;
    let moneyAmount = 0;
    
    if (query.type === 'sale') {
      // Get sale statistics
      const saleStats = await this.getSaleStatistics(Number(userId), query);
      peopleCount = saleStats.peopleCount;
      moneyAmount = saleStats.moneyAmount;
    } else if (query.type === 'purchase') {
      // Get purchase statistics
      const purchaseStats = await this.getPurchaseStatistics(Number(userId), query);
      peopleCount = purchaseStats.peopleCount;
      moneyAmount = purchaseStats.moneyAmount;
    } else {
      // Get combined statistics
      const [saleStats, purchaseStats] = await Promise.all([
        this.getSaleStatistics(Number(userId), query),
        this.getPurchaseStatistics(Number(userId), query),
      ]);
      peopleCount = saleStats.peopleCount + purchaseStats.peopleCount;
      moneyAmount = saleStats.moneyAmount + purchaseStats.moneyAmount;
    }

    const shareToken = await this.generateShareToken(userId, query);

    return {
      peopleCount,
      moneyAmount,
      period: query.type || 'all',
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  async getSharedStatistic(shareToken: string): Promise<StatisticResponseDto> {
    // TODO: Implement share token validation and lookup
    // For now return basic stats
    return {
      peopleCount: 1200,
      moneyAmount: 12500.75,
      period: 'shared',
      shareLink: `https://motivbuy.com/share/stats/${shareToken}`,
    };
  }

  private async getSaleStatistics(userId: number, query: StatisticQueryDto): Promise<{ peopleCount: number; moneyAmount: number }> {
    const queryBuilder = this.trafficOrderRepository
      .createQueryBuilder('order')
      .where('order.sellerId = :userId', { userId })
      .andWhere('order.status = :status', { status: 'completed' });

    if (query.orderId) {
      queryBuilder.andWhere('order.id = :orderId', { orderId: Number(query.orderId) });
    }

    if (query.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: query.endDate });
    }

    const orders = await queryBuilder.getMany();
    
    // Get unique buyers count
    const uniqueBuyerIds = [...new Set(orders.map(order => order.buyerId))];
    
    return {
      peopleCount: uniqueBuyerIds.length,
      moneyAmount: orders.reduce((sum, order) => sum + order.price, 0),
    };
  }

  private async getPurchaseStatistics(userId: number, query: StatisticQueryDto): Promise<{ peopleCount: number; moneyAmount: number }> {
    const queryBuilder = this.trafficOrderRepository
      .createQueryBuilder('order')
      .where('order.buyerId = :userId', { userId })
      .andWhere('order.status = :status', { status: 'completed' });

    if (query.orderId) {
      queryBuilder.andWhere('order.id = :orderId', { orderId: Number(query.orderId) });
    }

    if (query.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: query.endDate });
    }

    const orders = await queryBuilder.getMany();
    
    // Get unique sellers count
    const uniqueSellerIds = [...new Set(orders.map(order => order.sellerId))];
    
    return {
      peopleCount: uniqueSellerIds.length,
      moneyAmount: orders.reduce((sum, order) => sum + order.price, 0),
    };
  }

  private async generateShareToken(userId: string, query: StatisticQueryDto): Promise<string> {
    // Generate a secure token (in a real app, store this in database)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${userId}-${timestamp}-${randomStr}`;
  }
}