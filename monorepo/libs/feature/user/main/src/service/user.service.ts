import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, UserBalanceHistoryRepository, UserSettingsRepository, UserStatus } from '@app/database';

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
  status: UserStatus;
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
    });

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: undefined, // UserEntity doesn't have email field
      status: user.status,
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
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: undefined, // UserEntity doesn't have email field
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: undefined, // UserEntity doesn't have email field
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: undefined, // UserEntity doesn't have email field
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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
   * Find all users with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    users: UserResponseDto[];
    total: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount(
      {},
      {
        offset: (page - 1) * limit,
        limit,
      },
    );

    return {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: undefined, // UserEntity doesn't have email field
        status: user.status,
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
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get users who were referred by this user
    const referredUsers = await this.userRepository.count({ referredBy: user.telegramId });

    // For now, return simple stats without complex joins
    // TODO: Implement proper referral earnings calculation
    return {
      totalReferrals: referredUsers,
      totalEarnings: 0, // TODO: Calculate from user balance history
    };
  }

  /**
   * Get referral link for user
   */
  async getReferralLink(userId: string): Promise<ReferralLinkDto> {
    const user = await this.userRepository.findOne({ id: userId });
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
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const settings = await this.userSettingsRepository.findOne({ user: userId });

    if (!settings) {
      // Return default settings instead of creating (avoid complexity)
      return {
        limitNotificationsEnabled: true,
        inactivityNotificationsEnabled: true,
      };
    }

    return {
      limitNotificationsEnabled: settings.limitNotificationsEnabled ?? true,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? true,
    };
  }

  /**
   * Update notification settings for user
   */
  async updateNotificationSettings(
    userId: string,
    settings: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    const user = await this.userRepository.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // For now, return the input settings (simplified implementation)
    // TODO: Implement proper user settings management
    return {
      limitNotificationsEnabled: settings.limitNotificationsEnabled ?? true,
      inactivityNotificationsEnabled: settings.inactivityNotificationsEnabled ?? true,
    };
  }
}
