import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { TrafficSourceEntity } from './TrafficSource.entity';
import { EntityConstructorData } from "../type/entity-constructor.type";

export enum TrafficUserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Banned = 'banned',
  Pending = 'pending'
}

@Entity()
export class TrafficUserEntity {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  @Index()
  telegramId!: string;

  @Property({ nullable: true })
  username?: string;

  @Property()
  firstName!: string;

  @Property({ nullable: true })
  lastName?: string;

  @Property({ default: 0 })
  totalOrdersParticipated = 0;

  @Property({ default: 0 })
  totalEarnings = 0;

  @Property({ default: 0 })
  completionRate = 0;

  @Property({ nullable: true })
  languageCode?: string;

  @Property({ default: true })
  isBot!: boolean;

  @Property({ default: true })
  canJoinGroups!: boolean;

  @Property({ default: false })
  canReceiveMessages!: boolean;

  @Property({ default: false })
  supportsInlineQueries!: boolean;

  @Enum(() => TrafficUserStatus)
  status: TrafficUserStatus = TrafficUserStatus.Active;

  @Property({ nullable: true })
  lastSeenAt?: Date;

  @Property()
  joinedAt: Date = new Date();

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToOne(() => TrafficSourceEntity)
  trafficSource!: TrafficSourceEntity;

  @OneToMany(() => TrafficOrderEntity, order => order.assignedTrafficUser)
  assignedOrders? = new Collection<TrafficOrderEntity>(this);

  constructor(data: EntityConstructorData<TrafficUserEntity, 'id' | 'createdAt' | 'updatedAt' | 'joinedAt', 'totalOrdersParticipated' | 'totalEarnings' | 'completionRate'>) {
    Object.assign(this, data);
  }
}
