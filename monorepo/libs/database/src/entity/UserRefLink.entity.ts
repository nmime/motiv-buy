import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Enum, Ref } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { UserEntity } from './User.entity';

export enum UserRefLinkType {
  Promo = 'promo',
  User = 'user',
}

export enum UserRefPercentLevel1 {
  Default = '10',
}

export enum UserRefPercentLevel2 {
  Default = '1',
}

export enum UserRefPercentLevel3 {
  Default = '0',
}

@Entity({ tableName: 'user_ref_links' })
@Index({ name: 'ix__user_ref_links__ref_code', properties: ['refCode'] })
@Index({ name: 'ix__user_ref_links__user_id', properties: ['user'] })
@Unique({ name: 'uq__user_ref_links__ref_code_ref_code_unique_key', properties: ['refCode', 'refCodeUniqueKey'] })
@Unique({ name: 'uq__user_ref_links__default_default_unique_key', properties: ['isDefault', 'defaultUniqueKey'] })
export class UserRefLinkEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 50, fieldName: 'type' })
  @Enum(() => UserRefLinkType)
  type!: UserRefLinkType;

  @Property({ type: 'varchar', length: 50, nullable: true, fieldName: 'source_type' })
  sourceType?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'source_id' })
  sourceId?: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @Property({ type: 'varchar', length: 50, fieldName: 'ref_code' })
  refCode!: string;

  @Property({ type: 'varchar', length: 100, fieldName: 'ref_code_unique_key' })
  refCodeUniqueKey!: string;

  @Property({ type: 'varchar', length: 100, fieldName: 'default_unique_key' })
  defaultUniqueKey!: string;

  @Property({ type: 'decimal', precision: 5, scale: 2, fieldName: 'ref_percent_level_1' })
  refPercentLevel1!: string;

  @Property({ type: 'decimal', precision: 5, scale: 2, fieldName: 'ref_percent_level_2' })
  refPercentLevel2!: string;

  @Property({ type: 'decimal', precision: 5, scale: 2, fieldName: 'ref_percent_level_3' })
  refPercentLevel3!: string;

  @Property({ type: 'boolean', default: false, fieldName: 'is_default' })
  isDefault!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'is_custom' })
  isCustom!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'is_deleted' })
  isDeleted!: boolean;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  static level1ToLevel2RefPercent(level1RefPercent: string | number): string {
    const num = typeof level1RefPercent === 'string' ? parseFloat(level1RefPercent) : level1RefPercent;

    return (num / 10).toString();
  }

  constructor(
    data: EntityConstructorData<
      UserRefLinkEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isDefault' | 'isCustom' | 'isDeleted',
      'user'
    >,
  ) {
    assignEntityData(this, data, {
      userId: { field: 'user', entityClass: UserEntity, required: true },
    });
  }
}
