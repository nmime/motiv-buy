import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { assignEntityData, EntityConstructorData, UserTrafficPermissions } from '../../type';

export enum UserTrafficSourceRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Moderator = 'moderator',
  Operator = 'operator',
}

@Entity({ tableName: 'user_traffic_sources' })
@Index({ name: 'ix__user_traffic_sources__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_sources__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__user_traffic_sources__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_sources__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_sources__user_source', properties: ['user', 'trafficSource'] })
export class UserTrafficSourceEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficSourceRole)
  role!: UserTrafficSourceRole;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'permissions' })
  permissions?: UserTrafficPermissions;

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
      UserTrafficSourceEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isActive',
      'user' | 'trafficSource' | 'assignedBy'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
      trafficSourceId: {
        field: 'trafficSource',

        entityClass: TrafficSourceEntity,
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
