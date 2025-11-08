import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationEntity,
  NotificationRepository,
  NotificationTemplateRepository,
  NotificationStatus,
  NotificationErrorReason,
  NotificationContentType,
} from '@app/database';
import { buildNotificationFromTemplate } from '@app/feature-notification-shared';

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

  private async sendToChannel(
    notification: NotificationEntity,
    content: Record<string, unknown>,
  ): Promise<string | undefined> {
    this.logger.log(`Would send notification to ${notification.channel}: ${JSON.stringify(content)}`);
    return `msg_${Date.now()}`;
  }

  private classifyError(error: unknown): NotificationErrorReason {
    if (!(error instanceof Error)) {
      return NotificationErrorReason.UnknownError;
    }

    const message = error.message.toLowerCase();

    const ERROR_PATTERNS: Record<string, NotificationErrorReason> = {
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
