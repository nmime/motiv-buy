/**
 * Moderation Service Interface
 *
 * Defines contract for moderation approval/decline operations.
 * Used by bot-main to avoid circular dependency with traffic-main.
 *
 * Architecture:
 * - Interface lives in traffic-shared (libs/feature/traffic/shared)
 * - Implementation lives in traffic-main (libs/feature/traffic/main)
 * - Bot-main depends on interface, NestJS injects implementation
 */
export interface IModerationService {
  /**
   * Approve a traffic source moderation request
   */
  approveSource(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic source moderation request
   */
  declineSource(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;

  /**
   * Approve a traffic order moderation request
   */
  approveOrder(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic order moderation request
   */
  declineOrder(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;
}
