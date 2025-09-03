import { Entity, Property, ManyToOne, Index, PrimaryKey } from '@mikro-orm/core';

export enum PlatformType {
  Telegram = 'telegram',
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

  @Property()
  platformType!: PlatformType;

  @Property({ type: 'json', nullable: true })
  platformData?: UserSourceVisitPlatformData;

  @Property({ type: 'text', nullable: true })
  params?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  utmSource?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  utmMedium?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  utmCampaign?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  utmContent?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  linkType?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  linkCode?: string;


  @Property({ type: 'string', length: 255, nullable: true })
  language?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  telegramLanguage?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  continent?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  country?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  city?: string;

  @Property({ type: 'string', length: 255, nullable: true })
  ip?: string;

  @Property({ type: 'boolean', default: false })
  isSignup: boolean = false;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date = new Date();

  @ManyToOne(() => 'UserEntity', { nullable: true, fieldName: 'user_id' })
  user?: any;

  @ManyToOne(() => 'UserEntity', { nullable: true, fieldName: 'link_user_id' })
  linkUser?: any;

  constructor(data?: Partial<UserSourceVisitEntity>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
