import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';
import { EntityConstructorData } from '../type';

export enum NotificationContentType {
  Text = 'text',
  Photo = 'photo',
  Video = 'video',
  Animation = 'animation',
  Document = 'document',
  Audio = 'audio',
  Voice = 'voice',
  Sticker = 'sticker',
  Poll = 'poll',
  Location = 'location',
  Contact = 'contact',
  Venue = 'venue',
  Dice = 'dice',
  Game = 'game',
  MediaGroup = 'media_group',
  Forward = 'forward',
}

export enum NotificationTemplateEngine {
  Eta = 'eta',
}

export interface NotificationButton {
  text: string;
  url?: string;
  callbackData?: string;
  webApp?: string;
  switchInlineQuery?: string;
  switchInlineQueryCurrentChat?: string;
  loginUrl?: string;
  [key: string]: unknown;
}

export interface NotificationMedia {
  type: NotificationContentType;
  url?: string;
  fileId?: string;
  caption?: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  [key: string]: unknown;
}

export interface ForwardConfig {
  chatId?: number | string;
  messageId?: number;
  fromChatId?: number | string;
}

export interface PollConfig {
  question: string;
  options: string[];
  isAnonymous?: boolean;
  type?: 'regular' | 'quiz';
  allowsMultipleAnswers?: boolean;
  correctOptionId?: number;
  explanation?: string;
}

export interface LocationConfig {
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number;
  livePeriod?: number;
  heading?: number;
  proximityAlertRadius?: number;
}

export interface ContactConfig {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  vcard?: string;
}

export interface VenueConfig {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  foursquareId?: string;
  foursquareType?: string;
}

@Entity({ tableName: 'notification_templates' })
@Index({ name: 'ix__notification_templates__code', properties: ['code'] })
@Index({ name: 'ix__notification_templates__content_type', properties: ['contentType'] })
@Index({ name: 'ix__notification_templates__is_active', properties: ['isActive'] })
export class NotificationTemplateEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'varchar', length: 100, unique: true, fieldName: 'code' })
  code!: string;

  @Property({ type: 'varchar', length: 255, nullable: true, fieldName: 'name' })
  name?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 32, fieldName: 'content_type', default: NotificationContentType.Text })
  @Enum(() => NotificationContentType)
  contentType: NotificationContentType = NotificationContentType.Text;

  @Property({
    type: 'varchar',
    length: 32,
    fieldName: 'template_engine',
    default: NotificationTemplateEngine.Eta,
  })
  @Enum(() => NotificationTemplateEngine)
  templateEngine: NotificationTemplateEngine = NotificationTemplateEngine.Eta;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'text' })
  text?: Record<string, string | string[]>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'media' })
  media?: Record<string, NotificationMedia | NotificationMedia[]>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'buttons' })
  buttons?: Record<string, NotificationButton[][] | NotificationButton[][][]>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'poll_config' })
  pollConfig?: Record<string, PollConfig>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'location_config' })
  locationConfig?: Record<string, LocationConfig>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'contact_config' })
  contactConfig?: Record<string, ContactConfig>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'venue_config' })
  venueConfig?: Record<string, VenueConfig>;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'forward_config' })
  forwardConfig?: ForwardConfig;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'extra_config' })
  extraConfig?: Record<string, unknown>;

  @Property({ type: 'boolean', fieldName: 'is_personal', default: false })
  isPersonal = false;

  @Property({ type: 'boolean', fieldName: 'is_active', default: true })
  isActive = true;

  @Property({ type: 'varchar', length: 10, nullable: true, fieldName: 'default_locale' })
  defaultLocale?: string;

  @Property({ type: 'jsonb', nullable: true, fieldName: 'variables' })
  variables?: Record<string, unknown>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      NotificationTemplateEntity,
      'id' | 'createdAt' | 'updatedAt',
      'contentType' | 'templateEngine' | 'isPersonal' | 'isActive'
    >,
  ) {
    Object.assign(this, data);
  }
}
