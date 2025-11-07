import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserEntity } from '@app/database';
import { LoginHistoryResponseDto, SecurityOverviewResponseDto } from '../dto';

/**
 * Security Service
 * Manages security-related features including login history tracking
 *
 * Note: This is a basic implementation. Login history tracking would need
 * to be implemented in the auth service to record actual login attempts.
 */
@Injectable()
export class SecurityService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get login history for a user
   *
   * @param userId - User ID
   * @param limit - Number of records to return (default: 50)
   * @returns Array of login history records
   */
  async getLoginHistory(userId: string, limit: number = 50): Promise<LoginHistoryResponseDto[]> {
    const em = this.em.fork();

    // For now, return mock data based on user's last activity
    // In production, this would query a dedicated login_history table
    const user = await em.findOne(UserEntity, { id: userId });

    if (!user || !user.lastActiveAt) {
      return [];
    }

    // Return mock history with last login
    return [
      {
        timestamp: user.lastActiveAt,
        ipAddress: '0.0.0.0', // Would be stored in login_history table
        userAgent: 'Unknown', // Would be stored in login_history table
        location: undefined,
        success: true,
      },
    ];
  }

  /**
   * Get security overview for a user
   *
   * @param userId - User ID
   * @returns Security overview with session info and login statistics
   */
  async getSecurityOverview(userId: string): Promise<SecurityOverviewResponseDto> {
    const em = this.em.fork();

    const user = await em.findOne(UserEntity, { id: userId });

    if (!user) {
      return {
        lastLogin: new Date(),
        lastLoginIp: '0.0.0.0',
        activeSessions: 0,
        loginCount: 0,
        failedAttempts: 0,
        twoFactorEnabled: false,
      };
    }

    // Basic implementation - would be enhanced with actual session tracking
    return {
      lastLogin: user.lastActiveAt ?? user.createdAt,
      lastLoginIp: '0.0.0.0', // Would be stored in session/login tracking
      activeSessions: 1, // Current session
      loginCount: 1, // Would query login_history table
      failedAttempts: 0, // Would query failed_login_attempts table
      twoFactorEnabled: false, // Would check user.twoFactorEnabled field
    };
  }
}
