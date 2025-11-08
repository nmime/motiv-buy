import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { NotificationEntity, NotificationStatus, NotificationTargetType } from '../entity';

@Injectable()
export class NotificationRepository extends EntityRepository<NotificationEntity> {
  constructor(em: EntityManager) {
    super(em, NotificationEntity);
  }

  async findPending(params: {
    targetType: NotificationTargetType;
    targetId?: string;
    limit: number;
  }): Promise<NotificationEntity[]> {
    const { targetType, targetId, limit } = params;
    const currentTime = new Date().toTimeString().slice(0, 8);

    const qb = this.createQueryBuilder('n')
      .where({ status: NotificationStatus.Pending, targetType })
      .andWhere({
        $or: [{ sendAt: { $lte: new Date() } }, { sendAt: null }],
      })
      .andWhere({
        $or: [
          {
            sendTimeFrom: { $lte: currentTime },
            sendTimeTo: { $gte: currentTime },
          },
          {
            $and: [{ sendTimeFrom: null }, { sendTimeTo: null }],
          },
        ],
      })
      .leftJoinAndSelect('n.template', 't')
      .orderBy([{ priority: 'DESC' }, { id: 'ASC' }])
      .limit(limit);

    if (targetId) {
      qb.andWhere({ targetId });
    }

    return await qb.getResultList();
  }

  async findPendingTargets(targetType: NotificationTargetType): Promise<string[]> {
    const currentTime = new Date().toTimeString().slice(0, 8);

    const results = await this.createQueryBuilder('n')
      .select('n.target_id as targetId')
      .distinct()
      .where({ status: NotificationStatus.Pending, targetType })
      .andWhere({
        $or: [{ sendAt: { $lte: new Date() } }, { sendAt: null }],
      })
      .andWhere({
        $or: [
          {
            sendTimeFrom: { $lte: currentTime },
            sendTimeTo: { $gte: currentTime },
          },
          {
            $and: [{ sendTimeFrom: null }, { sendTimeTo: null }],
          },
        ],
      })
      .execute('all');

    return results.map((r: { targetId: string }) => r.targetId);
  }

  async findRetryable(limit: number): Promise<NotificationEntity[]> {
    const results = await this.createQueryBuilder('n')
      .where({ status: NotificationStatus.Failed })
      .andWhere('n.retry_count < n.max_retries')
      .orderBy({ priority: 'DESC', updatedAt: 'ASC' })
      .limit(limit)
      .getResultList();

    return results;
  }

  async markAsSent(id: string, messageId: string): Promise<void> {
    await this.nativeUpdate(
      { id },
      {
        status: NotificationStatus.Sent,
        sentAt: new Date(),
        messageId,
      },
    );
  }

  async markAsFailed(id: string, error: NotificationEntity['error']): Promise<void> {
    const notification = await this.findOne({ id });
    if (!notification) {
      return;
    }

    notification.status = NotificationStatus.Failed;
    notification.error = error;
    notification.retryCount += 1;

    await this.em.flush();
  }

  async markAsProcessing(id: string): Promise<boolean> {
    const result = await this.nativeUpdate(
      { id, status: NotificationStatus.Pending },
      { status: NotificationStatus.Processing },
    );

    return result > 0;
  }

  async markAsCancelled(id: string): Promise<void> {
    await this.nativeUpdate({ id }, { status: NotificationStatus.Cancelled });
  }
}
