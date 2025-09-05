import { Entity, Property, ManyToOne, Index, PrimaryKey, Enum } from '@mikro-orm/core';
import { PlatformType } from '../const';
import { EntityConstructorData, UserSourceVisitPlatformData } from '../type';
import type { UserEntity } from './User.entity';

@Entity({ tableName: 'user_source_visits' })
@Index({ name: 'ix__user_source_visits__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__user_source_visits__utm_source', properties: ['utmSource'] })
@Index({ name: 'ix__user_source_visits__utm_medium', properties: ['utmMedium'] })
@Index({ name: 'ix__user_source_visits__utm_campaign', properties: ['utmCampaign'] })
@Index({ name: 'ix__user_source_visits__platform_type', properties: ['platformType'] })
export class UserSourceVisitEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 20, fieldName: 'platform_type' })
  @Enum(() => PlatformType)
  platformType!: PlatformType;

  @Property({ type: 'json', nullable: true, fieldName: 'platform_data' })
  platformData?: UserSourceVisitPlatformData;

  @Property({ type: 'text', nullable: true, fieldName: 'params' })
  params?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'utm_source' })
  utmSource?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'utm_medium' })
  utmMedium?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'utm_campaign' })
  utmCampaign?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'utm_content' })
  utmContent?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'link_type' })
  linkType?: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'link_code' })
  linkCode?: string;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'language' })
  language?: string;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'telegram_language' })
  telegramLanguage?: string;

  @Property({ type: 'varchar', length: 64, nullable: true, fieldName: 'continent' })
  continent?: string;

  @Property({ type: 'varchar', length: 64, nullable: true, fieldName: 'country' })
  country?: string;

  @Property({ type: 'varchar', length: 128, nullable: true, fieldName: 'city' })
  city?: string;

  @Property({ type: 'inet', nullable: true, fieldName: 'ip' })
  ip?: string;

  @Property({ type: 'boolean', default: false, fieldName: 'is_signup' })
  isSignup: boolean = false;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'uuid', nullable: true, fieldName: 'user_id' })
  userId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'link_user_id' })
  linkUserId?: string;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'user_id', referenceColumnName: 'id' })
  user?: UserEntity;

  @ManyToOne('UserEntity', { nullable: true, joinColumn: 'link_user_id', referenceColumnName: 'id' })
  linkUser?: UserEntity;

  constructor(data: EntityConstructorData<UserSourceVisitEntity, 'id' | 'createdAt'>) {
    Object.assign(this, data);
  }
}
