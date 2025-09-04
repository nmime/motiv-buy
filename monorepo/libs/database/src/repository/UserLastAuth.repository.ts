import { EntityRepository } from '@mikro-orm/core';
import { UserLastAuthEntity } from '../entity';

export class UserLastAuthRepository extends EntityRepository<UserLastAuthEntity> {
  /**
   * Update or insert user last auth information
   */
  async upsertUserLastAuth(data: {
    userId: string;
    ip?: string;
    country?: string;
    city?: string;
    continent?: string;
  }): Promise<void> {
    const existingAuth = await this.findOne({ userId: data.userId });

    if (existingAuth) {
      // Update existing record
      existingAuth.ip = data.ip;
      existingAuth.country = data.country;
      existingAuth.city = data.city;
      existingAuth.continent = data.continent;
      existingAuth.updatedAt = new Date();
      await this.em.persistAndFlush(existingAuth);
    } else {
      // Create new record
      const newAuth = new UserLastAuthEntity(data);
      await this.em.persistAndFlush(newAuth);
    }
  }

  /**
   * Find user last auth by user ID
   */
  async findByUserId(userId: string): Promise<UserLastAuthEntity | null> {
    return await this.findOne({ userId });
  }
}
