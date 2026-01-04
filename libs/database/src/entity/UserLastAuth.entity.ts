import { Entity, Index, OneToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../type';
import { UserEntity } from './User.entity';

@Entity({ tableName: 'user_last_auth' })
@Unique({ properties: ['user'] })
@Index({ name: 'ix__user_last_auth__user_id', properties: ['user'] })
export class UserLastAuthEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
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

  @OneToOne('UserEntity', { nullable: false, owner: true, joinColumn: 'user_id', ref: true })
  user!: Ref<UserEntity>;

  constructor(data: EntityConstructorData<UserLastAuthEntity, 'id' | 'createdAt' | 'updatedAt', never, 'user'>) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
    });
  }
}
