import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum, Ref } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficTargetEntity } from '../TrafficTarget.entity';
import {
  EntityConstructorData,
  UserTrafficTargetPermissions,
  assignEntityData,
} from '../../type';

export enum UserTrafficTargetRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Viewer = 'viewer',
  Editor = 'editor',
}

@Entity({ tableName: 'user_traffic_targets' })
@Index({ name: 'ix__user_traffic_targets__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_targets__target_id', properties: ['trafficTarget'] })
@Index({ name: 'ix__user_traffic_targets__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_targets__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_targets__user_target', properties: ['user', 'trafficTarget'] })
export class UserTrafficTargetEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne('TrafficTargetEntity', {
    nullable: false,
    joinColumn: 'traffic_target_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficTarget!: Ref<TrafficTargetEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficTargetRole)
  role!: UserTrafficTargetRole;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'permissions' })
  permissions?: UserTrafficTargetPermissions;

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
      UserTrafficTargetEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isActive',
      'user' | 'trafficTarget' | 'assignedBy'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
      trafficTargetId: {
        field: 'trafficTarget',

        entityClass: TrafficTargetEntity,
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
