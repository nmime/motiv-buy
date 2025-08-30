import { Entity, Property, ManyToOne, Index, PrimaryKey } from '@mikro-orm/core';
import { UserEntity } from './User.entity';

export enum PlatformType {
  TELEGRAM = 'telegram',
  WEB = 'web',
  MOBILE = 'mobile',
  BOT = 'bot',
  API = 'api',
}

export interface UserSourceVisitPlatformData {
  telegramVersion?: string;
  telegramPlatform?: string;
}

@Entity({ tableName: 'user_source_visits' })
@Index({ name: 'ix__user_source_visits__created_at', properties: ['createdAt'] })
@Index({ name: 'ix__user_source_visits__utm_source', properties: ['utmSource'] })
@Index({ name: 'ix__user_source_visits__utm_medium', properties: ['utmMedium'] })
@Index({ name: 'ix__user_source_visits__utm_campaign', properties: ['utmCampaign'] })
@Index({ name: 'ix__user_source_visits__utm_content', properties: ['utmContent'] })
export class UserSourceVisitEntity {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @Property({ type: 'bigint', columnType: 'bigint unsigned' })
  userId!: string;

  @Property()
  platformType!: PlatformType;

  @Property({ type: 'json', nullable: true })
  platformData?: UserSourceVisitPlatformData | null;

  @Property({ type: 'text', nullable: true })
  params?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  utmSource?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  utmMedium?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  utmCampaign?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  utmContent?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  linkType?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  linkCode?: string | null;

  @Property({ type: 'bigint', columnType: 'bigint unsigned', nullable: true })
  linkUserId?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  language?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  telegramLanguage?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  continent?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  country?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  city?: string | null;

  @Property({ type: 'string', length: 255, nullable: true })
  ip?: string | null;

  @Property({ type: 'boolean', default: false })
  isSignup: boolean = false;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @ManyToOne(() => UserEntity, { nullable: true, fieldName: 'user_id' })
  user?: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, fieldName: 'link_user_id' })
  linkUser?: UserEntity;

  constructor(data?: Partial<UserSourceVisitEntity>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}