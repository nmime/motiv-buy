import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationRepository, NotificationTargetType } from '@app/database';
import { NotificationSenderService } from './notification-sender.service';

@Injectable()
export class NotificationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private isProcessing = false;
  private readonly batchSize = 100;

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationSenderService: NotificationSenderService,
  ) {}

  onModuleInit(): void {
    this.logger.log('NotificationSchedulerService initialized');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processUserNotifications(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingNotifications = await this.notificationRepository.findPending({
        targetType: NotificationTargetType.User,
        limit: this.batchSize,
      });

      if (pendingNotifications.length === 0) {
        return;
      }

      this.logger.log(`Processing ${pendingNotifications.length} pending user notifications`);

      for (const notification of pendingNotifications) {
        const canProcess = await this.notificationRepository.markAsProcessing(notification.id);

        if (!canProcess) {
          continue;
        }

        await this.notificationSenderService.sendNotification(notification);
      }

      this.logger.log(`Processed ${pendingNotifications.length} notifications`);
    } catch (error) {
      this.logger.error('Error processing user notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetryableNotifications(): Promise<void> {
    try {
      const retryableNotifications = await this.notificationRepository.findRetryable(50);

      if (retryableNotifications.length === 0) {
        return;
      }

      this.logger.log(`Retrying ${retryableNotifications.length} failed notifications`);

      for (const notification of retryableNotifications) {
        await this.notificationSenderService.sendNotification(notification);
      }
    } catch (error) {
      this.logger.error('Error processing retryable notifications:', error);
    }
  }
}
