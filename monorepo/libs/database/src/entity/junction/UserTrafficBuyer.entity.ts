import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import type { UserEntity } from '../User.entity';
import type { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { EntityConstructorData } from "../../type";

export enum UserTrafficBuyerRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Viewer = 'viewer',
  Editor = 'editor'
}


@Entity({ tableName: 'user_traffic_buyers' })
@Index({ name: 'ix__user_traffic_buyers__user_id', properties: ['userId'] })
@Index({ name: 'ix__user_traffic_buyers__buyer_id', properties: ['trafficBuyerId'] })
@Index({ name: 'ix__user_traffic_buyers__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_buyers__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_buyers__user_buyer', properties: ['userId', 'trafficBuyerId'] })
export class UserTrafficBuyerEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;


  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_buyer_id' })
  trafficBuyerId!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id' })
  user?: UserEntity;

  @ManyToOne('TrafficBuyerEntity', { nullable: false, joinColumn: 'traffic_buyer_id', referenceColumnName: 'id' })
  trafficBuyer?: TrafficBuyerEntity;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficBuyerRole)
  role!: UserTrafficBuyerRole;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'permissions' })
  permissions?: Record<string, any>;

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

  constructor(data: EntityConstructorData<UserTrafficBuyerEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'trafficBuyer' | 'assignedBy', 'isActive'>) {
    Object.assign(this, data);
  }
}
