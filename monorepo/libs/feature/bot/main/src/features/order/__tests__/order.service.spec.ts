/**
 * Order Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../order.service';
import { DEFAULT_ORDER_CONFIG, OrderFlowStep, OrderStatus } from '../order.types';

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderService],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Order Management', () => {
    it('should create an order with crypto-secure ID', async () => {
      const userId = 'user123';
      const channelInfo = {
        id: 'channel123',
        title: 'Test Channel',
        subscriberCount: 1000,
        botIsAdmin: false,
      };

      const order = await service.createOrder(userId, DEFAULT_ORDER_CONFIG, channelInfo);

      expect(order).toBeDefined();
      expect(order.userId).toBe(userId);
      expect(order.id).toMatch(/^order_[a-f0-9]{32}$/); // Crypto-secure hex ID
      expect(order.status).toBe(OrderStatus.Moderation);
    });

    it('should get user orders', async () => {
      const userId = 'user123';
      const channelInfo = {
        id: 'channel123',
        title: 'Test Channel',
        subscriberCount: 1000,
        botIsAdmin: false,
      };

      await service.createOrder(userId, DEFAULT_ORDER_CONFIG, channelInfo);
      const orders = await service.getUserOrders(userId);

      expect(orders).toHaveLength(1);
      expect(orders[0].userId).toBe(userId);
    });

    it('should update order status', async () => {
      const userId = 'user123';
      const channelInfo = {
        id: 'channel123',
        title: 'Test Channel',
        subscriberCount: 1000,
        botIsAdmin: false,
      };

      const order = await service.createOrder(userId, DEFAULT_ORDER_CONFIG, channelInfo);
      const updated = await service.updateOrderStatus(order.id, OrderStatus.Active);

      expect(updated?.status).toBe(OrderStatus.Active);
      expect(updated?.startedAt).toBeDefined();
    });

    it('should delete order (soft delete)', async () => {
      const userId = 'user123';
      const channelInfo = {
        id: 'channel123',
        title: 'Test Channel',
        subscriberCount: 1000,
        botIsAdmin: false,
      };

      const order = await service.createOrder(userId, DEFAULT_ORDER_CONFIG, channelInfo);
      const deleted = await service.deleteOrder(order.id);

      expect(deleted).toBe(true);

      const foundOrder = await service.getOrderById(order.id);
      expect(foundOrder?.status).toBe(OrderStatus.Deleted);
    });

    it('should duplicate order', async () => {
      const userId = 'user123';
      const channelInfo = {
        id: 'channel123',
        title: 'Test Channel',
        subscriberCount: 1000,
        botIsAdmin: false,
      };

      const original = await service.createOrder(userId, DEFAULT_ORDER_CONFIG, channelInfo);
      const duplicate = await service.duplicateOrder(original.id, userId);

      expect(duplicate).toBeDefined();
      expect(duplicate?.id).not.toBe(original.id);
      expect(duplicate?.config.name).toBe(original.config.name);
      expect(duplicate?.status).toBe(OrderStatus.Moderation);
    });
  });

  describe('Channel Validation', () => {
    it('should validate correct Telegram link', async () => {
      const validLinks = [
        'https://t.me/testchannel',
        'https://telegram.me/testchannel',
        'https://t.me/+InviteLinkABC123',
      ];

      for (const link of validLinks) {
        const result = await service.validateChannelLink(link);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid Telegram links', async () => {
      const invalidLinks = [
        'not-a-link',
        'http://example.com',
        'telegram.me/channel', // Missing https://
      ];

      for (const link of invalidLinks) {
        const result = await service.validateChannelLink(link);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Session Management', () => {
    it('should clear session state', () => {
      const mockCtx: any = {
        session: {
          formData: {
            orderCreation: { currentStep: OrderFlowStep.EnterChannelLink },
          },
        },
      };

      service.clearOrderSessionState(mockCtx);

      expect(mockCtx.session.formData.orderCreation).toBeUndefined();
    });

    it('should initialize order creation state', () => {
      const mockCtx: any = {
        session: {},
      };

      const state = service.initOrderCreation(mockCtx);

      expect(state.currentStep).toBe(OrderFlowStep.EnterChannelLink);
      expect(state.config).toBeDefined();
      expect(mockCtx.session.formData.orderCreation).toBeDefined();
    });

    it('should expire old session states', () => {
      const mockCtx: any = {
        session: {
          formData: {
            orderCreation: {
              currentStep: OrderFlowStep.EnterChannelLink,
              config: {},
              startedAt: new Date(),
              expiresAt: Date.now() - 1000, // Expired 1 second ago
            },
          },
        },
      };

      const state = service.getOrderSessionState(mockCtx);

      expect(state).toBeNull();
      expect(mockCtx.session.formData.orderCreation).toBeUndefined();
    });
  });
});
