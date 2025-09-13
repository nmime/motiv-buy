import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, UserBalanceHistoryRepository, UserSettingsRepository, UserStatus } from '@app/database';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';
import { InternalException } from '@app/common-exception';

// Local interfaces to avoid cross-library imports
interface CreateUserDto {
  username?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  telegramId: string;
  languageCode?: string;
  password?: string;
}

interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  username?: string;
}

interface UserReferralDto {
  count: number;
  earned: number;
  link: string;
  messageId?: string;
}

interface UserResponseDto {
  id: string;
  name: string;
  username?: string;
  language?: string;
  referral: UserReferralDto;
}

interface ReferralStatsDto {
  totalReferrals: number;
  totalEarnings: number;
}

interface ReferralLinkDto {
  telegramMessage: string;
  link: string;
}

interface NotificationSettingsDto {
  limitNotificationsEnabled: boolean;
  inactivityNotificationsEnabled: boolean;
}

interface UpdateNotificationSettingsDto {
  limitNotificationsEnabled?: boolean;
  inactivityNotificationsEnabled?: boolean;
}

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
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.createUser({
      telegramId: createUserDto.telegramId,
      username: createUserDto.username,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      languageCode: createUserDto.languageCode,
    });

    // Get referral link
    const referralLink = `https://t.me/MotivBuyBot?start=ref_${user.telegramId}`;

    return {
      id: user.id,
      name: user.firstName,
      username: user.username,
      language: user.languageCode,
      referral: {
        count: 0, // New user has no referrals
        earned: 0, // No earnings yet
        link: referralLink,
        messageId: undefined,
      },
    };
  }

  /**
   * Create a new user (alias for create method)
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.create(createUserDto);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): AsyncResult<UserResponseDto, InternalException> {
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      return Err(new InternalException(`User with ID ${id} not found`));
    }

    // Get referral statistics (referredBy uses telegramId, not UUID)
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });
    
    // Calculate total earnings from referrals (10% of their income)
    const referralEarnings = await this.calculateReferralEarnings(user.id);

    // Generate referral link
    const referralCode = `ref_${user.telegramId}`;
    const referralLink = `https://t.me/MotivBuyBot?start=${referralCode}`;

    return Ok({
      id: user.id,
      name: user.firstName,
      username: user.username,
      language: user.languageCode,
      referral: {
        count: referredUsers,
        earned: referralEarnings,
        link: referralLink,
        messageId: undefined, // Optional field
      },
    });
  }

  /**
   * Find user by email - Not supported as UserEntity doesn't have email field
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    // UserEntity doesn't have email field, return null
    return null;
  }

  /**
   * Find user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ telegramId });
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }

    // Get referral statistics
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });
    const referralEarnings = await this.calculateReferralEarnings(user.id);
    const referralLink = `https://t.me/MotivBuyBot?start=ref_${user.telegramId}`;

    return {
      id: user.id,
      name: user.firstName,
      username: user.username,
      language: user.languageCode,
      referral: {
        count: referredUsers,
        earned: referralEarnings,
        link: referralLink,
        messageId: undefined,
      },
    };
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.updateLastActive(user.telegramId);
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Update user fields directly
    if (updateUserDto.firstName !== undefined) user.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) user.lastName = updateUserDto.lastName;
    if (updateUserDto.username !== undefined) user.username = updateUserDto.username;

    await this.userRepository.getEntityManager().flush();

    // Get referral statistics
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });
    const referralEarnings = await this.calculateReferralEarnings(user.id);
    const referralLink = `https://t.me/MotivBuyBot?start=ref_${user.telegramId}`;

    return {
      id: user.id,
      name: user.firstName,
      username: user.username,
      language: user.languageCode,
      referral: {
        count: referredUsers,
        earned: referralEarnings,
        link: referralLink,
        messageId: undefined,
      },
    };
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userRepository.getEntityManager().removeAndFlush(user);
  }

  /**
   * Get referral statistics for user
   */
  async getReferralStats(userId: string): AsyncResult<ReferralStatsDto, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException());
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
  async getReferralLink(userId: string): AsyncResult<ReferralLinkDto, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException());
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
  async getNotificationSettings(userId: string): AsyncResult<NotificationSettingsDto, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException());
    }

    const settings = await this.userSettingsRepository.findOne({ user: userId });

    if (!settings) {
      // Return default settings instead of creating (avoid complexity)
      return Ok({
        limitNotificationsEnabled: true,
        inactivityNotificationsEnabled: true,
      });
    }

    return Ok({
      limitNotificationsEnabled: settings.limitNotificationsEnabled ?? true,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? true,
    });
  }

  /**
   * Update notification settings for user
   */
  async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsDto,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException());
    }

    // For now, return the input settings (simplified implementation)
    // TODO: Implement proper user settings management
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
    settings: UpdateNotificationSettingsDto,
  ): AsyncResult<NotificationSettingsDto, InternalException> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      return Err(new InternalException());
    }

    // Get current notification settings
    const currentSettingsResult = await this.getNotificationSettings(userId);
    if (currentSettingsResult.err) {
      return currentSettingsResult;
    }
    const currentSettings = currentSettingsResult.val;
    
    // Log notification sending (in real app, this would trigger actual notifications)
    console.log(`Sending notifications to user ${userId}:`, {
      limitNotifications: currentSettings.limitNotificationsEnabled,
      inactivityNotifications: currentSettings.inactivityNotificationsEnabled,
      requestedSettings: settings,
    });

    // Update settings if provided and return current state
    if (settings.limitNotificationsEnabled !== undefined || settings.inactivityNotificationsEnabled !== undefined) {
      return this.updateNotificationSettings(userId, settings);
    }

    return Ok(currentSettings);
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
        { fields: ['id'] }
      );

      if (referredUserIds.length === 0) {
        return 0;
      }

      // Calculate 10% of their total completed income transactions
      let totalEarnings = 0;
      
      for (const referredUser of referredUserIds) {
        const transactions = await this.userBalanceHistoryRepository.find({
          user: referredUser.id,
          status: 'completed',
          type: { $in: ['deposit', 'trade_buy', 'bonus'] }
        });

        const userEarnings = transactions.reduce((sum, tx) => {
          return sum + parseFloat(tx.amount || '0');
        }, 0);

        totalEarnings += userEarnings * 0.1; // 10% commission
      }

      return Math.round(totalEarnings * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error calculating referral earnings:', error);
      return 0;
    }
  }
}
