import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  NotificationEntity,
  NotificationTemplateEntity,
  NotificationRepository,
  NotificationTemplateRepository,
  NotificationStatus,
} from '@app/database';
import { CreateNotificationDto, CreateTemplateNotificationDto, NotificationResponseDto } from '../dto';

@Injectable()
export class NotificationService {
  constructor(
    private readonly em: EntityManager,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationTemplateRepository: NotificationTemplateRepository,
  ) {}

  async createNotification<T extends Record<string, string | number> = Record<string, string | number>>(
    dto: CreateNotificationDto<T>,
  ): Promise<NotificationResponseDto> {
    const template = await this.notificationTemplateRepository.findByCode(dto.templateCode);

    if (!template) {
      throw new Error(`Template not found: ${dto.templateCode}`);
    }

    const notification = new NotificationEntity({
      channel: dto.channel,
      targetType: dto.targetType,
      targetId: dto.targetId,
      template,
      templateCode: dto.templateCode,
      data: dto.data,
      extra: dto.extra,
      priority: dto.priority,
      maxRetries: dto.maxRetries,
      sendAt: dto.sendAt ? new Date(dto.sendAt) : undefined,
      sendTimeFrom: dto.sendTimeFrom,
      sendTimeTo: dto.sendTimeTo,
      locale: dto.locale,
      metadata: dto.metadata,
      status: NotificationStatus.Pending,
    });

    const em = this.em.fork();
    await em.persistAndFlush(notification);

    return {
      id: notification.id,
      status: notification.status,
      createdAt: notification.createdAt,
    };
  }

  async createTemplateNotification<T extends Record<string, string | number> = Record<string, string | number>>(
    dto: CreateTemplateNotificationDto<T>,
  ): Promise<NotificationResponseDto> {
    return await this.createNotification(dto);
  }

  async createNotificationBatch<T extends Record<string, string | number> = Record<string, string | number>>(
    notifications: CreateTemplateNotificationDto<T>[],
  ): Promise<NotificationResponseDto[]> {
    const templateCodes = [...new Set(notifications.map((n) => n.templateCode))];
    const templates = await this.notificationTemplateRepository.findActiveByCodes(templateCodes);
    const templateMap: Record<string, NotificationTemplateEntity> = {};

    for (const template of templates) {
      templateMap[template.code] = template;
    }

    const entities = notifications.map((dto) => {
      const template = templateMap[dto.templateCode];
      if (!template) {
        throw new Error(`Template not found: ${dto.templateCode}`);
      }

      return new NotificationEntity({
        channel: dto.channel,
        targetType: dto.targetType,
        targetId: dto.targetId,
        template,
        templateCode: dto.templateCode,
        data: dto.data,
        extra: dto.extra,
        priority: dto.priority,
        maxRetries: dto.maxRetries,
        sendAt: dto.sendAt ? new Date(dto.sendAt) : undefined,
        sendTimeFrom: dto.sendTimeFrom,
        sendTimeTo: dto.sendTimeTo,
        locale: dto.locale,
        metadata: dto.metadata,
        status: NotificationStatus.Pending,
      });
    });

    const em = this.em.fork();
    await em.persistAndFlush(entities);

    return entities.map((n) => ({
      id: n.id,
      status: n.status,
      createdAt: n.createdAt,
    }));
  }

  async getNotificationStatus(id: string): Promise<NotificationEntity | null> {
    return await this.notificationRepository.findOne({ id });
  }

  async cancelNotification(id: string): Promise<boolean> {
    const notification = await this.notificationRepository.findOne({ id });

    if (!notification || notification.status !== NotificationStatus.Pending) {
      return false;
    }

    await this.notificationRepository.markAsCancelled(id);

    return true;
  }
}
