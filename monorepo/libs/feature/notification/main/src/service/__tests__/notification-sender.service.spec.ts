/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationSenderService } from '../notification-sender.service';
import {
  NotificationEntity,
  NotificationTemplateEntity,
  NotificationRepository,
  NotificationTemplateRepository,
  NotificationStatus,
  NotificationChannel,
  NotificationTargetType,
  NotificationErrorReason,
  NotificationContentType,
  NotificationPriority,
} from '@app/database';

/**
 * Notification Sender Service Tests
 *
 * Test Coverage:
 * - Send notification successfully
 * - Error handling (template not found, network errors, etc.)
 * - Error classification
 * - Notification status updates (sent/failed)
 * - Retry logic
 * - Edge cases
 */
describe('NotificationSenderService', () => {
  let service: NotificationSenderService;
  let mockNotificationRepository: jest.Mocked<NotificationRepository>;
  let mockTemplateRepository: jest.Mocked<NotificationTemplateRepository>;
  let loggerSpy: jest.SpyInstance;

  // Test data constants
  const TEST_NOTIFICATION_ID = 'notif-123';
  const TEST_TEMPLATE_ID = 'template-456';
  const TEST_TEMPLATE_CODE = 'order_confirmation';
  const TEST_USER_ID = 'user-789';

  const createMockTemplate = (overrides: Partial<NotificationTemplateEntity> = {}): NotificationTemplateEntity =>
    ({
      id: TEST_TEMPLATE_ID,
      code: TEST_TEMPLATE_CODE,
      name: 'Order Confirmation',
      channel: NotificationChannel.Bot,
      contentType: NotificationContentType.Text,
      content: 'Order #<%= orderId %> confirmed for <%= amount %> USD',
      locale: 'en',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as NotificationTemplateEntity;

  const createMockNotification = (
    overrides: Partial<NotificationEntity> = {},
  ): NotificationEntity =>
    ({
      id: TEST_NOTIFICATION_ID,
      channel: NotificationChannel.Bot,
      targetType: NotificationTargetType.User,
      targetId: TEST_USER_ID,
      templateId: TEST_TEMPLATE_ID,
      templateCode: TEST_TEMPLATE_CODE,
      data: { orderId: 12345, amount: 99.99 },
      status: NotificationStatus.Pending,
      priority: NotificationPriority.Normal,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      template: undefined,
      ...overrides,
    }) as NotificationEntity;

  beforeEach(async () => {
    mockNotificationRepository = {
      markAsSent: jest.fn(),
      markAsFailed: jest.fn(),
    } as any;

    mockTemplateRepository = {
      findByCode: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSenderService,
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

    service = module.get<NotificationSenderService>(NotificationSenderService);

    // Spy on logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification successfully with existing template', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({ template });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^msg_\d+$/);
      expect(mockNotificationRepository.markAsSent).toHaveBeenCalledWith(
        TEST_NOTIFICATION_ID,
        expect.stringMatching(/^msg_\d+$/),
      );
      expect(mockTemplateRepository.findByCode).not.toHaveBeenCalled();
    });

    it('should fetch template when not attached to notification', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({ template: undefined });

      mockTemplateRepository.findByCode.mockResolvedValue(template);
      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(mockTemplateRepository.findByCode).toHaveBeenCalledWith(TEST_TEMPLATE_CODE);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should return error when template not found', async () => {
      const notification = createMockNotification({ template: undefined });

      mockTemplateRepository.findByCode.mockResolvedValue(null);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        reason: NotificationErrorReason.TemplateNotFound,
        message: `Template not found: ${TEST_TEMPLATE_CODE}`,
      });
      expect(mockNotificationRepository.markAsSent).not.toHaveBeenCalled();
    });

    it('should handle notification with variables', async () => {
      const template = createMockTemplate({
        content: 'Hello <%= name %>, your balance is <%= balance %> USD',
      });
      const notification = createMockNotification({
        template,
        data: { name: 'John', balance: 150 },
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle notification with custom locale', async () => {
      const template = createMockTemplate({ locale: 'ru' });
      const notification = createMockNotification({
        template,
        locale: 'ru',
        data: { orderId: 555, amount: 200 },
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
    });

    it('should mark notification as failed on error', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({ template });
      const error = new Error('Network timeout');

      // Mock sendToChannel to throw error
      jest.spyOn(service as any, 'sendToChannel').mockRejectedValue(error);

      mockNotificationRepository.markAsFailed.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        reason: NotificationErrorReason.NetworkError,
        message: 'Network timeout',
      });
      expect(mockNotificationRepository.markAsFailed).toHaveBeenCalledWith(TEST_NOTIFICATION_ID, {
        reason: NotificationErrorReason.NetworkError,
        message: 'Network timeout',
        timestamp: expect.any(Date),
      });
    });

    it('should handle non-Error exceptions', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({ template });

      // Mock sendToChannel to throw non-Error
      jest.spyOn(service as any, 'sendToChannel').mockRejectedValue('String error');

      mockNotificationRepository.markAsFailed.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unknown error');
    });
  });

  describe('classifyError', () => {
    it('should classify bot blocked error', () => {
      const error = new Error('Bot was blocked by the user');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.BotBlocked);
    });

    it('should classify user deactivated error', () => {
      const error = new Error('User is deactivated');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.UserDeactivated);
    });

    it('should classify chat not found error', () => {
      const error = new Error('Chat not found');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.ChatNotFound);
    });

    it('should classify chat restricted error', () => {
      const error = new Error('Not enough rights to send message');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.ChatRestricted);
    });

    it('should classify invalid target error', () => {
      const error = new Error('user_not_found: Invalid user ID');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.InvalidTarget);
    });

    it('should classify rate limit error', () => {
      const error = new Error('Rate limit exceeded');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.RateLimitExceeded);
    });

    it('should classify network error', () => {
      const error = new Error('Network connection failed');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.NetworkError);
    });

    it('should classify timeout error', () => {
      const error = new Error('Request timeout after 30s');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.NetworkError);
    });

    it('should classify unknown error', () => {
      const error = new Error('Some unexpected error');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.UnknownError);
    });

    it('should return UnknownError for non-Error objects', () => {
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError('not an error object');

      expect(reason).toBe(NotificationErrorReason.UnknownError);
    });

    it('should handle case-insensitive error matching', () => {
      const error = new Error('BOT WAS BLOCKED by user');
      const service = new NotificationSenderService(mockNotificationRepository, mockTemplateRepository);

      const reason = (service as any).classifyError(error);

      expect(reason).toBe(NotificationErrorReason.BotBlocked);
    });
  });

  describe('sendToChannel (stub implementation)', () => {
    it('should return message ID (stub)', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({ template });
      const content = {
        contentType: NotificationContentType.Text,
        text: 'Test message',
      };

      const messageId = await (service as any).sendToChannel(notification, content);

      expect(messageId).toMatch(/^msg_\d+$/);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification with empty data', async () => {
      const template = createMockTemplate({ content: 'Static message' });
      const notification = createMockNotification({
        template,
        data: {},
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
    });

    it('should handle notification with metadata', async () => {
      const template = createMockTemplate();
      const notification = createMockNotification({
        template,
        metadata: { source: 'api', requestId: 'req-123' },
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
    });

    it('should handle HTML content type', async () => {
      const template = createMockTemplate({
        contentType: NotificationContentType.Html,
        content: '<b>Order <%= orderId %></b>',
      });
      const notification = createMockNotification({
        template,
        data: { orderId: 999 },
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
    });

    it('should handle markdown content type', async () => {
      const template = createMockTemplate({
        contentType: NotificationContentType.Markdown,
        content: '**Order <%= orderId %>**',
      });
      const notification = createMockNotification({
        template,
        data: { orderId: 888 },
      });

      mockNotificationRepository.markAsSent.mockResolvedValue(undefined);

      const result = await service.sendNotification(notification);

      expect(result.success).toBe(true);
    });
  });
});
