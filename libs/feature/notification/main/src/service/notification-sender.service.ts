import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationEntity,
  NotificationRepository,
  NotificationTemplateRepository,
  NotificationErrorReason,
} from '@app/database';
import { buildNotificationFromTemplate, NotificationResult } from '@app/feature-notification-shared';

export interface SendNotificationResult {
  success: boolean;
  messageId?: string;
  error?: {
    reason: NotificationErrorReason;
    message: string;
  };
}

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationTemplateRepository: NotificationTemplateRepository,
  ) {}

  /**
   * Send a notification through its designated channel
   *
   * Builds notification content from template, sends via channel,
   * and updates notification status (sent/failed).
   *
   * @param notification - The notification entity to send
   * @returns Result object containing success status, messageId, or error details
   *
   * @example
   * ```typescript
   * const result = await sender.sendNotification(notification);
   * if (result.success) {
   *   console.log(`Sent with message ID: ${result.messageId}`);
   * } else {
   *   console.error(`Failed: ${result.error.message}`);
   * }
   * ```
   */
  async sendNotification(notification: NotificationEntity): Promise<SendNotificationResult> {
    try {
      if (!notification.template) {
        const template = await this.notificationTemplateRepository.findByCode(notification.templateCode ?? '');
        if (!template) {
          return {
            success: false,
            error: {
              reason: NotificationErrorReason.TemplateNotFound,
              message: `Template not found: ${notification.templateCode}`,
            },
          };
        }

        notification.template = template;
      }
    // eslint-disable-next-line no-param-reassign

      const content = buildNotificationFromTemplate(notification.template, {
        templateCode: notification.templateCode ?? '',
        locale: notification.locale ?? 'en',
        variables: (notification.data as Record<string, string | number>) ?? {},
        userContext: notification.metadata,
      });

      this.logger.debug(`Sending notification ${notification.id} with content type: ${content.contentType}`);

      const messageId = await this.sendToChannel(notification, content);

      if (messageId) {
        await this.notificationRepository.markAsSent(notification.id, messageId);

        return { success: true, messageId };
      }

      return {
        success: false,
        error: {
          reason: NotificationErrorReason.UnknownError,
          message: 'Failed to send notification',
        },
      };
    } catch (error) {
      this.logger.error(`Error sending notification ${notification.id}:`, error);

      const errorReason = this.classifyError(error);
      await this.notificationRepository.markAsFailed(notification.id, {
        reason: errorReason,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      return {
        success: false,
        error: {
          reason: errorReason,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Send notification content to the specified channel
   *
   * Currently a stub implementation that logs the notification.
   * Should be replaced with actual channel-specific sending logic
   * (Telegram, email, SMS, etc.).
   *
   * @param notification - The notification entity containing channel info
   * @param content - The rendered notification content (text/HTML/markdown)
   * @returns Channel-specific message ID, or undefined if sending failed
   * @private
   */
  private async sendToChannel(
    notification: NotificationEntity,
    content: NotificationResult,
  ): Promise<string | undefined> {
    this.logger.log(`Would send notification to ${notification.channel}: ${JSON.stringify(content)}`);

    return `msg_${Date.now()}`;
  }

  /**
   * Classify error into specific NotificationErrorReason category
   *
   * Analyzes error message to determine error type for better handling
   * and retry logic. Uses pattern matching against common error messages
   * from various notification channels.
   *
   * @param error - The error to classify
   * @returns Categorized error reason enum value
   * @private
   */
  private classifyError(error: unknown): NotificationErrorReason {
    if (!(error instanceof Error)) {
      return NotificationErrorReason.UnknownError;
    }

    const message = error.message.toLowerCase();

    const errorPatterns: Record<string, NotificationErrorReason> = {
      'bot was blocked': NotificationErrorReason.BotBlocked,
      'user is deactivated': NotificationErrorReason.UserDeactivated,
      'chat not found': NotificationErrorReason.ChatNotFound,
      'not enough rights': NotificationErrorReason.ChatRestricted,
      'user_not_found': NotificationErrorReason.InvalidTarget,
      'invalid user': NotificationErrorReason.InvalidTarget,
      'rate limit': NotificationErrorReason.RateLimitExceeded,
      'network': NotificationErrorReason.NetworkError,
      'timeout': NotificationErrorReason.NetworkError,
    };

    for (const [pattern, reason] of Object.entries(ERROR_PATTERNS)) {
      if (message.includes(pattern)) {
        return reason;
      }
    }

    return NotificationErrorReason.UnknownError;
  }
}
