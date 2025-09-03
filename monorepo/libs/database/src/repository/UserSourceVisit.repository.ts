import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { UserSourceVisitEntity, PlatformType, UserSourceVisitPlatformData } from '../entity/UserSourceVisit.entity';

export class UserSourceVisitRepository extends EntityRepository<UserSourceVisitEntity> {
  constructor(em: EntityManager) {
    super(em, UserSourceVisitEntity);
  }

  async createVisit(data: {
    userId: string;
    platformType: PlatformType;
    platformData?: UserSourceVisitPlatformData;
    params?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    linkType?: string;
    linkCode?: string;
    linkUserId?: string;
    language?: string;
    telegramLanguage?: string;
    continent?: string;
    country?: string;
    city?: string;
    ip?: string;
    isSignup?: boolean;
  }): Promise<UserSourceVisitEntity> {
    const { userId, linkUserId, ...visitData } = data;
    const visit = new UserSourceVisitEntity(visitData);
    
    // Set user references using entity manager
    if (userId) {
      visit.user = this.em.getReference('UserEntity', userId);
    }
    if (linkUserId) {
      visit.linkUser = this.em.getReference('UserEntity', linkUserId);
    }
    
    await this.em.persistAndFlush(visit);
    return visit;
  }

  async findByUserId(userId: string): Promise<UserSourceVisitEntity[]> {
    return this.find({ user: userId });
  }

  async findRecentVisits(limit: number = 10): Promise<UserSourceVisitEntity[]> {
    return this.find({}, { orderBy: { createdAt: 'DESC' }, limit });
  }

  async findByUtmSource(utmSource: string): Promise<UserSourceVisitEntity[]> {
    return this.find({ utmSource });
  }

  async findByUtmCampaign(utmCampaign: string): Promise<UserSourceVisitEntity[]> {
    return this.find({ utmCampaign });
  }

  async findSignupVisits(): Promise<UserSourceVisitEntity[]> {
    return this.find({ isSignup: true });
  }

  async getVisitStats(): Promise<{
    total: number;
    signups: number;
    uniqueUsers: number;
  }> {
    const [total, signups] = await Promise.all([
      this.count(),
      this.count({ isSignup: true }),
    ]);

    // TODO: Fix MikroORM query builder API
    const uniqueUsers = { count: 0 };

    return {
      total,
      signups,
      uniqueUsers: uniqueUsers.count,
    };
  }
}