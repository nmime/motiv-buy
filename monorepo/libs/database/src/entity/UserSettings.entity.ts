import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique, Enum, Ref } from '@mikro-orm/core';
import { EntityConstructorData, assignEntityData } from '../type';
import { UserEntity } from './User.entity';

export enum SettingType {
  Boolean = 'boolean',
  String = 'string',
  Number = 'number',
  Json = 'json',
}

export enum NotificationType {
  BalanceChanges = 'balance_changes',
  TradeNotifications = 'trade_notifications',
  ReferralNotifications = 'referral_notifications',
  SystemNotifications = 'system_notifications',
  MarketingNotifications = 'marketing_notifications',
}

@Entity({ tableName: 'user_settings' })
@Index({ name: 'ix__user_settings__user_id', properties: ['user'] })
@Index({ name: 'ix__user_settings__key', properties: ['key'] })
@Index({ name: 'ix__user_settings__is_active', properties: ['isActive'] })
@Unique({ name: 'uq__user_settings__user_key', properties: ['user', 'key'] })
export class UserSettingsEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @ManyToOne('UserEntity', { nullable: false, joinColumn: 'user_id', referenceColumnName: 'id', ref: true })
  user!: Ref<UserEntity>;

  @Property({ type: 'varchar', length: 64, fieldName: 'key' })
  key!: string;

  @Property({ type: 'text', fieldName: 'value' })
  value!: string;

  @Property({ type: 'varchar', length: 10, default: SettingType.String, fieldName: 'type' })
  @Enum(() => SettingType)
  type!: SettingType;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(
    data: EntityConstructorData<
      UserSettingsEntity,
      'id' | 'createdAt' | 'updatedAt' | 'getValue' | 'setValue',
      'type' | 'isActive',
      'user'
    >,
  ) {
    assignEntityData(this, data, {
      userId: { field: 'user', entityClass: UserEntity, required: true },
    });
  }

  getValue(): unknown {
    switch (this.type) {
      case SettingType.Boolean:
        return this.value === 'true';
      case SettingType.Number:
        return parseFloat(this.value);
      case SettingType.Json:
        try {
          return JSON.parse(this.value);
        } catch {
          return null;
        }
      default:
        return this.value;
    }
  }

  setValue(value: unknown): void {
    switch (this.type) {
      case SettingType.Boolean:
        this.value = Boolean(value).toString();
        break;
      case SettingType.Number:
        this.value = Number(value).toString();
        break;
      case SettingType.Json:
        this.value = JSON.stringify(value);
        break;
      default:
        this.value = String(value);
    }
  }
}
