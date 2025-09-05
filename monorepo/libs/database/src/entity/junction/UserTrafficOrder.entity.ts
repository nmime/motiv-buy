import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import type { UserEntity } from '../User.entity';
import type { TrafficOrderEntity } from '../TrafficOrder.entity';
import { EntityConstructorData } from "../../type";

export enum UserTrafficOrderRole {
  Creator = 'creator',
  Reviewer = 'reviewer',
  Manager = 'manager',
  Viewer = 'viewer'
}


@Entity({ tableName: 'user_traffic_orders' })
@Index({ name: 'ix__user_traffic_orders__user_id', properties: ['userId'] })
@Index({ name: 'ix__user_traffic_orders__order_id', properties: ['trafficOrderId'] })
@Index({ name: 'ix__user_traffic_orders__role', properties: ['role'] })
@Unique({ name: 'uq__user_traffic_orders__user_order', properties: ['userId', 'trafficOrderId'] })
export class UserTrafficOrderEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;


  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_order_id' })
  trafficOrderId!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id' })
  user?: UserEntity;

  @ManyToOne('TrafficOrderEntity', { nullable: false, joinColumn: 'traffic_order_id', referenceColumnName: 'id' })
  trafficOrder?: TrafficOrderEntity;

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

  @Property({ type: 'uuid', nullable: true, fieldName: 'assigned_by_id' })
  assignedById?: string;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'assigned_by_id', referenceColumnName: 'id' })
  assignedBy?: UserEntity;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserTrafficOrderEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'trafficOrder' | 'assignedBy', 'canEdit' | 'canView' | 'canApprove'>) {
    Object.assign(this, data);
  }
}
