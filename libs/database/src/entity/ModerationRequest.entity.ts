import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { UserEntity } from './User.entity';

export enum ModerationEntityType {
  TrafficSource = 'traffic_source',
  TrafficOrder = 'traffic_order',
}

export enum ModerationStatus {
  Pending = 'pending',
  Approved = 'approved',
  Declined = 'declined',
}

/**
 * Moderation Request Entity
 * Tracks approval workflow for traffic sources and orders via Telegram channel
 */
@Entity({ tableName: 'moderation_requests' })
@Index({ name: 'ix__moderation_requests__status', properties: ['status'] })
@Index({ name: 'ix__moderation_requests__entity_type_id', properties: ['entityType', 'entityId'] })
@Index({ name: 'ix__moderation_requests__telegram_message', properties: ['telegramChatId', 'telegramMessageId'] })
@Index({ name: 'ix__moderation_requests__created_at', properties: ['createdAt'] })
export class ModerationRequestEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'entity_type' })
  @Enum(() => ModerationEntityType)
  entityType!: ModerationEntityType;

  @Property({ type: 'uuid', fieldName: 'entity_id' })
  entityId!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'status' })
  @Enum(() => ModerationStatus)
  status!: ModerationStatus;

  @Property({ type: 'text', nullable: true, fieldName: 'telegram_message_id' })
  telegramMessageId?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'telegram_chat_id' })
  telegramChatId?: string;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'reviewed_by_id', referenceColumnName: 'id', ref: true })
  reviewedBy?: Ref<UserEntity>;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'reviewed_at' })
  reviewedAt?: Date;

  @Property({ type: 'text', nullable: true, fieldName: 'review_note' })
  reviewNote?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<ModerationRequestEntity, 'id' | 'createdAt' | 'updatedAt', 'status', 'reviewedBy'>,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      reviewedById: {
        field: 'reviewedBy',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
