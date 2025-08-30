import { Entity, PrimaryKey, Property, Collection, OneToMany, ManyToOne, Index, Enum } from '@mikro-orm/core';
import { TrafficOrderEntity } from './TrafficOrder.entity';
import { TrafficUserEntity } from './TrafficUser.entity';
import { UserEntity } from './User.entity';
import { EntityConstructorData } from "../type/entity-constructor.type";

export enum TrafficSourceType {
  Bot = 'bot',
  BotWithToken = 'bot_with_token'
}

@Entity()
export class TrafficSourceEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ nullable: true })
  description?: string;

  @Enum(() => TrafficSourceType)
  type!: TrafficSourceType;

  @Property({ nullable: true })
  botToken?: string;

  @Property({ nullable: true })
  botUsername?: string;

  @Property({ nullable: true })
  @Index()
  telegramId?: string;

  @Property({ default: true })
  isActive!: boolean;

  @Property({ nullable: true })
  config?: string; // JSON string for additional configuration

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  // Relations
  @ManyToOne(() => UserEntity, { nullable: true })
  managedBy?: UserEntity;

  @OneToMany(() => TrafficOrderEntity, order => order.trafficSource)
  orders? = new Collection<TrafficOrderEntity>(this);

  @OneToMany(() => TrafficUserEntity, user => user.trafficSource)
  trafficUsers? = new Collection<TrafficUserEntity>(this);

  // 1:M relationship - One source can have many actions
  @OneToMany(() => 'TrafficActionsEntity', 'trafficSource')
  actions? = new Collection<any>(this);

  constructor(data: EntityConstructorData<TrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    Object.assign(this, data);
  }
}
