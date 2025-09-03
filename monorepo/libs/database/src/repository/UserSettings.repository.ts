import {EntityManager, EntityRepository} from '@mikro-orm/core';
import {SettingType, UserSettingsEntity} from '../entity/UserSettings.entity';
import {UserEntity} from '../entity/User.entity';

export class UserSettingsRepository extends EntityRepository<UserSettingsEntity> {
  constructor(em: EntityManager) {
    super(em, UserSettingsEntity);
  }

  async findByUser(user: UserEntity): Promise<UserSettingsEntity[]> {
    return this.find({ user, isActive: true });
  }

  async findByUserAndKey(user: UserEntity, key: string): Promise<UserSettingsEntity | null> {
    return this.findOne({ user, key, isActive: true });
  }

  async findByKey(key: string): Promise<UserSettingsEntity[]> {
    return this.find({ key, isActive: true }, { populate: ['user'] });
  }

  async getSetting<T = unknown>(user: UserEntity, key: string, defaultValue?: T): Promise<T> {
    const setting = await this.findByUserAndKey(user, key);
    return setting ? setting.getValue() : defaultValue;
  }

  async setSetting<T = unknown>(
    user: UserEntity,
    key: string,
    value: T,
    type: SettingType = SettingType.STRING,
    description?: string
  ): Promise<UserSettingsEntity> {
    let setting = await this.findByUserAndKey(user, key);

    if (!setting) {
      setting = new UserSettingsEntity({
        user,
        key,
        value: '',
        type
      });
      if (description) setting.description = description;
      this.em.persist(setting);
    }

    setting.setValue(value);
    setting.type = type;
    if (description) setting.description = description;

    await this.em.flush();
    return setting;
  }

  async updateSetting<T = unknown>(user: UserEntity, key: string, value: T): Promise<boolean> {
    const setting = await this.findByUserAndKey(user, key);
    if (setting) {
      setting.setValue(value);
      await this.em.flush();
      return true;
    }
    return false;
  }

  async deleteSetting(user: UserEntity, key: string): Promise<boolean> {
    const setting = await this.findByUserAndKey(user, key);
    if (setting) {
      setting.isActive = false;
      await this.em.flush();
      return true;
    }
    return false;
  }

  async getUserSettings(user: UserEntity): Promise<Record<string, unknown>> {
    const settings = await this.findByUser(user);
    const result: Record<string, unknown> = {};

    for (const setting of settings) {
      result[setting.key] = setting.getValue();
    }

    return result;
  }

  async getUserSettingsWithMetadata(user: UserEntity): Promise<Record<string, {
    value: unknown;
    type: SettingType;
    description?: string;
    updatedAt: Date;
  }>> {
    const settings = await this.findByUser(user);
    const result: Record<string, {
      value: unknown;
      type: SettingType;
      description?: string;
      updatedAt: Date;
    }> = {};

    for (const setting of settings) {
      result[setting.key] = {
        value: setting.getValue(),
        type: setting.type,
        description: setting.description,
        updatedAt: setting.updatedAt
      };
    }

    return result;
  }

  async setNotificationPreference(
    user: UserEntity,
    notificationType: string,
    enabled: boolean
  ): Promise<void> {
    await this.setSetting(
      user,
      `notifications.${notificationType}`,
      enabled,
      SettingType.BOOLEAN,
      `Enable/disable ${notificationType} notifications`
    );
  }

  async getNotificationPreferences(user: UserEntity): Promise<Record<string, boolean>> {
    const settings = await this.find({
      user,
      key: { $like: 'notifications.%' },
      isActive: true
    });

    const preferences: Record<string, boolean> = {};
    for (const setting of settings) {
      const notificationType = setting.key.replace('notifications.', '');
      preferences[notificationType] = setting.getValue();
    }

    return preferences;
  }

  async bulkSetSettings(
    user: UserEntity,
    settings: Record<string, { value: unknown; type?: SettingType; description?: string }>
  ): Promise<void> {
    for (const [key, config] of Object.entries(settings)) {
      await this.setSetting(
        user,
        key,
        config.value,
        config.type || SettingType.STRING,
        config.description
      );
    }
  }
}
