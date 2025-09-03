import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, UserBalanceHistoryRepository, UserSettingsRepository } from '@app/database';

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

interface UserResponseDto {
  id: string;
  username?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
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
      isActive: true,
      isPremium: false,
    });

    return {
      id: String(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ id: Number(id) });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return {
      id: String(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({ email });
    if (!user) {
      return null;
    }
    
    return {
      id: String(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Find user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ telegramId });
    if (!user) {
      throw new NotFoundException(`User with Telegram ID ${telegramId} not found`);
    }
    
    return {
      id: String(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ id: Number(id) });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    await this.userRepository.updateLastActive(user.telegramId);
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ id: Number(id) });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    const updatedUser = await this.userRepository.update(Number(id), {
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      username: updateUserDto.username,
    });

    return {
      id: String(updatedUser.id),
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ id: Number(id) });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    await this.userRepository.delete(Number(id));
  }

  /**
   * Find all users with pagination
   */
  async findAll(page: number = 1, limit: number = 10): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return {
      users: users.map(user => ({
        id: String(user.id),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      total,
    };
  }

  /**
   * Get referral statistics for user
   */
  async getReferralStats(userId: string): Promise<ReferralStatsDto> {
    const user = await this.userRepository.findOne({ id: Number(userId) });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get users who were referred by this user
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });
    
    // Calculate total earnings from referrals (10% from their income)
    const referralEarnings = await this.userBalanceHistoryRepository
      .createQueryBuilder('history')
      .innerJoin('user', 'referredUser', 'referredUser.id = history.userId')
      .where('referredUser.referredBy = :telegramId', { telegramId: user.telegramId })
      .andWhere('history.operationType = :type', { type: 'referral_bonus' })
      .andWhere('history.status = :status', { status: 'completed' })
      .select('SUM(history.amount)', 'total')
      .getRawOne();

    return {
      totalReferrals: referredUsers,
      totalEarnings: Number(referralEarnings?.total) || 0,
    };
  }

  /**
   * Get referral link for user
   */
  async getReferralLink(userId: string): Promise<ReferralLinkDto> {
    const user = await this.userRepository.findOne({ id: Number(userId) });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Generate referral code based on telegram ID
    const referralCode = `ref_${user.telegramId}`;
    const referralLink = `https://t.me/MotivBuyBot?start=${referralCode}`;

    return {
      telegramMessage: `Join MotivBuy using my referral link: ${referralLink}`,
      link: referralLink,
    };
  }

  /**
   * Get notification settings for user
   */
  async getNotificationSettings(userId: string): Promise<NotificationSettingsDto> {
    const user = await this.userRepository.findOne({ id: Number(userId) });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const settings = await this.userSettingsRepository.findOne({ userId: Number(userId) });
    
    if (!settings) {
      // Create default settings if none exist
      const newSettings = await this.userSettingsRepository.create({
        userId: Number(userId),
        limitNotificationsEnabled: true,
        inactivityNotificationsEnabled: true,
      });
      
      return {
        limitNotificationsEnabled: newSettings.limitNotificationsEnabled,
        inactivityNotificationsEnabled: newSettings.inactivityNotificationsEnabled,
      };
    }

    return {
      limitNotificationsEnabled: settings.limitNotificationsEnabled,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled,
    };
  }

  /**
   * Update notification settings for user
   */
  async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    const user = await this.userRepository.findOne({ id: Number(userId) });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const existingSettings = await this.userSettingsRepository.findOne({ userId: Number(userId) });
    
    if (!existingSettings) {
      // Create new settings
      const newSettings = await this.userSettingsRepository.create({
        userId: Number(userId),
        limitNotificationsEnabled: settings.limitNotificationsEnabled ?? true,
        inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? true,
      });
      
      return {
        limitNotificationsEnabled: newSettings.limitNotificationsEnabled,
        inactivityNotificationsEnabled: newSettings.inactivityNotificationsEnabled,
      };
    }

    // Update existing settings
    const updatedSettings = await this.userSettingsRepository.update(existingSettings.id, {
      limitNotificationsEnabled: settings.limitNotificationsEnabled ?? existingSettings.limitNotificationsEnabled,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? existingSettings.inactivityNotificationsEnabled,
    });

    return {
      limitNotificationsEnabled: updatedSettings.limitNotificationsEnabled,
      inactivityNotificationsEnabled: updatedSettings.inactivityNotificationsEnabled,
    };
  }
}