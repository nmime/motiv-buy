import { Entity, Property, ManyToOne, Index, PrimaryKey, Unique } from '@mikro-orm/core';
// Forward declaration for circular dependency resolution
declare class UserEntity { }
import { EntityConstructorData } from '../type';

@Entity({ tableName: 'user_last_auth' })
@Unique({ properties: ['user'] })
@Index({ name: 'ix__user_last_auth__user_id', properties: ['user'] })
export class UserLastAuthEntity {
  @PrimaryKey({ type: 'bigserial' })
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

  @ManyToOne('UserEntity', { fieldName: 'user_id' })
  user?: UserEntity;

  constructor(data: EntityConstructorData<UserLastAuthEntity, 'id' | 'createdAt' | 'updatedAt'>) {
    Object.assign(this, data);
  }
}
