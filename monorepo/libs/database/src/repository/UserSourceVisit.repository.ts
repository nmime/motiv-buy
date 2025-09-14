import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { UserSourceVisitEntity } from '../entity/UserSourceVisit.entity';
import { PlatformType } from '../const';
import { UserSourceVisitPlatformData } from '../type';

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
    const userRef = ref(this.em.getReference('UserEntity', userId));
    const linkUserRef = linkUserId ? ref(this.em.getReference('UserEntity', linkUserId)) : undefined;

    const visit = new UserSourceVisitEntity({
      userId,
      linkUserId,
      isSignup: data.isSignup,
      ...visitData,
    });

    await this.em.persistAndFlush(visit);

    return visit;
  }

  async findByUserId(userId: string): Promise<UserSourceVisitEntity[]> {
    return this.find({ user: userId });
  }

  async findRecentVisits(limit = 10): Promise<UserSourceVisitEntity[]> {
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
  }> {
    const [total, signups] = await Promise.all([this.count(), this.count({ isSignup: true })]);

    return { total, signups };
  }
}
