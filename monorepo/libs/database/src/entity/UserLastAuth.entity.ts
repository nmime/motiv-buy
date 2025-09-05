import { Entity, Property, ManyToOne, Index, PrimaryKey, Unique } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';
import type { UserEntity } from './User.entity';

@Entity({ tableName: 'user_last_auth' })
@Unique({ properties: ['user'] })
@Index({ name: 'ix__user_last_auth__user_id', properties: ['user'] })
export class UserLastAuthEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'inet', nullable: true })
  ip?: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  country?: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  city?: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  continent?: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @Property({ type: 'uuid', fieldName: 'user_id' })
  userId!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id' })
  user?: UserEntity;

  constructor(data: EntityConstructorData<UserLastAuthEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    Object.assign(this, data);
  }
}
