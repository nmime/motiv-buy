import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { UserEntity } from './User.entity';
import { EntityConstructorData } from "../type/entity-constructor.type";

export enum TrafficBuyerType {
  Channel = 'channel',
  Group = 'group',
  Bot = 'bot',
  WithChecking = 'with_checking'
}

@Entity()
export class TrafficBuyerEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Enum(() => TrafficBuyerType)
  type!: TrafficBuyerType;

  @Property({ nullable: true })
  @Index()
  telegramId?: string;

  @Property({ nullable: true })
  username?: string;

  @Property({ nullable: true })
  inviteLink?: string;

  @Property({ default: true })
  isActive!: boolean;

  @Property({ default: false })
  requiresApproval!: boolean;

  @Property({ nullable: true })
  pricePerMember?: number;

  @Property({ nullable: true })
  minMembers?: number;

  @Property({ nullable: true })
  maxMembers?: number;

  @Property({ nullable: true })
  config?: string; // JSON string for additional configuration

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  // Relations
  @ManyToOne(() => UserEntity, { nullable: true })
  managedBy?: UserEntity;

  @OneToMany(() => TrafficOrderEntity, order => order.trafficBuyer)
  orders? = new Collection<TrafficOrderEntity>(this);

  // 1:M relationship - One buyer manages many actions (across all their orders)
  // This is derived through orders -> actions relationship
  
  constructor(data: EntityConstructorData<TrafficBuyerEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    Object.assign(this, data);
  }
}
