import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  NotificationEntity,
  NotificationRepository,
  NotificationTemplateEntity,
  NotificationTemplateRepository,
} from '@app/database';
import { NotificationService } from './service';

@Module({
  imports: [MikroOrmModule.forFeature([NotificationEntity, NotificationTemplateEntity])],
  providers: [NotificationService, NotificationRepository, NotificationTemplateRepository],
  exports: [NotificationService, NotificationRepository, NotificationTemplateRepository],
})
export class NotificationSharedModule {}
