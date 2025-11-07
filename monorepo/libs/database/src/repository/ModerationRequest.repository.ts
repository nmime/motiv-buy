import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ModerationRequestEntity, ModerationEntityType, ModerationStatus } from '../entity';

export class ModerationRequestRepository extends EntityRepository<ModerationRequestEntity> {
  constructor(em: EntityManager) {
    super(em, ModerationRequestEntity);
  }

  /**
   * Create a new moderation request
   */
  async createRequest(data: {
    entityType: ModerationEntityType;
    entityId: string;
    telegramChatId?: string;
    telegramMessageId?: string;
  }): Promise<ModerationRequestEntity> {
    const request = new ModerationRequestEntity({
      ...data,
      status: ModerationStatus.Pending,
    });

    await this.em.persistAndFlush(request);

    return request;
  }

  /**
   * Find moderation request by entity
   */
  async findByEntity(entityType: ModerationEntityType, entityId: string): Promise<ModerationRequestEntity | null> {
    return this.findOne({ entityType, entityId });
  }

  /**
   * Find moderation request by Telegram message
   */
  async findByTelegramMessage(chatId: string, messageId: string): Promise<ModerationRequestEntity | null> {
    return this.findOne({
      telegramChatId: chatId,
      telegramMessageId: messageId,
    });
  }

  /**
   * Get all pending moderation requests
   */
  async findPending(): Promise<ModerationRequestEntity[]> {
    return this.find(
      { status: ModerationStatus.Pending },
      { orderBy: { createdAt: 'ASC' } },
    );
  }

  /**
   * Get pending requests by type
   */
  async findPendingByType(entityType: ModerationEntityType): Promise<ModerationRequestEntity[]> {
    return this.find(
      { entityType, status: ModerationStatus.Pending },
      { orderBy: { createdAt: 'ASC' } },
    );
  }

  /**
   * Approve a moderation request
   */
  async approve(
    requestId: string,
    reviewedByUserId: string,
    reviewNote?: string,
  ): Promise<ModerationRequestEntity | null> {
    const request = await this.findOne({ id: requestId });

    if (!request) {
      return null;
    }

    request.status = ModerationStatus.Approved;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote;

    // Load and set the reviewer
    const em = this.em.fork();
    const reviewer = await em.findOne('UserEntity', { id: reviewedByUserId });

    if (reviewer) {
      request.reviewedBy = em.getReference('UserEntity', reviewedByUserId);
    }

    await this.em.flush();

    return request;
  }

  /**
   * Decline a moderation request
   */
  async decline(
    requestId: string,
    reviewedByUserId: string,
    reviewNote?: string,
  ): Promise<ModerationRequestEntity | null> {
    const request = await this.findOne({ id: requestId });

    if (!request) {
      return null;
    }

    request.status = ModerationStatus.Declined;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote;

    // Load and set the reviewer
    const em = this.em.fork();
    const reviewer = await em.findOne('UserEntity', { id: reviewedByUserId });

    if (reviewer) {
      request.reviewedBy = em.getReference('UserEntity', reviewedByUserId);
    }

    await this.em.flush();

    return request;
  }

  /**
   * Update Telegram message ID after sending notification
   */
  async updateTelegramMessage(requestId: string, chatId: string, messageId: string): Promise<void> {
    const request = await this.findOne({ id: requestId });

    if (request) {
      request.telegramChatId = chatId;
      request.telegramMessageId = messageId;
      await this.em.flush();
    }
  }

  /**
   * Get moderation statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    declined: number;
  }> {
    const [total, pending, approved, declined] = await Promise.all([
      this.count(),
      this.count({ status: ModerationStatus.Pending }),
      this.count({ status: ModerationStatus.Approved }),
      this.count({ status: ModerationStatus.Declined }),
    ]);

    return { total, pending, approved, declined };
  }
}
