import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { UserEntity, UserStatus } from '../entity';

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
    return this.find({ status: UserStatus.Active });
  }

  async findUsersByReferrer(referredBy: string): Promise<UserEntity[]> {
    return this.find({ referredBy });
  }

  async createUser(data: {
    telegramId: string;
    username?: string;
    firstName: string;
    lastName?: string;
    languageCode?: string;
    referredBy?: string;
  }): Promise<UserEntity> {
    const user = new UserEntity(data);
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
      user.status = UserStatus.Restricted;
      await this.em.flush();
    }
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    restricted: number;
    banned: number;
  }> {
    const [total, active, restricted, banned] = await Promise.all([
      this.count(),
      this.count({ status: UserStatus.Active }),
      this.count({ status: UserStatus.Restricted }),
      this.count({ status: UserStatus.Banned }),
    ]);

    return { total, active, restricted, banned };
  }
}
