import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { TrafficActionsEntity } from '../TrafficActions.entity';
import { TrafficUserEntity } from '../TrafficUser.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";

// Junction table for M:N relationship between TrafficActions and TrafficUsers
// One action can involve multiple traffic_users
// One traffic_user can participate in multiple actions

@Entity()
@Unique({ properties: ['trafficAction', 'trafficUser'] })
export class TrafficActionsUsersEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => TrafficActionsEntity)
  @Index()
  trafficAction!: TrafficActionsEntity;

  @ManyToOne(() => TrafficUserEntity)
  @Index()
  trafficUser!: TrafficUserEntity;

  @Property({ nullable: true })
  participationDate?: Date;

  @Property({ default: false })
  isCompleted = false;

  @Property({ nullable: true })
  completedAt?: Date;

  @Property({ nullable: true })
  reward?: number;

  @Property({ nullable: true })
  notes?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<TrafficActionsUsersEntity, 'id' | 'createdAt' | 'updatedAt', 'isCompleted'>) {
    Object.assign(this, data);
  }
}
