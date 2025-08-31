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


@Entity()
@Unique({ properties: ['user', 'trafficBuyer'] })
export class UserTrafficBuyerEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @ManyToOne(() => TrafficBuyerEntity)
  @Index()
  trafficBuyer!: TrafficBuyerEntity;

  @Enum(() => UserTrafficBuyerRole)
  role!: UserTrafficBuyerRole;

  @Property({ default: true })
  isActive = true;

  @Property({ nullable: true })
  permissions?: string; // JSON string for specific permissions

  @Property({ nullable: true })
  assignedAt?: Date;

  @Property({ nullable: true })
  assignedBy?: string; // User ID who assigned this role

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserTrafficBuyerEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive'>) {
    Object.assign(this, data);
  }
}
