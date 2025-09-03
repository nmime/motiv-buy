import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficOrderEntity } from '../TrafficOrder.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";

export enum UserTrafficOrderRole {
  Creator = 'creator',
  Reviewer = 'reviewer',
  Manager = 'manager',
  Viewer = 'viewer'
}


@Entity({ tableName: 'user_traffic_orders' })
@Index({ name: 'ix__user_traffic_orders__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_orders__order_id', properties: ['trafficOrder'] })
@Index({ name: 'ix__user_traffic_orders__role', properties: ['role'] })
@Unique({ name: 'uq__user_traffic_orders__user_order', properties: ['user', 'trafficOrder'] })
export class UserTrafficOrderEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => TrafficOrderEntity, { fieldName: 'traffic_order_id' })
  trafficOrder!: TrafficOrderEntity;

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

  @Property({ type: 'uuid', nullable: true, fieldName: 'assigned_by' })
  assignedBy?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserTrafficOrderEntity, 'id' | 'createdAt' | 'updatedAt', 'canEdit' | 'canView' | 'canApprove'>) {
    Object.assign(this, data);
  }
}
