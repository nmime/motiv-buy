import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";

export enum UserTrafficBuyerRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Viewer = 'viewer',
  Editor = 'editor'
}


@Entity({ tableName: 'user_traffic_buyers' })
@Index({ name: 'ix__user_traffic_buyers__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_buyers__buyer_id', properties: ['trafficBuyer'] })
@Index({ name: 'ix__user_traffic_buyers__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_buyers__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_buyers__user_buyer', properties: ['user', 'trafficBuyer'] })
export class UserTrafficBuyerEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => TrafficBuyerEntity, { fieldName: 'traffic_buyer_id' })
  trafficBuyer!: TrafficBuyerEntity;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficBuyerRole)
  role!: UserTrafficBuyerRole;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'permissions' })
  permissions?: Record<string, any>;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'assigned_at' })
  assignedAt?: Date;

  @Property({ type: 'uuid', nullable: true, fieldName: 'assigned_by' })
  assignedBy?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserTrafficBuyerEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive'>) {
    Object.assign(this, data);
  }
}
