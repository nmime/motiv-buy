import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationSharedModule } from '@app/feature-notification-shared';
import { NotificationSchedulerService, NotificationSenderService } from './service';

/**
 * Notification main module.
 * Note: Repositories are provided globally by DatabaseModule, no need to re-provide them here.
 * MikroORM entities are registered in DatabaseModule.forFeature().
 */
@Module({
  imports: [ScheduleModule.forRoot(), NotificationSharedModule],
  providers: [NotificationSenderService, NotificationSchedulerService],
  exports: [NotificationSenderService, NotificationSchedulerService],
})
export class NotificationMainModule {}
