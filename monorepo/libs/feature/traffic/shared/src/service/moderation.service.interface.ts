/**
 * Moderation Service Interface
 *
 * Defines the contract for moderation approval/decline operations.
 * Used by bot handlers to avoid circular dependency with traffic-main.
 *
 * Architecture:
 * - Interface lives in traffic-shared (libs/feature/traffic/shared)
 * - Implementation lives in traffic-main (libs/feature/traffic/main)
 * - Bot handlers depend on interface, NestJS injects implementation
 */
export interface IModerationService {
  /**
   * Approve a traffic source moderation request
   * @param requestId - Moderation request ID
   * @param reviewedByUserId - User ID of the reviewer
   * @returns Promise that resolves when approval is complete
   */
  approveSource(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic source moderation request
   * @param requestId - Moderation request ID
   * @param reviewedByUserId - User ID of the reviewer
   * @param reviewNote - Optional note explaining the decline reason
   * @returns Promise that resolves when decline is complete
   */
  declineSource(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;

  /**
   * Approve a traffic order moderation request
   * @param requestId - Moderation request ID
   * @param reviewedByUserId - User ID of the reviewer
   * @returns Promise that resolves when approval is complete
   */
  approveOrder(requestId: string, reviewedByUserId: string): Promise<void>;

  /**
   * Decline a traffic order moderation request
   * @param requestId - Moderation request ID
   * @param reviewedByUserId - User ID of the reviewer
   * @param reviewNote - Optional note explaining the decline reason
   * @returns Promise that resolves when decline is complete
   */
  declineOrder(requestId: string, reviewedByUserId: string, reviewNote?: string): Promise<void>;
}
