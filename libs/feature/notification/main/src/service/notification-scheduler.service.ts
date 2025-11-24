import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MikroORM, EntityManager as SqlEntityManager } from '@mikro-orm/postgresql';
import { NotificationRepository, NotificationTargetType } from '@app/database';
import { NotificationSenderService } from './notification-sender.service';

@Injectable()
export class NotificationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private isProcessingUserNotifications = false;
  private isProcessingRetryable = false;
  private readonly batchSize = 100;

  constructor(
    private readonly orm: MikroORM,
    private readonly notificationSenderService: NotificationSenderService,
  ) {}

  onModuleInit(): void {
    this.logger.log('NotificationSchedulerService initialized');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processUserNotifications(): Promise<void> {
    if (this.isProcessingUserNotifications) {
      return;
    }

    this.isProcessingUserNotifications = true;

    // Fork EntityManager for cron job context (cron jobs run outside request context)
    const em = this.orm.em.fork() as SqlEntityManager;
    const notificationRepository = new NotificationRepository(em);

    try {
      const pendingNotifications = await notificationRepository.findPending({
        targetType: NotificationTargetType.User,
        limit: this.batchSize,
      });

      if (pendingNotifications.length === 0) {
        return;
      }

      this.logger.log(`Processing ${pendingNotifications.length} pending user notifications`);

      for (const notification of pendingNotifications) {
        // eslint-disable-next-line no-await-in-loop
        const canProcess = await notificationRepository.markAsProcessing(notification.id);

        if (!canProcess) {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        await this.notificationSenderService.sendNotification(notification);
      }

      this.logger.log(`Processed ${pendingNotifications.length} notifications`);
    } catch (error) {
      this.logger.error('Error processing user notifications:', error);
    } finally {
      // Clear the forked EntityManager to release managed entities and connections back to the pool
      em.clear();
      this.isProcessingUserNotifications = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetryableNotifications(): Promise<void> {
    if (this.isProcessingRetryable) {
      return;
    }

    this.isProcessingRetryable = true;

    // Fork EntityManager for cron job context (cron jobs run outside request context)
    const em = this.orm.em.fork() as SqlEntityManager;
    const notificationRepository = new NotificationRepository(em);

    try {
      const retryableNotifications = await notificationRepository.findRetryable(50);

      if (retryableNotifications.length === 0) {
        return;
      }

      this.logger.log(`Retrying ${retryableNotifications.length} failed notifications`);

      for (const notification of retryableNotifications) {
        // eslint-disable-next-line no-await-in-loop
        await this.notificationSenderService.sendNotification(notification);
      }
    } catch (error) {
      this.logger.error('Error processing retryable notifications:', error);
    } finally {
      // Clear the forked EntityManager to release managed entities and connections back to the pool
      em.clear();
      this.isProcessingRetryable = false;
    }
  }
}
