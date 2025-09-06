import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';
import { TrafficBuyerEntity, TrafficBuyerType } from '../entity';

export class TrafficBuyerRepository extends EntityRepository<TrafficBuyerEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficBuyerEntity);
  }

  async findByTelegramId(telegramId: string): Promise<TrafficBuyerEntity | null> {
    return this.findOne({ telegramId });
  }

  async findByUsername(username: string): Promise<TrafficBuyerEntity | null> {
    return this.findOne({ username });
  }

  async findActiveByType(type: TrafficBuyerType): Promise<TrafficBuyerEntity[]> {
    return this.find({ type, isActive: true });
  }

  async findActiveBuyers(): Promise<TrafficBuyerEntity[]> {
    return this.find({ isActive: true });
  }

  async findByPriceRange(minPrice: number, maxPrice: number): Promise<TrafficBuyerEntity[]> {
    const results = await this.em.find(TrafficBuyerEntity, {
      isActive: true,
    });

    return results.filter((buyer) => {
      if (!buyer.pricePerMember) return false;
      const price = parseFloat(buyer.pricePerMember);
      return price >= minPrice && price <= maxPrice;
    });
  }

  async findByMemberCapacity(minMembers?: number, maxMembers?: number): Promise<TrafficBuyerEntity[]> {
    const conditions: FilterQuery<TrafficBuyerEntity> = { isActive: true };

    if (minMembers !== undefined) {
      conditions.minMembers = { $lte: minMembers };
    }
    if (maxMembers !== undefined) {
      conditions.maxMembers = { $gte: maxMembers };
    }

    return this.find(conditions);
  }

  async createTrafficBuyer(data: {
    name: string;
    description?: string;
    type: TrafficBuyerType;
    telegramId?: string;
    username?: string;
    inviteLink?: string;
    requiresApproval?: boolean;
    pricePerMember?: number;
    minMembers?: number;
    maxMembers?: number;
    config?: string;
  }): Promise<TrafficBuyerEntity> {
    const trafficBuyer = new TrafficBuyerEntity({
      ...data,
      config: data.config ? JSON.parse(data.config) : undefined,
      pricePerMember: data.pricePerMember?.toString(),
      isActive: true,
      requiresApproval: false,
    });
    await this.em.persistAndFlush(trafficBuyer);
    return trafficBuyer;
  }

  async updatePricing(id: string, pricePerMember: number): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      buyer.pricePerMember = pricePerMember.toString();
      await this.em.flush();
    }
  }

  async updateMemberLimits(id: string, minMembers?: number, maxMembers?: number): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      if (minMembers !== undefined) buyer.minMembers = minMembers;
      if (maxMembers !== undefined) buyer.maxMembers = maxMembers;
      await this.em.flush();
    }
  }

  async deactivateBuyer(id: string): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      buyer.isActive = false;
      await this.em.flush();
    }
  }

  async activateBuyer(id: string): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      buyer.isActive = true;
      await this.em.flush();
    }
  }

  async getBuyerStats(): Promise<{
    total: number;
    active: number;
    channels: number;
    groups: number;
    bots: number;
    withChecking: number;
    requiresApproval: number;
  }> {
    const [total, active, channels, groups, bots, withChecking, requiresApproval] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.count({ type: TrafficBuyerType.Channel }),
      this.count({ type: TrafficBuyerType.Group }),
      this.count({ type: TrafficBuyerType.Bot }),
      this.count({ type: TrafficBuyerType.WithChecking }),
      this.count({ requiresApproval: true }),
    ]);

    return { total, active, channels, groups, bots, withChecking, requiresApproval };
  }
}
