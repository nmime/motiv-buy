import { Injectable } from '@nestjs/common';
import {
  UserRepository,
  UserBalanceHistoryRepository,
  UserSettingsRepository,
  UserEntity,
  TransactionStatus,
  TransactionType,
} from '@app/database';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';
import { InternalException } from '@app/common-exception';
import {
  UserReferralData,
  ReferralStatsData,
  ReferralLinkData,
  NotificationSettingsData,
  UpdateNotificationSettingsData,
} from '../type';

/**
 * User service - business logic implementation
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userBalanceHistoryRepository: UserBalanceHistoryRepository,
    private readonly userSettingsRepository: UserSettingsRepository,
  ) {}

  /**
   * Find user by ID
   */
  async findById(id: string): AsyncResult<UserEntity, InternalException> {
    try {
      const user = await this.userRepository.findOne({ id });
      if (!user) {
        return Err(new InternalException({ detail: `User with ID ${id} not found` }));
      }

      return Ok(user);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return Err(new InternalException({ detail: `Failed to find user: ${errorMessage}` }));
    }
  }

  /**
   * Find user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string): AsyncResult<UserEntity, InternalException> {
    try {
      const user = await this.userRepository.findOne({ telegramId });
      if (!user) {
        return Err(new InternalException({ detail: `User with Telegram ID ${telegramId} not found` }));
      }

      return Ok(user);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return Err(new InternalException({ detail: `Failed to find user by Telegram ID: ${errorMessage}` }));
    }
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(id: string): AsyncResult<void, InternalException> {
    try {
      const user = await this.userRepository.findOne({ id });
      if (!user) {
        return Err(new InternalException({ detail: `User with ID ${id} not found` }));
      }

      await this.userRepository.updateLastActive(user.telegramId);

      return Ok(undefined);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return Err(new InternalException({ detail: `Failed to update last active: ${errorMessage}` }));
    }
  }

  /**
   * Get referral statistics for user
   */
  async getReferralStats(userId: string): AsyncResult<ReferralStatsData, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException({ detail: 'Internal server error occurred' }));
    }

    // Get users who were referred by this user
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });

    // Calculate total earnings from referrals
    const totalEarnings = await this.calculateReferralEarnings(userId);

    return Ok({
      totalReferrals: referredUsers,
      totalEarnings,
    });
  }

  /**
   * Get referral link for user
   */
  async getReferralLink(userId: string): AsyncResult<ReferralLinkData, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException({ detail: 'Internal server error occurred' }));
    }

    // Generate referral code based on telegram ID
    const referralCode = `ref_${user.telegramId}`;
    const referralLink = `https://t.me/MotivBuyBot?start=${referralCode}`;

    return Ok({
      telegramMessage: `Join MotivBuy using my referral link: ${referralLink}`,
      link: referralLink,
    });
  }

  /**
   * Get notification settings for user
   */
  async getNotificationSettings(userId: string): AsyncResult<NotificationSettingsData, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException({ detail: 'Internal server error occurred' }));
    }

    const limitSetting = await this.userSettingsRepository.findOne({
      user: userId,
      key: 'limitNotificationsEnabled',
    });

    const inactivitySetting = await this.userSettingsRepository.findOne({
      user: userId,
      key: 'inactivityNotificationsEnabled',
    });

    return Ok({
      limitNotificationsEnabled: (limitSetting?.getValue() as boolean) ?? true,
      inactivityNotificationsEnabled: (inactivitySetting?.getValue() as boolean) ?? true,
    });
  }

  /**
   * Update notification settings for user
   */
  async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsData,
  ): AsyncResult<NotificationSettingsData, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException({ detail: 'Internal server error occurred' }));
    }

    // For now, return the input settings (simplified implementation)
    // FIXME: Implement proper user settings management with database persistence and validation
    return Ok({
      limitNotificationsEnabled: settings.limitNotificationsEnabled ?? true,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? true,
    });
  }

  /**
   * Send notification to user with limits and inactivity data
   */
  async sendNotification(
    userId: string,
    settings: UpdateNotificationSettingsData,
  ): AsyncResult<NotificationSettingsData, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException({ detail: 'Internal server error occurred' }));
    }

    // Get current notification settings
    const currentSettingsResult = await this.getNotificationSettings(userId);
    if (currentSettingsResult.err) {
      return currentSettingsResult;
    }

    const currentSettings = currentSettingsResult.val;

    // Log notification sending (in real app, this would trigger actual notifications)
    // Log notification sending (replace with proper logging)
    // console.log removed to fix linting error

    // Update settings if provided and return current state
    if (settings.limitNotificationsEnabled !== undefined || settings.inactivityNotificationsEnabled !== undefined) {
      return this.updateNotificationSettings(userId, settings);
    }

    return Ok(currentSettings);
  }

  /**
   * Get referral data for a user
   */
  async getReferralData(userId: string): AsyncResult<UserReferralData, InternalException> {
    try {
      const user = await this.userRepository.findOne({ id: userId });
      if (!user) {
        return Err(new InternalException({ detail: 'User not found' }));
      }

      // Get referral statistics
      const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });
      const referralEarnings = await this.calculateReferralEarnings(userId);
      const referralCode = `ref_${user.telegramId}`;
      const referralLink = `https://t.me/MotivBuyBot?start=${referralCode}`;

      return Ok({
        count: referredUsers,
        earned: referralEarnings,
        link: referralLink,
        messageId: undefined,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return Err(new InternalException({ detail: `Failed to get referral data: ${errorMessage}` }));
    }
  }

  /**
   * Calculate referral earnings for a user (10% of referrals' income)
   */
  private async calculateReferralEarnings(userId: string): Promise<number> {
    try {
      // Get all users referred by this user (need to get telegramId first)
      const currentUser = await this.userRepository.findOne({ id: userId });
      if (!currentUser) {
        return 0;
      }

      const referredUserIds = await this.userRepository.find(
        { referredBy: currentUser.telegramId },
        { fields: ['id'] },
      );

      if (referredUserIds.length === 0) {
        return 0;
      }

      // Calculate 10% of their total completed income transactions
      let totalEarnings = 0;

      const userTransactionPromises = referredUserIds.map(async (referredUser) => {
        const transactions = await this.userBalanceHistoryRepository.find({
          user: referredUser.id,
          status: TransactionStatus.Completed,
          type: { $in: [TransactionType.Deposit, TransactionType.TradeBuy, TransactionType.ReferralBonus] },
        });

        return transactions.reduce((sum, tx) => {
          return sum + parseFloat(tx.amount || '0');
        }, 0);
      });

      const userEarningsArray = await Promise.all(userTransactionPromises);
      totalEarnings = userEarningsArray.reduce((sum, userEarnings) => {
        return sum + userEarnings * 0.1; // 10% commission
      }, 0);

      return Math.round(totalEarnings * 100) / 100; // Round to 2 decimal places
    } catch {
      // Error calculating referral earnings - replace with proper logging

      return 0;
    }
  }
}
