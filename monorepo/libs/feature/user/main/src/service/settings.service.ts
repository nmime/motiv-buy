import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserSettingsEntity, SettingType } from '@app/database';
import { UpdateSettingsDto, UserSettingsResponseDto, ThemePreference } from '../dto';

/**
 * Settings Service
 * Manages user preference settings with key-value storage
 */
@Injectable()
export class SettingsService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get all settings for a user
   */
  async getSettings(userId: string): Promise<UserSettingsResponseDto> {
    const em = this.em.fork();
    const settings = await em.find(UserSettingsEntity, { user: userId });

    const settingsMap = new Map<string, unknown>();
    for (const setting of settings) {
      settingsMap.set(setting.key, setting.getValue());
    }

    return {
      language: (settingsMap.get('language') as string) ?? 'en',
      theme: (settingsMap.get('theme') as ThemePreference) ?? ThemePreference.Auto,
      showBalance: (settingsMap.get('showBalance') as boolean) ?? true,
      showReferrals: (settingsMap.get('showReferrals') as boolean) ?? true,
      enableNotifications: (settingsMap.get('enableNotifications') as boolean) ?? true,
    };
  }

  /**
   * Update user settings
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettingsResponseDto> {
    const em = this.em.fork();

    const updates: Array<{ key: string; value: unknown; type: SettingType }> = [];

    if (dto.language !== undefined) {
      updates.push({ key: 'language', value: dto.language, type: SettingType.String });
    }

    if (dto.theme !== undefined) {
      updates.push({ key: 'theme', value: dto.theme, type: SettingType.String });
    }

    if (dto.showBalance !== undefined) {
      updates.push({ key: 'showBalance', value: dto.showBalance, type: SettingType.Boolean });
    }

    if (dto.showReferrals !== undefined) {
      updates.push({ key: 'showReferrals', value: dto.showReferrals, type: SettingType.Boolean });
    }

    if (dto.enableNotifications !== undefined) {
      updates.push({ key: 'enableNotifications', value: dto.enableNotifications, type: SettingType.Boolean });
    }

    for (const update of updates) {
      const existing = await em.findOne(UserSettingsEntity, {
        user: userId,
        key: update.key,
      });

      if (existing) {
        existing.setValue(update.value);
        existing.type = update.type;
        em.persist(existing);
      } else {
        const newSetting = new UserSettingsEntity({
          userId,
          key: update.key,
          value: String(update.value),
          type: update.type,
        });
        newSetting.setValue(update.value);
        em.persist(newSetting);
      }
    }

    await em.flush();

    return this.getSettings(userId);
  }
}
