import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { TrafficUserEntity } from '../TrafficUser.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";


@Entity()
@Unique({ properties: ['trafficBuyer', 'trafficUser'] })
export class TrafficBuyerUsersEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => TrafficBuyerEntity)
  @Index()
  trafficBuyer!: TrafficBuyerEntity;

  @ManyToOne(() => TrafficUserEntity)
  @Index()
  trafficUser!: TrafficUserEntity;

  @Property({ default: true })
  canView = true;

  @Property({ default: false })
  canContact = false;

  @Property({ default: false })
  isBlocked = false;

  @Property({ nullable: true })
  firstInteractionDate?: Date;

  @Property({ nullable: true })
  lastInteractionDate?: Date;

  @Property({ default: 0 })
  totalInteractions = 0;

  @Property({ default: 0 })
  totalOrdersShared = 0;

  @Property({ nullable: true })
  notes?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<TrafficBuyerUsersEntity, 'id' | 'createdAt' | 'updatedAt', 'canView' | 'canContact' | 'isBlocked' | 'totalInteractions' | 'totalOrdersShared'>) {
    Object.assign(this, data);
  }
}
