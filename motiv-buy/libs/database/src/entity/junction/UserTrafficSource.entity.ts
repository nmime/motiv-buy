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

// Junction table for M:N relationship between Users and TrafficSource
// One user can manage multiple traffic sources
// One traffic source can be managed by multiple users (team management)

@Entity()
@Unique({ properties: ['user', 'trafficSource'] })
export class UserTrafficSourceEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @ManyToOne(() => TrafficSourceEntity)
  @Index()
  trafficSource!: TrafficSourceEntity;

  @Enum(() => UserTrafficSourceRole)
  role!: UserTrafficSourceRole;

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

  constructor(data: EntityConstructorData<UserTrafficSourceEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive'>) {
    Object.assign(this, data);
  }
}
