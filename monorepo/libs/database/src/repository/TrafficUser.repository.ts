import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficUserEntity, TrafficUserStatus, TrafficSourceEntity } from '../entity';

export class TrafficUserRepository extends EntityRepository<TrafficUserEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficUserEntity);
  }

  async findByTelegramId(telegramId: string): Promise<TrafficUserEntity | null> {
    return this.findOne({ telegramId });
  }

  async findByUsername(username: string): Promise<TrafficUserEntity | null> {
    return this.findOne({ username });
  }

  async findByStatus(status: TrafficUserStatus): Promise<TrafficUserEntity[]> {
    return this.find({ status });
  }

  async findActiveUsers(): Promise<TrafficUserEntity[]> {
    return this.find({ status: TrafficUserStatus.Active });
  }

  async findAvailableBots(): Promise<TrafficUserEntity[]> {
    return this.find({ 
      status: TrafficUserStatus.Active,
      isBot: true,
      canJoinGroups: true 
    });
  }

  async findByCompletionRate(minRate: number): Promise<TrafficUserEntity[]> {
    return this.find({ 
      completionRate: { $gte: minRate },
      status: TrafficUserStatus.Active 
    });
  }

  async findTopPerformers(limit: number = 10): Promise<TrafficUserEntity[]> {
    return this.find(
      { status: TrafficUserStatus.Active }, 
      { orderBy: { completionRate: 'DESC', totalEarnings: 'DESC' }, limit }
    );
  }

  async createTrafficUser(data: {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    status: TrafficUserStatus;
    languageCode?: string;
    isBot?: boolean;
    canJoinGroups?: boolean;
    canReceiveMessages?: boolean;
    supportsInlineQueries?: boolean;
    trafficSourceId: number;
  }): Promise<TrafficUserEntity> {
    const trafficSource = await this.em.findOneOrFail(TrafficSourceEntity, data.trafficSourceId);
    const trafficUser = new TrafficUserEntity({
      ...data,
      trafficSource,
      isBot: data.isBot ?? true,
      canJoinGroups: data.canJoinGroups ?? true,
      canReceiveMessages: data.canReceiveMessages ?? false,
      supportsInlineQueries: data.supportsInlineQueries ?? false
    });
    await this.em.persistAndFlush(trafficUser);
    return trafficUser;
  }

  async updateStatus(telegramId: string, status: TrafficUserStatus): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.status = status;
      await this.em.flush();
    }
  }

  async updateLastSeen(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.lastSeenAt = new Date();
      await this.em.flush();
    }
  }

  async incrementOrderCount(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.totalOrdersParticipated += 1;
      await this.em.flush();
    }
  }

  async updateEarnings(telegramId: string, amount: number): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.totalEarnings += amount;
      await this.em.flush();
    }
  }

  async updateCompletionRate(telegramId: string, rate: number): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.completionRate = Math.max(0, Math.min(100, rate)); // Ensure rate is between 0-100
      await this.em.flush();
    }
  }

  async banUser(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.status = TrafficUserStatus.Banned;
      await this.em.flush();
    }
  }

  async unbanUser(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.status = TrafficUserStatus.Active;
      await this.em.flush();
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    banned: number;
    pending: number;
    bots: number;
    humans: number;
  }> {
    const [total, active, inactive, banned, pending, bots, humans] = await Promise.all([
      this.count(),
      this.count({ status: TrafficUserStatus.Active }),
      this.count({ status: TrafficUserStatus.Inactive }),
      this.count({ status: TrafficUserStatus.Banned }),
      this.count({ status: TrafficUserStatus.Pending }),
      this.count({ isBot: true }),
      this.count({ isBot: false })
    ]);

    return { total, active, inactive, banned, pending, bots, humans };
  }

  async getPerformanceStats(): Promise<{
    averageCompletionRate: number;
    totalEarnings: number;
    totalOrdersCompleted: number;
  }> {
    const users = await this.findAll();
    
    if (users.length === 0) {
      return {
        averageCompletionRate: 0,
        totalEarnings: 0,
        totalOrdersCompleted: 0
      };
    }

    const totalCompletionRate = users.reduce((sum, user) => sum + user.completionRate, 0);
    const totalEarnings = users.reduce((sum, user) => sum + user.totalEarnings, 0);
    const totalOrdersCompleted = users.reduce((sum, user) => sum + user.totalOrdersParticipated, 0);

    return {
      averageCompletionRate: totalCompletionRate / users.length,
      totalEarnings,
      totalOrdersCompleted
    };
  }
}
