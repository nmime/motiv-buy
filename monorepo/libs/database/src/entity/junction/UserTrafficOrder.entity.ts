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


@Entity()
@Unique({ properties: ['user', 'trafficOrder'] })
export class UserTrafficOrderEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @ManyToOne(() => TrafficOrderEntity)
  @Index()
  trafficOrder!: TrafficOrderEntity;

  @Enum(() => UserTrafficOrderRole)
  role!: UserTrafficOrderRole;

  @Property({ default: true })
  canEdit = true;

  @Property({ default: true })
  canView = true;

  @Property({ default: false })
  canApprove = false;

  @Property({ nullable: true })
  assignedAt?: Date;

  @Property({ nullable: true })
  assignedBy?: string; // User ID who assigned this access

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<UserTrafficOrderEntity, 'id' | 'createdAt' | 'updatedAt', 'canEdit' | 'canView' | 'canApprove'>) {
    Object.assign(this, data);
  }
}
