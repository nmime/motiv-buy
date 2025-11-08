import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  NotificationEntity,
  NotificationTemplateEntity,
  NotificationRepository,
  NotificationTemplateRepository,
} from '@app/database';
import { NotificationSharedModule } from '@app/feature-notification-shared';
import { NotificationSenderService, NotificationSchedulerService } from './service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MikroOrmModule.forFeature([NotificationEntity, NotificationTemplateEntity]),
    NotificationSharedModule,
  ],
  providers: [
    NotificationRepository,
    NotificationTemplateRepository,
    NotificationSenderService,
    NotificationSchedulerService,
  ],
  exports: [NotificationSenderService, NotificationSchedulerService],
})
export class NotificationMainModule {}
