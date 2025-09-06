import { EntityRepository, EntityManager, ref } from '@mikro-orm/core';
import { UserLastAuthEntity, UserEntity } from '../entity';

export class UserLastAuthRepository extends EntityRepository<UserLastAuthEntity> {
  /**
   * Updates existing user auth info or creates new record if not exists
   * Cleaner implementation using MikroORM's assign and persist pattern
   */
  async upsertUserLastAuth(
    data: {
      userId: string;
      ip?: string;
      country?: string;
      city?: string;
      continent?: string;
    },
    entityManager?: EntityManager,
  ): Promise<UserLastAuthEntity> {
    const em = entityManager || this.em;

    // Try to find existing record
    let entity = await em.findOne(UserLastAuthEntity, { user: data.userId });

    if (entity) {
      em.assign(entity, {
        ip: data.ip,
        country: data.country,
        city: data.city,
        continent: data.continent,
      });
    } else {
      const userRef = em.getReference(UserEntity, data.userId);
      entity = new UserLastAuthEntity({
        user: ref(userRef),
        ip: data.ip,
        country: data.country,
        city: data.city,
        continent: data.continent,
      });
      em.persist(entity);
    }

    await em.flush();
    return entity;
  }
}
