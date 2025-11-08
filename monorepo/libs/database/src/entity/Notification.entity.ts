import { Collection, Entity, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';
import type { NotificationTemplateEntity } from './NotificationTemplate.entity';
import type { UserEntity } from './User.entity';

export enum NotificationChannel {
  Bot = 'bot',
  Email = 'email',
  Push = 'push',
}

export enum NotificationTargetType {
  User = 'user',
  Chat = 'chat',
  Channel = 'channel',
  Group = 'group',
}

export enum NotificationPriority {
  Urgent = 400,
  High = 300,
  Normal = 200,
  Low = 100,
  Bulk = 50,
}

export enum NotificationStatus {
  Pending = 'pending',
  Processing = 'processing',
  Sent = 'sent',
  Failed = 'failed',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum NotificationErrorReason {
  UserBlocked = 'user_blocked',
  UserInactive = 'user_inactive',
  UserDeactivated = 'user_deactivated',
  BotBlocked = 'bot_blocked',
  ChatNotFound = 'chat_not_found',
  ChatRestricted = 'chat_restricted',
  InvalidTarget = 'invalid_target',
  TemplateNotFound = 'template_not_found',
  InvalidContent = 'invalid_content',
  RateLimitExceeded = 'rate_limit_exceeded',
  NetworkError = 'network_error',
  UnknownError = 'unknown_error',
}

export interface NotificationError {
  reason: NotificationErrorReason;
  message?: string;
  details?: Record<string, unknown>;
  timestamp?: Date;
}

export interface NotificationExtra {
  disableNotification?: boolean;
  disablePreview?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  messageThreadId?: number;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  [key: string]: unknown;
}

@Entity({ tableName: 'notifications' })
@Index({ name: 'ix__notifications__status', properties: ['status'] })
@Index({ name: 'ix__notifications__channel', properties: ['channel'] })
@Index({ name: 'ix__notifications__target_type', properties: ['targetType'] })
@Index({ name: 'ix__notifications__target_id', properties: ['targetId'] })
@Index({ name: 'ix__notifications__template_id', properties: ['templateId'] })
@Index({ name: 'ix__notifications__priority_status', properties: ['priority', 'status'] })
@Index({ name: 'ix__notifications__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__notifications__send_at', properties: ['sendAt'] })
@Index({
  name: 'ix__notifications__status_target_send_time',
  properties: ['status', 'targetType', 'sendTimeFrom', 'sendTimeTo'],
})
export class NotificationEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 32, fieldName: 'channel' })
  @Enum(() => NotificationChannel)
  channel!: NotificationChannel;

  @Property({ type: 'varchar', length: 32, fieldName: 'target_type' })
  @Enum(() => NotificationTargetType)
  targetType!: NotificationTargetType;

  @Property({ type: 'varchar', length: 255, fieldName: 'target_id' })
  targetId!: string;

  @ManyToOne('NotificationTemplateEntity', { nullable: true, fieldName: 'template_id' })
  template?: NotificationTemplateEntity;

  @Property({ type: 'uuid', nullable: true, fieldName: 'template_id' })
  templateId?: string;

  @Property({ type: 'varchar', length: 100, nullable: true, fieldName: 'template_code' })
  templateCode?: string;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'data' })
  data?: Record<string, unknown>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'extra' })
  extra?: NotificationExtra;

  @Property({ type: 'varchar', length: 32, fieldName: 'status', default: NotificationStatus.Pending })
  @Enum(() => NotificationStatus)
  status: NotificationStatus = NotificationStatus.Pending;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'error' })
  error?: NotificationError;

  @Property({ type: 'integer', fieldName: 'priority', default: NotificationPriority.Normal })
  priority: NotificationPriority = NotificationPriority.Normal;

  @Property({ type: 'integer', fieldName: 'retry_count', default: 0 })
  retryCount = 0;

  @Property({ type: 'integer', fieldName: 'max_retries', default: 3 })
  maxRetries = 3;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'send_at' })
  sendAt?: Date;

  @Property({ type: 'time', nullable: true, fieldName: 'send_time_from' })
  sendTimeFrom?: string;

  @Property({ type: 'time', nullable: true, fieldName: 'send_time_to' })
  sendTimeTo?: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'sent_at' })
  sentAt?: Date;

  @Property({ type: 'bigint', nullable: true, fieldName: 'message_id' })
  messageId?: string;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'locale' })
  locale?: string;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'metadata' })
  metadata?: Record<string, unknown>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      NotificationEntity,
      'id' | 'createdAt' | 'updatedAt',
      'status' | 'priority' | 'retryCount' | 'maxRetries'
    >,
  ) {
    Object.assign(this, data);
  }
}
