import { EntityManager } from '@mikro-orm/core';
import { DatabaseService } from './database.service';
import { UserEntity } from '../entities';
import { UserBalanceEntity, CurrencyType } from '../entities';
import { UserBalanceHistoryEntity, TransactionType, TransactionStatus } from '../entities';
import { UserSettingsEntity, SettingType } from '../entities';

export interface LegacyUser {
  telegramId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  isPremium?: boolean;
  languageCode?: string;
  referredBy?: string;
  referralCount?: number;
  createdAt?: Date;
  lastActiveAt?: Date;
}

export interface LegacyUserBalance {
  telegramId: string;
  currency: string;
  balance: string;
  lockedBalance?: string;
}

export interface LegacyUserSettings {
  telegramId: string;
  key: string;
  value: string;
  type?: string;
}

export class MigrationService {
  private em: EntityManager;

  constructor(databaseService: DatabaseService) {
    this.em = databaseService.getEntityManager();
  }

  async migrateUsers(legacyUsers: LegacyUser[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const legacyUser of legacyUsers) {
      try {
        // Check if user already exists
        const existingUser = await this.em.findOne(UserEntity, { telegramId: legacyUser.telegramId });
        if (existingUser) {
          console.log(`User ${legacyUser.telegramId} already exists, skipping...`);
          continue;
        }

        const user = new UserEntity({
          telegramId: legacyUser.telegramId,
          username: legacyUser.username,
          firstName: legacyUser.firstName || 'Unknown',
          lastName: legacyUser.lastName,
          phone: legacyUser.phone,
          isActive: legacyUser.isActive ?? true,
          isPremium: legacyUser.isPremium ?? false,
          languageCode: legacyUser.languageCode,
          referredBy: legacyUser.referredBy
        });
        
        if (legacyUser.referralCount !== undefined) user.referralCount = legacyUser.referralCount;
        if (legacyUser.createdAt) user.createdAt = legacyUser.createdAt;
        if (legacyUser.lastActiveAt) user.lastActiveAt = legacyUser.lastActiveAt;

        this.em.persist(user);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to migrate user ${legacyUser.telegramId}: ${error}`);
      }
    }

    await this.em.flush();
    return { success, failed, errors };
  }

  async migrateUserBalances(legacyBalances: LegacyUserBalance[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const legacyBalance of legacyBalances) {
      try {
        const user = await this.em.findOne(UserEntity, { telegramId: legacyBalance.telegramId });
        if (!user) {
          errors.push(`User ${legacyBalance.telegramId} not found for balance migration`);
          failed++;
          continue;
        }

        // Validate currency
        const currency = legacyBalance.currency.toUpperCase() as CurrencyType;
        if (!Object.values(CurrencyType).includes(currency)) {
          errors.push(`Invalid currency ${legacyBalance.currency} for user ${legacyBalance.telegramId}`);
          failed++;
          continue;
        }

        // Check if balance already exists
        const existingBalance = await this.em.findOne(UserBalanceEntity, { user, currency });
        if (existingBalance) {
          console.log(`Balance for user ${legacyBalance.telegramId} and currency ${currency} already exists, skipping...`);
          continue;
        }

        const userBalance = new UserBalanceEntity(user, currency, legacyBalance.balance);
        if (legacyBalance.lockedBalance) {
          userBalance.lockedBalance = legacyBalance.lockedBalance;
        }

        this.em.persist(userBalance);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to migrate balance for user ${legacyBalance.telegramId}: ${error}`);
      }
    }

    await this.em.flush();
    return { success, failed, errors };
  }

  async migrateUserSettings(legacySettings: LegacyUserSettings[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const legacySetting of legacySettings) {
      try {
        const user = await this.em.findOne(UserEntity, { telegramId: legacySetting.telegramId });
        if (!user) {
          errors.push(`User ${legacySetting.telegramId} not found for setting migration`);
          failed++;
          continue;
        }

        // Check if setting already exists
        const existingSetting = await this.em.findOne(UserSettingsEntity, {
          user, 
          key: legacySetting.key 
        });
        if (existingSetting) {
          console.log(`Setting ${legacySetting.key} for user ${legacySetting.telegramId} already exists, skipping...`);
          continue;
        }

        // Determine setting type
        let settingType = SettingType.STRING;
        if (legacySetting.type) {
          switch (legacySetting.type.toUpperCase()) {
            case 'BOOLEAN':
              settingType = SettingType.BOOLEAN;
              break;
            case 'NUMBER':
              settingType = SettingType.NUMBER;
              break;
            case 'JSON':
              settingType = SettingType.JSON;
              break;
          }
        }

        const userSetting = new UserSettingsEntity(user, legacySetting.key, legacySetting.value, settingType);
        this.em.persist(userSetting);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to migrate setting ${legacySetting.key} for user ${legacySetting.telegramId}: ${error}`);
      }
    }

    await this.em.flush();
    return { success, failed, errors };
  }

  async createInitialBalanceHistory(): Promise<void> {
    // Create initial balance history entries for existing balances
    const balances = await this.em.find(UserBalanceEntity, {});

    for (const balance of balances) {
      // Check if initial history already exists
      const existingHistory = await this.em.findOne(UserBalanceHistoryEntity, {
        user: balance.user,
        currency: balance.currency,
        type: TransactionType.ADMIN_ADJUSTMENT,
        description: 'Initial balance migration'
      });

      if (!existingHistory) {
        const history = new UserBalanceHistoryEntity(
          balance.user,
          balance.currency,
          TransactionType.ADMIN_ADJUSTMENT,
          balance.balance,
          '0',
          balance.balance
        );
        history.description = 'Initial balance migration';
        history.status = TransactionStatus.COMPLETED;
        this.em.persist(history);
      }
    }

    await this.em.flush();
  }

  async validateMigration(): Promise<{
    users: number;
    balances: number;
    settings: number;
    historyEntries: number;
  }> {
    const [users, balances, settings, historyEntries] = await Promise.all([
      this.em.count(UserEntity),
      this.em.count(UserBalanceEntity),
      this.em.count(UserSettingsEntity),
      this.em.count(UserBalanceHistoryEntity)
    ]);

    return { users, balances, settings, historyEntries };
  }

  async rollbackMigration(): Promise<void> {
    console.log('⚠️ Rolling back migration...');
    
    // Delete all entities in reverse dependency order
    await this.em.nativeDelete(UserBalanceHistoryEntity, {});
    await this.em.nativeDelete(UserSettingsEntity, {});
    await this.em.nativeDelete(UserBalanceEntity, {});
    await this.em.nativeDelete(UserEntity, {});

    console.log('✅ Migration rollback completed');
  }
}
