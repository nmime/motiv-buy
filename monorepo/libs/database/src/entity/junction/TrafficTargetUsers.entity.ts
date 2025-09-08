import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Ref } from '@mikro-orm/core';
import { TrafficTargetEntity } from '../TrafficTarget.entity';
import { TrafficUserEntity } from '../TrafficUser.entity';
import { EntityConstructorData, assignEntityData } from '../../type';

@Entity({ tableName: 'traffic_target_users' })
@Index({ name: 'ix__traffic_target_users__target_id', properties: ['trafficTarget'] })
@Index({ name: 'ix__traffic_target_users__user_id', properties: ['trafficUser'] })
@Index({ name: 'ix__traffic_target_users__is_blocked', properties: ['isBlocked'] })
@Unique({ name: 'uq__traffic_target_users__target_user', properties: ['trafficTarget', 'trafficUser'] })
export class TrafficTargetUsersEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('TrafficTargetEntity', {
    nullable: false,
    joinColumn: 'traffic_target_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficTarget!: Ref<TrafficTargetEntity>;

  @ManyToOne('TrafficUserEntity', {
    nullable: false,
    joinColumn: 'traffic_user_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficUser!: Ref<TrafficUserEntity>;

  @Property({ type: 'boolean', default: true, fieldName: 'can_view' })
  canView = true;

  @Property({ type: 'boolean', default: false, fieldName: 'can_contact' })
  canContact = false;

  @Property({ type: 'boolean', default: false, fieldName: 'is_blocked' })
  isBlocked = false;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'first_interaction_date' })
  firstInteractionDate?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_interaction_date' })
  lastInteractionDate?: Date;

  @Property({ type: 'integer', default: 0, fieldName: 'total_interactions' })
  totalInteractions = 0;

  @Property({ type: 'integer', default: 0, fieldName: 'total_orders_shared' })
  totalOrdersShared = 0;

  @Property({ type: 'text', nullable: true, fieldName: 'notes' })
  notes?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      TrafficTargetUsersEntity,
      'id' | 'createdAt' | 'updatedAt',
      'canView' | 'canContact' | 'isBlocked' | 'totalInteractions' | 'totalOrdersShared',
      'trafficTarget' | 'trafficUser'
    >,
  ) {
    assignEntityData(this, data, {
      trafficTargetId: { field: 'trafficTarget', entityClass: TrafficTargetEntity, required: true },
      trafficUserId: { field: 'trafficUser', entityClass: TrafficUserEntity, required: true },
    });
  }
}
