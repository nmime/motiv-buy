/**
 * Moderation Service Abstract Class
 *
 * Defines contract for moderation approval/decline operations.
 * Used by bot-main to avoid circular dependency with traffic-main.
 *
 * Architecture:
 * - Abstract class lives in traffic-shared (libs/feature/traffic/shared)
 * - Implementation lives in traffic-main (libs/feature/traffic/main)
 * - Bot-main depends on abstract class, NestJS injects implementation
 * - Uses abstract class (not interface + string token) for proper type-safe DI
 */
export abstract class IModerationService {
  /**
   * Approve a traffic source moderation request
   */
  abstract approveSource(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic source moderation request
   */
  abstract declineSource(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;

  /**
   * Approve a traffic order moderation request
   */
  abstract approveOrder(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic order moderation request
   */
  abstract declineOrder(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;
}
