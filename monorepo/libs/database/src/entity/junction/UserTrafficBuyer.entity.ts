import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique, Enum, Ref } from '@mikro-orm/core';
import { UserEntity } from '../User.entity';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { EntityConstructorData, UserTrafficBuyerPermissions, assignEntityData } from '../../type';

export enum UserTrafficBuyerRole {
  Manager = 'manager',
  Administrator = 'administrator',
  Viewer = 'viewer',
  Editor = 'editor',
}

@Entity({ tableName: 'user_traffic_buyers' })
@Index({ name: 'ix__user_traffic_buyers__user_id', properties: ['user'] })
@Index({ name: 'ix__user_traffic_buyers__buyer_id', properties: ['trafficBuyer'] })
@Index({ name: 'ix__user_traffic_buyers__role', properties: ['role'] })
@Index({ name: 'ix__user_traffic_buyers__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_traffic_buyers__user_buyer', properties: ['user', 'trafficBuyer'] })
export class UserTrafficBuyerEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @ManyToOne('TrafficBuyerEntity', {
    nullable: false,
    joinColumn: 'traffic_buyer_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficBuyer!: Ref<TrafficBuyerEntity>;

  @Property({ type: 'varchar', length: 20, fieldName: 'role' })
  @Enum(() => UserTrafficBuyerRole)
  role!: UserTrafficBuyerRole;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'permissions' })
  permissions?: UserTrafficBuyerPermissions;

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
      UserTrafficBuyerEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isActive',
      'user' | 'trafficBuyer' | 'assignedBy'
    >,
  ) {
    assignEntityData(this, data, {
      userId: { field: 'user', entityClass: UserEntity, required: true },
      trafficBuyerId: { field: 'trafficBuyer', entityClass: TrafficBuyerEntity, required: true },
      assignedById: { field: 'assignedBy', entityClass: UserEntity, required: false },
    });
  }
}
