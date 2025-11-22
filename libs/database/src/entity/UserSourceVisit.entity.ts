import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Ref } from '@mikro-orm/core';
import { PlatformType } from '../const';
import { assignEntityData, EntityConstructorData, UserSourceVisitPlatformData } from '../type';
import { UserEntity } from './User.entity';

@Entity({ tableName: 'user_source_visits' })
@Index({ name: 'ix__user_source_visits__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__user_source_visits__utm_source', properties: ['utmSource'] })
@Index({ name: 'ix__user_source_visits__utm_medium', properties: ['utmMedium'] })
@Index({ name: 'ix__user_source_visits__utm_campaign', properties: ['utmCampaign'] })
@Index({ name: 'ix__user_source_visits__platform_type', properties: ['platformType'] })
export class UserSourceVisitEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt!: Date;

  @Property({ type: 'varchar', length: 20, fieldName: 'platform_type' })
  @Enum(() => PlatformType)
  platformType!: PlatformType;

  @Property({ type: 'json', nullable: true, fieldName: 'platform_data' })
  platformData?: UserSourceVisitPlatformData;

  @Property({ type: 'text', nullable: true })
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

  @Property({ type: 'varchar', length: 10, nullable: true })
  language?: string;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'telegram_language' })
  telegramLanguage?: string;

  @Property({ type: 'varchar', length: 64, nullable: true })
  continent?: string;

  @Property({ type: 'varchar', length: 64, nullable: true })
  country?: string;

  @Property({ type: 'varchar', length: 128, nullable: true })
  city?: string;

  @Property({ type: 'inet', nullable: true })
  ip?: string;

  @Property({ type: 'boolean', default: false, fieldName: 'is_signup' })
  isSignup = false;

  @ManyToOne(() => UserEntity, { ref: true, nullable: false, joinColumn: 'user_id' })
  user!: Ref<UserEntity>;

  @ManyToOne(() => UserEntity, { ref: true, nullable: true, joinColumn: 'link_user_id' })
  linkUser?: Ref<UserEntity>;

  constructor(data: EntityConstructorData<UserSourceVisitEntity, 'id' | 'createdAt', 'isSignup', 'user' | 'linkUser'>) {
    assignEntityData(this as Record<string, unknown>, data, {
      userId: {
        field: 'user',
        entityClass: UserEntity,
        required: true,
      },
      linkUserId: {
        field: 'linkUser',
        entityClass: UserEntity,
        required: false,
      },
    });
  }
}
