import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import type { UserEntity } from '../User.entity';
import type { TrafficSourceEntity } from '../TrafficSource.entity';
import { EntityConstructorData } from "../../type";

export enum UserTrafficSourceRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Moderator = 'moderator',
  Operator = 'operator'
}


@Entity({ tableName: 'user_traffic_sources' })
@Index({ name: 'ix__user_traffic_sources__user_id', properties: ['userId'] })
@Index({ name: 'ix__user_traffic_sources__source_id', properties: ['trafficSourceId'] })
@Index({ name: 'ix__user_traffic_sources__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_sources__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_sources__user_source', properties: ['userId', 'trafficSourceId'] })
export class UserTrafficSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_source_id' })
  trafficSourceId!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id' })
  user?: UserEntity;

  @ManyToOne('TrafficSourceEntity', { nullable: false, joinColumn: 'traffic_source_id', referenceColumnName: 'id' })
  trafficSource?: TrafficSourceEntity;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficSourceRole)
  role!: UserTrafficSourceRole;

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

  constructor(data: EntityConstructorData<UserTrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'trafficSource' | 'assignedBy', 'isActive'>) {
    Object.assign(this, data);
  }
}
