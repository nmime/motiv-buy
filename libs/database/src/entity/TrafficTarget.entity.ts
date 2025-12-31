import { Collection, Entity, Enum, Index, ManyToOne, OneToMany, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData, TrafficTargetConfig } from '../type';
import { UserEntity } from './User.entity';
import type { TrafficOrderTargetEntity } from './junction/TrafficOrderTarget.entity';

export enum TrafficTargetType {
  Channel = 'channel',
  Group = 'group',
  Bot = 'bot',
  WithChecking = 'with_checking',
}

export enum TrafficTargetStatus {
  Active = 'active', // Active and receiving traffic
  Inactive = 'inactive', // Inactive/disabled by owner
  PendingVerification = 'pending_verification', // Awaiting verification
  Suspended = 'suspended', // Suspended by moderation
  Deleted = 'deleted', // Soft-deleted by owner
}

@Entity({ tableName: 'traffic_targets' })
@Index({ name: 'ix__traffic_targets__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_targets__type', properties: ['type'] })
@Index({ name: 'ix__traffic_targets__status', properties: ['status'] })
export class TrafficTargetEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @Property({ type: 'varchar', length: 255, fieldName: 'name' })
  name!: string;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TrafficTargetType)
  type!: TrafficTargetType;

  @Property({ type: 'varchar', length: 30, fieldName: 'status', default: TrafficTargetStatus.Active })
  @Enum(() => TrafficTargetStatus)
  status!: TrafficTargetStatus;

  @Property({ type: 'bigint', nullable: true, fieldName: 'telegram_id' })
  telegramId?: string;

  @Property({ type: 'varchar', length: 32, nullable: true, fieldName: 'username' })
  username?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'invite_link' })
  inviteLink?: string;

  @Property({ type: 'boolean', default: false, fieldName: 'requires_approval' })
  requiresApproval!: boolean;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true, fieldName: 'price_per_member' })
  pricePerMember?: string;

  @Property({ type: 'integer', nullable: true, fieldName: 'min_members' })
  minMembers?: number;

  @Property({ type: 'integer', nullable: true, fieldName: 'max_members' })
  maxMembers?: number;

  @Property({ type: 'json', nullable: true, fieldName: 'config' })
  config?: TrafficTargetConfig;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'managed_by_id', referenceColumnName: 'id', ref: true })
  managedBy?: Ref<UserEntity>;

  /** Junction: Orders that target this destination (M:M via TrafficOrderTarget) */
  @OneToMany('TrafficOrderTargetEntity', 'trafficTarget')
  orderAssignments? = new Collection<TrafficOrderTargetEntity>(this);

  constructor(
    data: EntityConstructorData<TrafficTargetEntity, 'id' | 'createdAt' | 'updatedAt', 'requiresApproval', 'managedBy'>,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      managedById: {
        field: 'managedBy',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
