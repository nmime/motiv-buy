import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";

export enum UserTrafficSourceRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Moderator = 'moderator',
  Operator = 'operator'
}


@Entity({ tableName: 'user_traffic_sources' })
@Index({ name: 'ix__user_traffic_sources__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_sources__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__user_traffic_sources__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_sources__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_sources__user_source', properties: ['user', 'trafficSource'] })
export class UserTrafficSourceEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => TrafficSourceEntity, { fieldName: 'traffic_source_id' })
  trafficSource!: TrafficSourceEntity;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficSourceRole)
  role!: UserTrafficSourceRole;

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

  constructor(data: EntityConstructorData<UserTrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive'>) {
    Object.assign(this, data);
  }
}
