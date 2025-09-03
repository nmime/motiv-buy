import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from "../type/entity-constructor.type";
import { UserEntity } from './User.entity';
import { TrafficOrderEntity } from './TrafficOrder.entity';

export enum TrafficBuyerType {
  Channel = 'channel',
  Group = 'group',
  Bot = 'bot',
  WithChecking = 'with_checking'
}

@Entity({ tableName: 'traffic_buyers' })
@Index({ name: 'ix__traffic_buyers__telegram_id', properties: ['telegramId'] })
@Index({ name: 'ix__traffic_buyers__type', properties: ['type'] })
@Index({ name: 'ix__traffic_buyers__is_active', properties: ['isActive'] })
export class TrafficBuyerEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @Property({ type: 'varchar', length: 255, fieldName: 'name' })
  name!: string;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'type' })
  @Enum(() => TrafficBuyerType)
  type!: TrafficBuyerType;

  @Property({ type: 'bigint', nullable: true, fieldName: 'telegram_id' })
  telegramId?: string;

  @Property({ type: 'varchar', length: 32, nullable: true, fieldName: 'username' })
  username?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'invite_link' })
  inviteLink?: string;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'requires_approval' })
  requiresApproval!: boolean;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true, fieldName: 'price_per_member' })
  pricePerMember?: string;

  @Property({ type: 'integer', nullable: true, fieldName: 'min_members' })
  minMembers?: number;

  @Property({ type: 'integer', nullable: true, fieldName: 'max_members' })
  maxMembers?: number;

  @Property({ type: 'json', nullable: true, fieldName: 'config' })
  config?: Record<string, any>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @ManyToOne(() => UserEntity, { nullable: true })
  managedBy?: UserEntity;

  @OneToMany(() => TrafficOrderEntity, 'trafficBuyer')
  orders = new Collection<TrafficOrderEntity>(this);

  
  constructor(data: EntityConstructorData<TrafficBuyerEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    Object.assign(this, data);
  }
}
