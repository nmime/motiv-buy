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
   *
   * ⚠️ NOTE: This returns MOCK DATA - not production ready!
   * REQUIRES: Implement actual login history tracking:
   * 1. Create login_history table with ipAddress, userAgent, location fields
   * 2. Record login attempts in auth service
   * 3. Query login_history table with proper filtering and pagination
   */
  async getLoginHistory(userId: string, _limit = 50): Promise<LoginHistoryResponseDto[]> {
    const em = this.em.fork();

    // ⚠️ WARNING: Returning mock data - not actual login history!
    const user = await em.findOne(UserEntity, { id: userId });

    if (!user || !user.lastActiveAt) {
      return [];
    }

    // MOCK DATA: Replace with actual login_history table query
    return [
      {
        timestamp: user.lastActiveAt,
        ipAddress: '0.0.0.0', // MOCK: Should be from login_history table
        userAgent: 'Unknown', // MOCK: Should be from login_history table
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
   *
   * ⚠️ NOTE: This returns MOCK DATA - not production ready!
   * REQUIRES: Implement proper security tracking:
   * 1. Create sessions table for active session tracking
   * 2. Track IP addresses and user agents in login_history
   * 3. Implement failed login attempts tracking
   * 4. Add two-factor authentication support
   */
  async getSecurityOverview(userId: string): Promise<SecurityOverviewResponseDto> {
    const em = this.em.fork();

    const user = await em.findOne(UserEntity, { id: userId });

    if (!user) {
      // MOCK DATA: All values are placeholder
      return {
        lastLogin: new Date(),
        lastLoginIp: '0.0.0.0',
        activeSessions: 0,
        loginCount: 0,
        failedAttempts: 0,
        twoFactorEnabled: false,
      };
    }

    // ⚠️ WARNING: Returning mock/estimated data - not actual tracked values!
    return {
      lastLogin: user.lastActiveAt ?? user.createdAt,
      lastLoginIp: '0.0.0.0', // MOCK: Should query sessions/login_history table
      activeSessions: 1, // MOCK: Should count active sessions from sessions table
      loginCount: 1, // MOCK: Should query login_history table
      failedAttempts: 0, // MOCK: Should query failed_login_attempts table
      twoFactorEnabled: false, // MOCK: Should check user.twoFactorEnabled field (not implemented)
    };
  }
}
