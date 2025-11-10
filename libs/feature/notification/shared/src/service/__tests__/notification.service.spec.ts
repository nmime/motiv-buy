/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/postgresql';
import { NotificationService } from '../notification.service';
import {
  NotificationEntity,
  NotificationTemplateEntity,
  NotificationRepository,
  NotificationTemplateRepository,
  NotificationStatus,
  NotificationChannel,
  NotificationTargetType,
  NotificationPriority,
} from '@app/database';
import { CreateNotificationDto, CreateTemplateNotificationDto } from '../../dto';

/**
 * Notification Service Tests
 *
 * Test Coverage:
 * - Create single notification
 * - Create template notification
 * - Create notification batch
 * - Get notification status
 * - Cancel notification
 * - Error scenarios (template not found)
 * - Edge cases (empty batch, missing optional fields)
 */
describe('NotificationService', () => {
  let service: NotificationService;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockNotificationRepository: jest.Mocked<NotificationRepository>;
  let mockTemplateRepository: jest.Mocked<NotificationTemplateRepository>;

  // Test data constants
  const testTemplateId = 'template-123';
  const testTemplateCode = 'welcome_message';
  const testNotificationId = 'notif-456';
  const testUserId = 'user-789';

  const createMockTemplate = (overrides: Partial<NotificationTemplateEntity> = {}): NotificationTemplateEntity =>
    ({
      id: testTemplateId,
      code: testTemplateCode,
      name: 'Welcome Message',
      channel: NotificationChannel.Bot,
      contentType: 'text',
      content: 'Welcome <%= name %>!',
      locale: 'en',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as NotificationTemplateEntity;

  const createMockNotification = (overrides: Partial<NotificationEntity> = {}): NotificationEntity =>
    ({
      id: testNotificationId,
      channel: NotificationChannel.Bot,
      targetType: NotificationTargetType.User,
      targetId: testUserId,
      templateId: testTemplateId,
      templateCode: testTemplateCode,
      status: NotificationStatus.Pending,
      priority: NotificationPriority.Normal,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as NotificationEntity;

  beforeEach(async () => {
    // Create mocks
    mockEntityManager = {
      persistAndFlush: jest.fn().mockImplementation(async (entity: NotificationEntity | NotificationEntity[]) => {
        // Simulate database behavior by setting id on entities
        const entities = Array.isArray(entity) ? entity : [entity];
        entities.forEach((e) => {
          if (!e.id) {
            (e as any).id = `notif-${Math.random().toString(36).substring(7)}`;
          }
        });
      }),
    } as any;

    mockNotificationRepository = {
      findOne: jest.fn(),
      markAsCancelled: jest.fn(),
    } as any;

    mockTemplateRepository = {
      findByCode: jest.fn(),
      findActiveByCodes: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: NotificationRepository,
          useValue: mockNotificationRepository,
        },
        {
          provide: NotificationTemplateRepository,
          useValue: mockTemplateRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const template = createMockTemplate();
      const dto: CreateNotificationDto = {
        channel: NotificationChannel.Bot,
        targetType: NotificationTargetType.User,
        targetId: testUserId,
        templateCode: testTemplateCode,
        data: { name: 'John', amount: 100 },
        priority: NotificationPriority.High,
      };

      mockTemplateRepository.findByCode.mockResolvedValue(template);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createNotification(dto);

      expect(mockTemplateRepository.findByCode).toHaveBeenCalledWith(testTemplateCode);
      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
      expect(result).toMatchObject({
        status: NotificationStatus.Pending,
      });

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should create notification with optional fields', async () => {
      const template = createMockTemplate();
      const sendAt = new Date('2025-12-31T23:59:59Z').toISOString();
      const dto: CreateNotificationDto = {
        channel: NotificationChannel.Bot,
        targetType: NotificationTargetType.User,
        targetId: testUserId,
        templateCode: testTemplateCode,
        data: { name: 'Alice' },
        extra: { buttons: [[{ text: 'Click me', callback_data: 'action' }]] },
        priority: NotificationPriority.Urgent,
        maxRetries: 5,
        sendAt,
        sendTimeFrom: '09:00:00',
        sendTimeTo: '18:00:00',
        locale: 'ru',
        metadata: { source: 'api', requestId: '123' },
      };

      mockTemplateRepository.findByCode.mockResolvedValue(template);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createNotification(dto);

      expect(result).toMatchObject({
        status: NotificationStatus.Pending,
      });

      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      const dto: CreateNotificationDto = {
        channel: NotificationChannel.Bot,
        targetType: NotificationTargetType.User,
        targetId: testUserId,
        templateCode: 'non_existent',
      };

      mockTemplateRepository.findByCode.mockResolvedValue(null);

      await expect(service.createNotification(dto)).rejects.toThrow('Template not found: non_existent');
      expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();
    });

    it('should create notification with minimal required fields', async () => {
      const template = createMockTemplate();
      const dto: CreateNotificationDto = {
        channel: NotificationChannel.Bot,
        targetType: NotificationTargetType.User,
        targetId: testUserId,
        templateCode: testTemplateCode,
      };

      mockTemplateRepository.findByCode.mockResolvedValue(template);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createNotification(dto);

      expect(result).toMatchObject({
        status: NotificationStatus.Pending,
      });
    });
  });

  describe('createTemplateNotification', () => {
    it('should create template notification (delegates to createNotification)', async () => {
      const template = createMockTemplate();
      const dto: CreateTemplateNotificationDto = {
        channel: NotificationChannel.Bot,
        targetType: NotificationTargetType.User,
        targetId: testUserId,
        templateCode: testTemplateCode,
        data: { name: 'Bob' },
        variables: { name: 'Bob', count: 5 },
      };

      mockTemplateRepository.findByCode.mockResolvedValue(template);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const result = await service.createTemplateNotification(dto);

      expect(mockTemplateRepository.findByCode).toHaveBeenCalledWith(testTemplateCode);
      expect(result).toMatchObject({
        status: NotificationStatus.Pending,
      });
    });
  });

  describe('createNotificationBatch', () => {
    it('should create multiple notifications in batch', async () => {
      const template1 = createMockTemplate({ code: 'template1', id: 'tmpl-1' });
      const template2 = createMockTemplate({ code: 'template2', id: 'tmpl-2' });

      const notifications: CreateTemplateNotificationDto[] = [
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-1',
          templateCode: 'template1',
          data: { name: 'User1' },
        },
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-2',
          templateCode: 'template2',
          data: { name: 'User2' },
        },
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-3',
          templateCode: 'template1',
          data: { name: 'User3' },
        },
      ];

      mockTemplateRepository.findActiveByCodes.mockResolvedValue([template1, template2]);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const results = await service.createNotificationBatch(notifications);

      expect(mockTemplateRepository.findActiveByCodes).toHaveBeenCalledWith(['template1', 'template2']);
      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toMatchObject({
          status: NotificationStatus.Pending,
        });

        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeDefined();
      });
    });

    it('should throw error when template not found in batch', async () => {
      const template1 = createMockTemplate({ code: 'template1' });

      const notifications: CreateTemplateNotificationDto[] = [
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-1',
          templateCode: 'template1',
          data: { name: 'User1' },
        },
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-2',
          templateCode: 'non_existent',
          data: { name: 'User2' },
        },
      ];

      mockTemplateRepository.findActiveByCodes.mockResolvedValue([template1]);

      await expect(service.createNotificationBatch(notifications)).rejects.toThrow('Template not found: non_existent');

      expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();
    });

    it('should handle empty batch', async () => {
      const notifications: CreateTemplateNotificationDto[] = [];

      mockTemplateRepository.findActiveByCodes.mockResolvedValue([]);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      const results = await service.createNotificationBatch(notifications);

      expect(results).toHaveLength(0);
      expect(mockTemplateRepository.findActiveByCodes).toHaveBeenCalledWith([]);
    });

    it('should deduplicate template codes when fetching', async () => {
      const template = createMockTemplate({ code: 'same_template' });

      const notifications: CreateTemplateNotificationDto[] = [
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-1',
          templateCode: 'same_template',
          data: { name: 'User1' },
        },
        {
          channel: NotificationChannel.Bot,
          targetType: NotificationTargetType.User,
          targetId: 'user-2',
          templateCode: 'same_template',
          data: { name: 'User2' },
        },
      ];

      mockTemplateRepository.findActiveByCodes.mockResolvedValue([template]);
      mockEntityManager.persistAndFlush.mockResolvedValue(undefined);

      await service.createNotificationBatch(notifications);

      // Should only request unique template codes
      expect(mockTemplateRepository.findActiveByCodes).toHaveBeenCalledWith(['same_template']);
    });
  });

  describe('getNotificationStatus', () => {
    it('should return notification when found', async () => {
      const notification = createMockNotification();

      mockNotificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.getNotificationStatus(testNotificationId);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({ id: testNotificationId });
      expect(result).toEqual(notification);
    });

    it('should return null when notification not found', async () => {
      mockNotificationRepository.findOne.mockResolvedValue(null);

      const result = await service.getNotificationStatus('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel pending notification successfully', async () => {
      const notification = createMockNotification({ status: NotificationStatus.Pending });

      mockNotificationRepository.findOne.mockResolvedValue(notification);
      mockNotificationRepository.markAsCancelled.mockResolvedValue(undefined);

      const result = await service.cancelNotification(testNotificationId);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({ id: testNotificationId });
      expect(mockNotificationRepository.markAsCancelled).toHaveBeenCalledWith(testNotificationId);
      expect(result).toBe(true);
    });

    it('should not cancel notification that is not pending', async () => {
      const notification = createMockNotification({ status: NotificationStatus.Sent });

      mockNotificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.cancelNotification(testNotificationId);

      expect(mockNotificationRepository.markAsCancelled).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false when notification not found', async () => {
      mockNotificationRepository.findOne.mockResolvedValue(null);

      const result = await service.cancelNotification('non-existent-id');

      expect(mockNotificationRepository.markAsCancelled).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should not cancel failed notification', async () => {
      const notification = createMockNotification({ status: NotificationStatus.Failed });

      mockNotificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.cancelNotification(testNotificationId);

      expect(mockNotificationRepository.markAsCancelled).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should not cancel cancelled notification', async () => {
      const notification = createMockNotification({ status: NotificationStatus.Cancelled });

      mockNotificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.cancelNotification(testNotificationId);

      expect(mockNotificationRepository.markAsCancelled).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
