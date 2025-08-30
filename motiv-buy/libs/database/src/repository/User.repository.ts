import {EntityManager, EntityRepository} from '@mikro-orm/core';
import {UserEntity} from '../entity';

export class UserRepository extends EntityRepository<UserEntity> {
  constructor(em: EntityManager) {
    super(em, UserEntity);
  }

  async findByTelegramId(telegramId: string): Promise<UserEntity | null> {
    return this.findOne({ telegramId });
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.findOne({ username });
  }

  async findActiveUsers(): Promise<UserEntity[]> {
    return this.find({ isActive: true });
  }

  async findPremiumUsers(): Promise<UserEntity[]> {
    return this.find({ isPremium: true });
  }

  async findUsersByReferrer(referredBy: string): Promise<UserEntity[]> {
    return this.find({ referredBy });
  }

  async createUser(data: {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    languageCode?: string;
    referredBy?: string;
    isActive?: boolean;
    isPremium?: boolean;
  }): Promise<UserEntity> {
    const user = new UserEntity({
      ...data,
      isActive: data.isActive ?? true,
      isPremium: data.isPremium ?? false
    });

    await this.em.persistAndFlush(user);
    return user;
  }

  async updateLastActive(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.lastActiveAt = new Date();
      await this.em.flush();
    }
  }

  async incrementReferralCount(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.referralCount += 1;
      await this.em.flush();
    }
  }

  async deactivateUser(telegramId: string): Promise<void> {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      user.isActive = false;
      await this.em.flush();
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    premium: number;
  }> {
    const [total, active, premium] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.count({ isPremium: true })
    ]);

    return { total, active, premium };
  }
}
