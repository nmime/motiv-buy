import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Ref } from '@mikro-orm/core';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { TrafficUserEntity } from '../TrafficUser.entity';
import { EntityConstructorData, assignEntityData } from '../../type';

@Entity({ tableName: 'traffic_buyer_users' })
@Index({ name: 'ix__traffic_buyer_users__buyer_id', properties: ['trafficBuyer'] })
@Index({ name: 'ix__traffic_buyer_users__user_id', properties: ['trafficUser'] })
@Index({ name: 'ix__traffic_buyer_users__is_blocked', properties: ['isBlocked'] })
@Unique({ name: 'uq__traffic_buyer_users__buyer_user', properties: ['trafficBuyer', 'trafficUser'] })
export class TrafficBuyerUsersEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('TrafficBuyerEntity', {
    nullable: false,
    joinColumn: 'traffic_buyer_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficBuyer!: Ref<TrafficBuyerEntity>;

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
      TrafficBuyerUsersEntity,
      'id' | 'createdAt' | 'updatedAt',
      'canView' | 'canContact' | 'isBlocked' | 'totalInteractions' | 'totalOrdersShared',
      'trafficBuyer' | 'trafficUser'
    >,
  ) {
    assignEntityData(this, data, {
      trafficBuyerId: { field: 'trafficBuyer', entityClass: TrafficBuyerEntity, required: true },
      trafficUserId: { field: 'trafficUser', entityClass: TrafficUserEntity, required: true },
    });
  }
}
