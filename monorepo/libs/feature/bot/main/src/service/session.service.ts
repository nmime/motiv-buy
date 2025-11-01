import { Injectable, Logger } from '@nestjs/common';
import { SessionInterface, SessionData } from '@app/feature-bot-shared';
import { RedisCacheService } from '@app/common-redis';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';

/**
 * Session Service
 *
 * Service for managing user session state using Redis for persistence.
 * Handles temporary data storage and session lifecycle management for bot interactions.
 *
 * @class SessionService
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_PREFIX = 'bot:session:';
  private readonly DEFAULT_SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly MAX_SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private readonly redisCacheService: RedisCacheService) {}

  /**
   * Create new session for user
   *
   * @param userId - Unique user identifier
   * @param initialData - Initial session data
   * @param ttlSeconds - Session TTL in seconds (default: 24 hours)
   * @returns Promise<SessionInterface>
   */
  async createSession(
    userId: string,
    initialData?: Partial<SessionData>,
    ttlSeconds: number = this.DEFAULT_SESSION_TTL,
  ): Promise<SessionInterface> {
    try {
      this.logger.debug(`Creating session for user: ${userId}`, {
        userId,
        ttlSeconds,
        hasInitialData: !!initialData,
      });

      const now = new Date();
      const session: SessionInterface = {
        userId,
        data: {
          conversationState: initialData?.conversationState || {
            currentStep: 'initial',
            availableSteps: [],
            context: {},
            isActive: false,
            startedAt: now,
          },
          preferences: initialData?.preferences || {
            language: 'en',
            notifications: {
              enablePush: true,
              enableEmail: false,
              enableSms: false,
              categories: {},
            },
            display: {
              theme: 'auto',
              timezone: 'UTC',
              dateFormat: 'DD/MM/YYYY',
              numberFormat: 'en-US',
            },
            privacy: {
              shareAnalytics: true,
              shareUsageData: true,
              allowDataExport: true,
            },
          },
          navigationState: initialData?.navigationState || {
            currentLocation: 'start',
            breadcrumb: [],
            history: [],
            metadata: {},
          },
          formData: initialData?.formData || {},
          cache: initialData?.cache || {},
          custom: initialData?.custom || {},
        },
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        metadata: {
          version: '1.0',
          platform: 'telegram-bot',
        },
      };

      // Store in Redis
      const sessionKey = this.getSessionKey(userId);
      await this.redisCacheService.setHash(sessionKey, { session }, ttlSeconds);

      this.logger.debug(`Session created successfully for user: ${userId}`);

      return session;
    } catch (err: unknown) {
      this.logger.error(`Failed to create session for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      throw err;
    }
  }

  /**
   * Retrieve existing session for user
   *
   * @param userId - User identifier
   * @returns Promise<SessionInterface | null>
   */
  async getSession(userId: string): Promise<SessionInterface | null> {
    try {
      this.logger.debug(`Retrieving session for user: ${userId}`);

      const sessionKey = this.getSessionKey(userId);
      const sessionHash = await this.redisCacheService.getHash<SessionInterface>(sessionKey);

      if (!sessionHash.session) {
        this.logger.debug(`No session found for user: ${userId}`);

        return null;
      }

      const { session } = sessionHash;

      // Parse dates from Redis strings
      const parsedSession: SessionInterface = {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        expiresAt: new Date(session.expiresAt),
        data: {
          ...session.data,
          conversationState: session.data.conversationState
            ? {
                ...session.data.conversationState,
                startedAt: session.data.conversationState.startedAt
                  ? new Date(session.data.conversationState.startedAt)
                  : new Date(),
              }
            : undefined,
        },
      };

      // Check if session is still valid
      if (!this.isSessionValid(parsedSession)) {
        this.logger.debug(`Session expired for user: ${userId}`);
        await this.deleteSession(userId);

        return null;
      }

      return parsedSession;
    } catch (err: unknown) {
      this.logger.error(`Failed to retrieve session for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      return null;
    }
  }

  /**
   * Update session data
   *
   * @param userId - User identifier
   * @param data - Data to update in session
   * @param ttlSeconds - Optional TTL update
   * @returns Promise<SessionInterface>
   */
  async updateSession(userId: string, data: Partial<SessionData>, ttlSeconds?: number): Promise<SessionInterface> {
    try {
      this.logger.debug(`Updating session for user: ${userId}`, {
        userId,
        updateKeys: Object.keys(data),
        ttlSeconds,
      });

      // Get existing session or create new one
      const session = await this.getSession(userId);
      if (!session) {
        this.logger.debug(`Session not found, creating new session for user: ${userId}`);

        return await this.createSession(userId, data, ttlSeconds);
      }

      // Merge data
      const updatedData: SessionData = {
        ...session.data,
        ...data,
        // Deep merge for nested objects
        conversationState: data.conversationState
          ? {
              ...session.data.conversationState,
              ...data.conversationState,
            }
          : session.data.conversationState,
        preferences: data.preferences
          ? {
              ...session.data.preferences,
              ...data.preferences,
              ...(data.preferences.notifications && {
                notifications: {
                  ...session.data.preferences?.notifications,
                  ...data.preferences.notifications,
                },
              }),
              ...(data.preferences.display && {
                display: {
                  ...session.data.preferences?.display,
                  ...data.preferences.display,
                },
              }),
              ...(data.preferences.privacy && {
                privacy: {
                  ...session.data.preferences?.privacy,
                  ...data.preferences.privacy,
                },
              }),
            }
          : session.data.preferences,
        navigationState: data.navigationState
          ? {
              ...session.data.navigationState,
              ...data.navigationState,
            }
          : session.data.navigationState,
        formData: data.formData
          ? {
              ...session.data.formData,
              ...data.formData,
            }
          : session.data.formData,
        cache: data.cache
          ? {
              ...session.data.cache,
              ...data.cache,
            }
          : session.data.cache,
        custom: data.custom
          ? {
              ...session.data.custom,
              ...data.custom,
            }
          : session.data.custom,
      };

      // Update session
      const updatedSession: SessionInterface = {
        ...session,
        data: updatedData,
        updatedAt: new Date(),
      };

      // Store updated session in Redis
      const sessionKey = this.getSessionKey(userId);
      const currentTtl = ttlSeconds || this.DEFAULT_SESSION_TTL;
      await this.redisCacheService.setHash(sessionKey, { session: updatedSession }, currentTtl);

      this.logger.debug(`Session updated successfully for user: ${userId}`);

      return updatedSession;
    } catch (err: unknown) {
      this.logger.error(`Failed to update session for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      throw err;
    }
  }

  /**
   * Delete session for user
   *
   * @param userId - User identifier
   * @returns Promise<void>
   */
  async deleteSession(userId: string): Promise<void> {
    try {
      this.logger.debug(`Deleting session for user: ${userId}`);

      const sessionKey = this.getSessionKey(userId);
      await this.redisCacheService.deleteFromHash(sessionKey, 'session');

      this.logger.debug(`Session deleted successfully for user: ${userId}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to delete session for user: ${userId}`, {
        error: unknownToError(err),
        userId,
      });

      throw err;
    }
  }

  /**
   * Check if session is valid and not expired
   *
   * @param session - Session to validate
   * @returns boolean
   */
  isSessionValid(session: SessionInterface): boolean {
    const now = new Date();
    const isNotExpired = session.expiresAt > now;
    const hasValidStructure = !!(session.userId && session.data && session.createdAt);

    return isNotExpired && hasValidStructure;
  }

  /**
   * Extend session expiration time
   *
   * @param userId - User identifier
   * @param extensionMs - Milliseconds to extend session
   * @returns Promise<boolean> - Success status
   */
  async extendSession(userId: string, extensionMs: number = this.DEFAULT_SESSION_TTL * 1000): Promise<boolean> {
    try {
      this.logger.debug(`Extending session for user: ${userId} by ${extensionMs}ms`);

      const session = await this.getSession(userId);
      if (!session) {
        this.logger.warn(`Cannot extend session - session not found for user: ${userId}`);

        return false;
      }

      // Calculate new expiration time (capped at max TTL)
      const newExpirationTime = Math.min(Date.now() + extensionMs, Date.now() + this.MAX_SESSION_TTL * 1000);

      const updatedSession: SessionInterface = {
        ...session,
        expiresAt: new Date(newExpirationTime),
        updatedAt: new Date(),
      };

      // Update session with new TTL
      const sessionKey = this.getSessionKey(userId);
      const newTtlSeconds = Math.floor((newExpirationTime - Date.now()) / 1000);
      await this.redisCacheService.setHash(sessionKey, { session: updatedSession }, newTtlSeconds);

      this.logger.debug(`Session extended successfully for user: ${userId}`, {
        newExpirationTime: new Date(newExpirationTime),
        ttlSeconds: newTtlSeconds,
      });

      return true;
    } catch (err: unknown) {
      this.logger.error(`Failed to extend session for user: ${userId}`, {
        error: unknownToError(err),
        userId,
        extensionMs,
      });

      return false;
    }
  }

  /**
   * Get or create session for user
   *
   * @param userId - User identifier
   * @param initialData - Initial data for new session
   * @returns Promise<SessionInterface>
   */
  async getOrCreateSession(userId: string, initialData?: Partial<SessionData>): Promise<SessionInterface> {
    const existingSession = await this.getSession(userId);

    if (existingSession) {
      // Extend session on access
      await this.extendSession(userId);

      return existingSession;
    }

    return await this.createSession(userId, initialData);
  }

  /**
   * Clear all expired sessions (maintenance operation)
   * Note: Redis handles TTL automatically, but this can be used for explicit cleanup
   *
   * @returns Promise<number> - Number of sessions cleared
   */
  async clearExpiredSessions(): Promise<number> {
    try {
      this.logger.log('Starting expired session cleanup...');

      // In Redis with TTL, expired keys are automatically removed
      // This is more for logging/monitoring purposes

      this.logger.log('Expired session cleanup completed (Redis handles TTL automatically)');

      return 0;
    } catch (err: unknown) {
      this.logger.error('Failed to clear expired sessions', {
        error: unknownToError(err),
      });

      throw err;
    }
  }

  /**
   * Generate Redis key for session
   */
  private getSessionKey(userId: string): string {
    return `${this.SESSION_PREFIX}${userId}`;
  }
}
