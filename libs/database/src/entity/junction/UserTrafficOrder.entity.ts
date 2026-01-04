import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficOrderEntity } from '../TrafficOrder.entity';
import { assignEntityData, EntityConstructorData } from '../../type';

export enum UserTrafficOrderRole {
  Creator = 'creator',
  Reviewer = 'reviewer',
  Manager = 'manager',
  Viewer = 'viewer',
}

@Entity({ tableName: 'user_traffic_orders' })
@Index({ name: 'ix__user_traffic_orders__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_orders__order_id', properties: ['trafficOrder'] })
@Index({ name: 'ix__user_traffic_orders__role', properties: ['role'] })
@Unique({ name: 'uq__user_traffic_orders__user_order', properties: ['user', 'trafficOrder'] })
export class UserTrafficOrderEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne('TrafficOrderEntity', {
    nullable: false,
    joinColumn: 'traffic_order_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficOrder!: Ref<TrafficOrderEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficOrderRole)
  role!: UserTrafficOrderRole;

  @Property({ type: 'boolean', default: true, fieldName: 'can_edit' })
  canEdit = true;

  @Property({ type: 'boolean', default: true, fieldName: 'can_view' })
  canView = true;

  @Property({ type: 'boolean', default: false, fieldName: 'can_approve' })
  canApprove = false;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'assigned_at' })
  assignedAt?: Date;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'assigned_by_id', referenceColumnName: 'id', ref: true })
  assignedBy?: Ref<UserEntity>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      UserTrafficOrderEntity,
      'id' | 'createdAt' | 'updatedAt',
      'canEdit' | 'canView' | 'canApprove',
      'user' | 'trafficOrder' | 'assignedBy'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
      trafficOrderId: {
        field: 'trafficOrder',
        entityClass: TrafficOrderEntity,
        required: true,
      },
      assignedById: {
        field: 'assignedBy',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
