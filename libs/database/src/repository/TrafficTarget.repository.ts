import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';
import { TrafficTargetEntity, TrafficTargetType, TrafficTargetStatus } from '../entity';

export class TrafficTargetRepository extends EntityRepository<TrafficTargetEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficTargetEntity);
  }

  async findByTelegramId(telegramId: string): Promise<TrafficTargetEntity | null> {
    return this.findOne({ telegramId });
  }

  async findByUsername(username: string): Promise<TrafficTargetEntity | null> {
    return this.findOne({ username });
  }

  async findActiveByType(type: TrafficTargetType): Promise<TrafficTargetEntity[]> {
    return this.find({ type, isActive: true });
  }

  async findActiveTargets(): Promise<TrafficTargetEntity[]> {
    return this.find({ isActive: true });
  }

  async findByPriceRange(minPrice: number, maxPrice: number): Promise<TrafficTargetEntity[]> {
    const results = await this.em.find(TrafficTargetEntity, {
      isActive: true,
    });

    return results.filter((target) => {
      if (!target.pricePerMember) {
        return false;
      }

      const price = parseFloat(target.pricePerMember);

      return price >= minPrice && price <= maxPrice;
    });
  }

  async findByMemberCapacity(minMembers?: number, maxMembers?: number): Promise<TrafficTargetEntity[]> {
    const conditions: FilterQuery<TrafficTargetEntity> = { isActive: true };

    if (minMembers !== undefined) {
      conditions.minMembers = { $lte: minMembers };
    }

    if (maxMembers !== undefined) {
      conditions.maxMembers = { $gte: maxMembers };
    }

    return this.find(conditions);
  }

  async createTrafficTarget(data: {
    name: string;
    description?: string;
    type: TrafficTargetType;
    status: TrafficTargetStatus;
    telegramId?: string;
    username?: string;
    inviteLink?: string;
    requiresApproval?: boolean;
    pricePerMember?: number;
    minMembers?: number;
    maxMembers?: number;
    config?: string;
  }): Promise<TrafficTargetEntity> {
    const trafficTarget = new TrafficTargetEntity({
      ...data,
      config: data.config ? (JSON.parse(data.config) as Record<string, unknown>) : undefined,
      pricePerMember: data.pricePerMember?.toString(),
      status: data.status,
      isActive: true,
      requiresApproval: false,
    });

    await this.em.persistAndFlush(trafficTarget);

    return trafficTarget;
  }

  async updatePricing(id: string, pricePerMember: number): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.pricePerMember = pricePerMember.toString();
      await this.em.flush();
    }
  }

  async updateMemberLimits(id: string, minMembers?: number, maxMembers?: number): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      if (minMembers !== undefined) {
        target.minMembers = minMembers;
      }

      if (maxMembers !== undefined) {
        target.maxMembers = maxMembers;
      }

      await this.em.flush();
    }
  }

  async deactivateTarget(id: string): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.isActive = false;
      target.status = TrafficTargetStatus.Inactive;
      await this.em.flush();
    }
  }

  async activateTarget(id: string): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.isActive = true;
      target.status = TrafficTargetStatus.Active;
      await this.em.flush();
    }
  }

  /**
   * Suspend target - set status to Suspended
   */
  async suspendTarget(id: string): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.status = TrafficTargetStatus.Suspended;
      target.isActive = false;
      await this.em.flush();
    }
  }

  /**
   * Set target to pending verification
   */
  async setPendingVerification(id: string): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.status = TrafficTargetStatus.PendingVerification;
      target.isActive = false;
      await this.em.flush();
    }
  }

  /**
   * Set target to inactive (owner disabled)
   */
  async setInactive(id: string): Promise<void> {
    const target = await this.findOne({ id });
    if (target) {
      target.status = TrafficTargetStatus.Inactive;
      target.isActive = false;
      await this.em.flush();
    }
  }

  async getTargetStats(): Promise<{
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
      this.count({ type: TrafficTargetType.Channel }),
      this.count({ type: TrafficTargetType.Group }),
      this.count({ type: TrafficTargetType.Bot }),
      this.count({ type: TrafficTargetType.WithChecking }),
      this.count({ requiresApproval: true }),
    ]);

    return { total, active, channels, groups, bots, withChecking, requiresApproval };
  }
}
