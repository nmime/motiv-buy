import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficBuyerEntity, TrafficBuyerType } from '../entities';

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
    return this.find({ 
      pricePerMember: { $gte: minPrice, $lte: maxPrice },
      isActive: true 
    });
  }

  async findByMemberCapacity(minMembers?: number, maxMembers?: number): Promise<TrafficBuyerEntity[]> {
    const conditions: any = { isActive: true };
    
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
      isActive: true,
      requiresApproval: false
    });
    await this.em.persistAndFlush(trafficBuyer);
    return trafficBuyer;
  }

  async updatePricing(id: number, pricePerMember: number): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      buyer.pricePerMember = pricePerMember;
      await this.em.flush();
    }
  }

  async updateMemberLimits(id: number, minMembers?: number, maxMembers?: number): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      if (minMembers !== undefined) buyer.minMembers = minMembers;
      if (maxMembers !== undefined) buyer.maxMembers = maxMembers;
      await this.em.flush();
    }
  }

  async deactivateBuyer(id: number): Promise<void> {
    const buyer = await this.findOne({ id });
    if (buyer) {
      buyer.isActive = false;
      await this.em.flush();
    }
  }

  async activateBuyer(id: number): Promise<void> {
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
      this.count({ requiresApproval: true })
    ]);

    return { total, active, channels, groups, bots, withChecking, requiresApproval };
  }
}