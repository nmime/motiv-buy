import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { TrafficActionsEntity } from '../TrafficActions.entity';
import { TrafficUserEntity } from '../TrafficUser.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";


@Entity({ tableName: 'traffic_actions_users' })
@Index({ name: 'ix__traffic_actions_users__action_id', properties: ['trafficAction'] })
@Index({ name: 'ix__traffic_actions_users__user_id', properties: ['trafficUser'] })
@Index({ name: 'ix__traffic_actions_users__is_completed', properties: ['isCompleted'] })
@Unique({ name: 'uq__traffic_actions_users__action_user', properties: ['trafficAction', 'trafficUser'] })
export class TrafficActionsUsersEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @ManyToOne(() => TrafficActionsEntity, { fieldName: 'traffic_action_id' })
  trafficAction!: TrafficActionsEntity;

  @ManyToOne(() => TrafficUserEntity, { fieldName: 'traffic_user_id' })
  trafficUser!: TrafficUserEntity;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'participation_date' })
  participationDate?: Date;

  @Property({ type: 'boolean', default: false, fieldName: 'is_completed' })
  isCompleted = false;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true, fieldName: 'reward' })
  reward?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'notes' })
  notes?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<TrafficActionsUsersEntity, 'id' | 'createdAt' | 'updatedAt', 'isCompleted'>) {
    Object.assign(this, data);
  }
}
