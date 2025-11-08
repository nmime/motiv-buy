/* eslint-disable @nx/enforce-module-boundaries */
import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '@app/common-redis';
import { UserEntity } from '@app/database';

/**
 * Bot Session Management Service
 *
 * Handles Redis-based session management for bot users
 */
@Injectable()
export class BotSessionService {
  private readonly logger = new Logger(BotSessionService.name);
  private readonly sessionTtl = 86400; // 24 hours in seconds
  private readonly sessionPrefix = 'bot:session:';

  constructor(private readonly redisCacheService: RedisCacheService) {}

  /**
   * Generate session ID for user
   */
  generateSessionId(telegramId: string): string {
    return `${telegramId}_${crypto.randomUUID()}`;
  }

  /**
   * Store user session in Redis
   */
  async storeUserSession(sessionId: string, user: UserEntity): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);

      const sessionData = {
        userId: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        languageCode: user.languageCode,
        status: user.status,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString(),
      };

      await this.redisCacheService.setHash(sessionKey, sessionData, this.sessionTtl);

      // Also store by telegram ID for quick lookup
      const telegramKey = this.getTelegramKey(user.telegramId);
      await this.redisCacheService.setHash(telegramKey, { sessionId }, this.sessionTtl);

      this.logger.debug(`Session stored for user ${user.telegramId}`, { sessionId });
    } catch (err: unknown) {
      this.logger.error('Failed to store user session', err, { sessionId, userId: user.id });
      throw err;
    }
  }

  /**
   * Get user session from Redis
   */
  async getUserSession(sessionId: string): Promise<Partial<UserEntity> | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionData = await this.redisCacheService.getHash<string>(sessionKey);

      if (!sessionData || Object.keys(sessionData).length === 0) {
        return null;
      }

      // Use type assertion for enum values from Redis
      return {
        id: sessionData.userId,
        telegramId: sessionData.telegramId,
        username: sessionData.username,
        firstName: sessionData.firstName,
        lastName: sessionData.lastName,
        languageCode: sessionData.languageCode,
        status: sessionData.status as unknown,
        role: sessionData.role as unknown,
        createdAt: sessionData.createdAt ? new Date(sessionData.createdAt) : undefined,
        lastActiveAt: sessionData.lastActiveAt ? new Date(sessionData.lastActiveAt) : undefined,
      } as Partial<UserEntity>;
    } catch (err: unknown) {
      this.logger.error('Failed to get user session', err, { sessionId });

      return null;
    }
  }

  /**
   * Get session ID by telegram ID
   */
  async getSessionIdByTelegramId(telegramId: string): Promise<string | null> {
    try {
      const telegramKey = this.getTelegramKey(telegramId);
      const data = await this.redisCacheService.getHash<string>(telegramKey);

      return data.sessionId || null;
    } catch (err: unknown) {
      this.logger.error('Failed to get session ID by telegram ID', err, { telegramId });

      return null;
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      await this.redisCacheService.setHash(sessionKey, { lastActiveAt: new Date().toISOString() }, this.sessionTtl);
    } catch (err: unknown) {
      this.logger.error('Failed to update session activity', err, { sessionId });
    }
  }

  /**
   * Remove user session
   */
  async removeUserSession(sessionId: string, telegramId?: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      await this.redisCacheService.deleteFromHash(sessionKey, 'userId');

      if (telegramId) {
        const telegramKey = this.getTelegramKey(telegramId);
        await this.redisCacheService.deleteFromHash(telegramKey, 'sessionId');
      }

      this.logger.debug(`Session removed`, { sessionId, telegramId });
    } catch (err: unknown) {
      this.logger.error('Failed to remove user session', err, { sessionId, telegramId });
    }
  }

  /**
   * Clear all sessions for telegram ID
   */
  async clearUserSessions(telegramId: string): Promise<void> {
    try {
      const telegramKey = this.getTelegramKey(telegramId);
      const data = await this.redisCacheService.getHash<string>(telegramKey);

      if (data.sessionId) {
        await this.removeUserSession(data.sessionId, telegramId);
      }
    } catch (err: unknown) {
      this.logger.error('Failed to clear user sessions', err, { telegramId });
    }
  }

  /**
   * Generate Redis key for session
   */
  private getSessionKey(sessionId: string): string {
    return `${this.sessionPrefix}${sessionId}`;
  }

  /**
   * Generate Redis key for telegram ID lookup
   */
  private getTelegramKey(telegramId: string): string {
    return `${this.sessionPrefix}telegram:${telegramId}`;
  }
}
