import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { NotificationTemplateEntity } from '../entity';

@Injectable()
export class NotificationTemplateRepository extends EntityRepository<NotificationTemplateEntity> {
  constructor(em: EntityManager) {
    super(em, NotificationTemplateEntity);
  }

  async findByCode(code: string): Promise<NotificationTemplateEntity | null> {
    return await this.findOne({ code, isActive: true });
  }

  async findActiveByCodes(codes: string[]): Promise<NotificationTemplateEntity[]> {
    return await this.find({ code: { $in: codes }, isActive: true });
  }

  async findAllActive(): Promise<NotificationTemplateEntity[]> {
    return await this.find({ isActive: true }, { orderBy: { code: 'ASC' } });
  }
}
