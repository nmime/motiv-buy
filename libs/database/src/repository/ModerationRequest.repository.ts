import { EntityManager, EntityRepository, ref } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import { ModerationEntityType, ModerationRequestEntity, ModerationStatus, UserEntity } from '../entity';

export class ModerationRequestRepository extends EntityRepository<ModerationRequestEntity> {
  private readonly logger = new Logger(ModerationRequestRepository.name);

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
    return this.find({ status: ModerationStatus.Pending }, { orderBy: { createdAt: 'ASC' } });
  }

  /**
   * Get pending requests by type
   */
  async findPendingByType(entityType: ModerationEntityType): Promise<ModerationRequestEntity[]> {
    return this.find({ entityType, status: ModerationStatus.Pending }, { orderBy: { createdAt: 'ASC' } });
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

    // Set reviewer reference using the same EM
    request.reviewedBy = ref(this.em.getReference(UserEntity, reviewedByUserId));

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

    // Set reviewer reference using the same EM
    request.reviewedBy = ref(this.em.getReference(UserEntity, reviewedByUserId));

    await this.em.flush();

    return request;
  }

  /**
   * Update Telegram message ID after sending notification
   *
   * @param requestId - Moderation request ID
   * @param chatId - Telegram chat ID
   * @param messageId - Telegram message ID (number from Telegram API)
   *
   * Note on type conversion (messageId: number → string):
   * - Telegram API returns message_id as number (JavaScript safe integer)
   * - Stored as TEXT in database to avoid integer overflow issues
   * - Telegram IDs can exceed PostgreSQL INTEGER range (2^31-1)
   * - Converting number → string at storage boundary maintains type safety
   * - This is the correct place for conversion (at the database layer)
   */
  async updateTelegramMessage(requestId: string, chatId: string, messageId: number): Promise<void> {
    const request = await this.findOne({ id: requestId });

    if (!request) {
      // Log warning but don't throw - this is not a critical error
      // The moderation request may have been deleted or already processed
      this.logger.warn(`Moderation request not found for Telegram message update: ${requestId}`);

      return;
    }

    request.telegramChatId = chatId;
    // Convert number to string for database storage (see method docs for rationale)
    request.telegramMessageId = messageId.toString();
    await this.em.flush();
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
