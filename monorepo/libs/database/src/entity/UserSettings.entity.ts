import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique } from '@mikro-orm/core';
import { UserEntity } from './User.entity';

export enum SettingType {
  BOOLEAN = 'BOOLEAN',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  JSON = 'JSON'
}

export enum NotificationType {
  BALANCE_CHANGES = 'BALANCE_CHANGES',
  TRADE_NOTIFICATIONS = 'TRADE_NOTIFICATIONS',
  REFERRAL_NOTIFICATIONS = 'REFERRAL_NOTIFICATIONS',
  SYSTEM_NOTIFICATIONS = 'SYSTEM_NOTIFICATIONS',
  MARKETING_NOTIFICATIONS = 'MARKETING_NOTIFICATIONS'
}

@Entity()
@Unique({ properties: ['user', 'key'] })
export class UserSettingsEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => UserEntity)
  @Index()
  user!: UserEntity;

  @Property()
  @Index()
  key!: string;

  @Property({ type: 'text' })
  value!: string;

  @Property({ default: SettingType.STRING })
  type!: SettingType;

  @Property({ nullable: true })
  description?: string;

  @Property({ default: true })
  isActive!: boolean;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(user: UserEntity, key: string, value: string, type: SettingType = SettingType.STRING) {
    this.user = user;
    this.key = key;
    this.value = value;
    this.type = type;
  }

  getValue(): any {
    switch (this.type) {
      case SettingType.BOOLEAN:
        return this.value === 'true';
      case SettingType.NUMBER:
        return parseFloat(this.value);
      case SettingType.JSON:
        try {
          return JSON.parse(this.value);
        } catch {
          return null;
        }
      default:
        return this.value;
    }
  }

  setValue(value: any): void {
    switch (this.type) {
      case SettingType.BOOLEAN:
        this.value = Boolean(value).toString();
        break;
      case SettingType.NUMBER:
        this.value = Number(value).toString();
        break;
      case SettingType.JSON:
        this.value = JSON.stringify(value);
        break;
      default:
        this.value = String(value);
    }
  }
}
