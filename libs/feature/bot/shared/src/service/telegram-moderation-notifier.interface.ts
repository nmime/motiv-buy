import { TrafficSourceEntity, TrafficOrderEntity, ModerationRequestEntity, ModerationEntityType } from '@app/database';

/**
 * Telegram Moderation Notifier Interface
 *
 * Defines contract for sending moderation notifications to Telegram.
 * Used by traffic-main to avoid circular dependency with bot-main.
 *
 * Architecture:
 * - Interface lives in bot-shared (libs/feature/bot/shared)
 * - Implementation lives in bot-main (libs/feature/bot/main)
 * - Traffic-main depends on interface, NestJS injects implementation
 */
export interface ITelegramModerationNotifier {
  /**
   * Send traffic source moderation request to channel
   */
  notifySourceCreated(
    source: TrafficSourceEntity,
    moderationRequest: ModerationRequestEntity,
  ): Promise<{
    chatId: string;
    messageId: number;
  } | null>;

  /**
   * Send traffic order moderation request to channel
   */
  notifyOrderCreated(
    order: TrafficOrderEntity,
    moderationRequest: ModerationRequestEntity,
  ): Promise<{
    chatId: string;
    messageId: number;
  } | null>;

  /**
   * Update message after approval
   */
  updateApproved(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
  ): Promise<void>;

  /**
   * Update message after decline
   */
  updateDeclined(
    chatId: string,
    messageId: number,
    entityType: ModerationEntityType,
    reviewerUsername: string,
    reviewNote?: string,
  ): Promise<void>;
}
