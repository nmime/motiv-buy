/* eslint-disable sonarjs/no-nested-functions */
import { Test, TestingModule } from '@nestjs/testing';
import { BotSubscriptionService } from '../bot-subscription.service';
import {
  BulkSubscriptionCheckResult,
  ChatMemberStatus,
  ChatType,
  SubscriptionCheckResult,
} from '../bot-subscription.interface';
import { Bot } from 'grammy';

// Mock Grammy Bot
jest.mock('grammy', () => {
  return {
    Bot: jest.fn().mockImplementation((_token: string) => {
      return {
        api: {
          getChatMember: jest.fn(),
          getChat: jest.fn(),
          getChatMemberCount: jest.fn(),
        },
      };
    }),
  };
});

describe('BotSubscriptionService', () => {
  let service: BotSubscriptionService;
  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BotSubscriptionService],
    }).compile();

    service = module.get<BotSubscriptionService>(BotSubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSubscription', () => {
    it('should return subscribed for member status', async () => {
      const mockChatMember = {
        status: 'member',
        user: {
          id: 123456789,
          is_bot: false,
          first_name: 'John',
        },
      };

      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result: SubscriptionCheckResult = await service.checkSubscription(mockBotToken, '@testchannel', 123456789);

      expect(result.isSubscribed).toBe(true);
      expect(result.status).toBe(ChatMemberStatus.Member);
      expect(result.isAdmin).toBe(false);
      expect(result.isCreator).toBe(false);
      expect(result.chatId).toBe('@testchannel');
      expect(result.userId).toBe(123456789);
      expect(result.error).toBeUndefined();
    });

    it('should return subscribed for administrator status', async () => {
      const mockChatMember = {
        status: 'administrator',
        user: {
          id: 987654321,
          is_bot: false,
          first_name: 'Admin',
        },
      };

      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkSubscription(mockBotToken, -1001234567890, 987654321);

      expect(result.isSubscribed).toBe(true);
      expect(result.status).toBe(ChatMemberStatus.Administrator);
      expect(result.isAdmin).toBe(true);
      expect(result.isCreator).toBe(false);
    });

    it('should return subscribed for creator status', async () => {
      const mockChatMember = {
        status: 'creator',
        user: {
          id: 111222333,
          is_bot: false,
          first_name: 'Creator',
        },
      };

      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkSubscription(mockBotToken, '@mychannel', 111222333);

      expect(result.isSubscribed).toBe(true);
      expect(result.status).toBe(ChatMemberStatus.Creator);
      expect(result.isAdmin).toBe(true);
      expect(result.isCreator).toBe(true);
    });

    it('should return not subscribed for left status', async () => {
      const mockChatMember = {
        status: 'left',
        user: {
          id: 444555666,
          is_bot: false,
          first_name: 'User',
        },
      };

      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkSubscription(mockBotToken, '@channel', 444555666);

      expect(result.isSubscribed).toBe(false);
      expect(result.status).toBe(ChatMemberStatus.Left);
      expect(result.isAdmin).toBe(false);
    });

    it('should return not subscribed for kicked status', async () => {
      const mockChatMember = {
        status: 'kicked',
        user: {
          id: 777888999,
          is_bot: false,
          first_name: 'Banned',
        },
      };

      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkSubscription(mockBotToken, '@group', 777888999);

      expect(result.isSubscribed).toBe(false);
      expect(result.status).toBe(ChatMemberStatus.Kicked);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Chat not found');
      const mockGetChatMember = jest.fn().mockRejectedValue(mockError);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkSubscription(mockBotToken, '@nonexistent', 123456);

      expect(result.isSubscribed).toBe(false);
      expect(result.status).toBe(ChatMemberStatus.Left);
      expect(result.error).toBe('Chat not found');
    });
  });

  describe('checkMultipleSubscriptions', () => {
    it('should check multiple chats and return aggregated results', async () => {
      const chatIds = ['@channel1', '@channel2', -1001234567890];
      const userId = 123456789;

      const mockResponses = [
        { status: 'member' }, // channel1: subscribed
        { status: 'left' }, // channel2: not subscribed
        { status: 'administrator' }, // supergroup: subscribed as admin
      ];

      let callCount = 0;
      const mockGetChatMember = jest.fn().mockImplementation(() => {
        const response = mockResponses[callCount];
        callCount++;

        return Promise.resolve(response);
      });

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result: BulkSubscriptionCheckResult = await service.checkMultipleSubscriptions(
        mockBotToken,
        chatIds,
        userId,
      );

      expect(result.userId).toBe(userId);
      expect(result.results.size).toBe(3);
      expect(result.isSubscribedToAll).toBe(false);
      expect(result.isSubscribedToAny).toBe(true);
      expect(result.subscribedChats).toHaveLength(2);
      expect(result.subscribedChats).toContain('@channel1');
      expect(result.subscribedChats).toContain(-1001234567890);
      expect(result.unsubscribedChats).toHaveLength(1);
      expect(result.unsubscribedChats).toContain('@channel2');
    });

    it('should return isSubscribedToAll=true when subscribed to all chats', async () => {
      const chatIds = ['@channel1', '@channel2'];
      const userId = 123456789;

      const mockGetChatMember = jest.fn().mockResolvedValue({ status: 'member' });

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkMultipleSubscriptions(mockBotToken, chatIds, userId);

      expect(result.isSubscribedToAll).toBe(true);
      expect(result.isSubscribedToAny).toBe(true);
      expect(result.subscribedChats).toHaveLength(2);
      expect(result.unsubscribedChats).toHaveLength(0);
    });

    it('should return isSubscribedToAny=false when not subscribed to any chat', async () => {
      const chatIds = ['@channel1', '@channel2'];
      const userId = 123456789;

      const mockGetChatMember = jest.fn().mockResolvedValue({ status: 'left' });

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.checkMultipleSubscriptions(mockBotToken, chatIds, userId);

      expect(result.isSubscribedToAll).toBe(false);
      expect(result.isSubscribedToAny).toBe(false);
      expect(result.subscribedChats).toHaveLength(0);
      expect(result.unsubscribedChats).toHaveLength(2);
    });

    it('should handle empty chat list', async () => {
      const result = await service.checkMultipleSubscriptions(mockBotToken, [], 123456);

      expect(result.isSubscribedToAll).toBe(true); // vacuous truth
      expect(result.isSubscribedToAny).toBe(false);
      expect(result.subscribedChats).toHaveLength(0);
      expect(result.unsubscribedChats).toHaveLength(0);
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for administrator', async () => {
      const mockChatMember = { status: 'administrator' };
      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.isUserAdmin(mockBotToken, '@channel', 123456);

      expect(result).toBe(true);
    });

    it('should return true for creator', async () => {
      const mockChatMember = { status: 'creator' };
      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.isUserAdmin(mockBotToken, '@channel', 123456);

      expect(result).toBe(true);
    });

    it('should return false for regular member', async () => {
      const mockChatMember = { status: 'member' };
      const mockGetChatMember = jest.fn().mockResolvedValue(mockChatMember);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.isUserAdmin(mockBotToken, '@channel', 123456);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockGetChatMember = jest.fn().mockRejectedValue(new Error('API error'));

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMember: mockGetChatMember,
        },
      }));

      const result = await service.isUserAdmin(mockBotToken, '@channel', 123456);

      expect(result).toBe(false);
    });
  });

  describe('getChatInfo', () => {
    it('should retrieve channel information', async () => {
      const mockChat = {
        id: -1001234567890,
        type: 'channel',
        title: 'Test Channel',
        username: 'testchannel',
      };

      const mockGetChat = jest.fn().mockResolvedValue(mockChat);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChat: mockGetChat,
        },
      }));

      const result = await service.getChatInfo(mockBotToken, '@testchannel');

      expect(result.id).toBe(-1001234567890);
      expect(result.type).toBe(ChatType.Channel);
      expect(result.title).toBe('Test Channel');
      expect(result.username).toBe('testchannel');
    });

    it('should retrieve supergroup information', async () => {
      const mockChat = {
        id: -1009876543210,
        type: 'supergroup',
        title: 'Test Supergroup',
        username: 'testsupergroup',
        is_forum: true,
      };

      const mockGetChat = jest.fn().mockResolvedValue(mockChat);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChat: mockGetChat,
        },
      }));

      const result = await service.getChatInfo(mockBotToken, -1009876543210);

      expect(result.type).toBe(ChatType.SUPERGROUP);
      expect(result.isForum).toBe(true);
    });

    it('should throw error when chat not found', async () => {
      const mockGetChat = jest.fn().mockRejectedValue(new Error('Chat not found'));

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChat: mockGetChat,
        },
      }));

      await expect(service.getChatInfo(mockBotToken, '@nonexistent')).rejects.toThrow(
        'Failed to retrieve chat information',
      );
    });
  });

  describe('getChatMemberCount', () => {
    it('should retrieve chat member count', async () => {
      const mockGetChatMemberCount = jest.fn().mockResolvedValue(1234);

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMemberCount: mockGetChatMemberCount,
        },
      }));

      const result = await service.getChatMemberCount(mockBotToken, '@testchannel');

      expect(result).toBe(1234);
      expect(mockGetChatMemberCount).toHaveBeenCalledWith('@testchannel');
    });

    it('should throw error when API call fails', async () => {
      const mockGetChatMemberCount = jest.fn().mockRejectedValue(new Error('API error'));

      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getChatMemberCount: mockGetChatMemberCount,
        },
      }));

      await expect(service.getChatMemberCount(mockBotToken, '@testchannel')).rejects.toThrow(
        'Failed to retrieve chat member count',
      );
    });
  });

  describe('status mapping', () => {
    it('should correctly map all chat member statuses', async () => {
      const statuses = [
        { telegram: 'creator', expected: ChatMemberStatus.Creator },
        { telegram: 'administrator', expected: ChatMemberStatus.Administrator },
        { telegram: 'member', expected: ChatMemberStatus.Member },
        { telegram: 'restricted', expected: ChatMemberStatus.Restricted },
        { telegram: 'left', expected: ChatMemberStatus.Left },
        { telegram: 'kicked', expected: ChatMemberStatus.Kicked },
      ];

      const testStatus = async ({ telegram, expected }: { telegram: string; expected: ChatMemberStatus }) => {
        const mockGetChatMember = jest.fn().mockResolvedValue({ status: telegram });

        (Bot as jest.Mock).mockImplementation(() => ({
          api: {
            getChatMember: mockGetChatMember,
          },
        }));

        const result = await service.checkSubscription(mockBotToken, '@test', 123);
        expect(result.status).toBe(expected);
      };

      // Run tests in parallel
      await Promise.all(statuses.map(testStatus));
    });
  });

  describe('chat type mapping', () => {
    it('should correctly map all chat types', async () => {
      const types = [
        { telegram: 'private', expected: ChatType.Private },
        { telegram: 'group', expected: ChatType.Group },
        { telegram: 'supergroup', expected: ChatType.Supergroup },
        { telegram: 'channel', expected: ChatType.Channel },
      ];

      const testChatType = async ({ telegram, expected }: { telegram: string; expected: ChatType }) => {
        const mockGetChat = jest.fn().mockResolvedValue({
          id: 123,
          type: telegram,
        });

        (Bot as jest.Mock).mockImplementation(() => ({
          api: {
            getChat: mockGetChat,
          },
        }));

        const result = await service.getChatInfo(mockBotToken, 123);
        expect(result.type).toBe(expected);
      };

      // Run tests in parallel
      await Promise.all(types.map(testChatType));
    });
  });
});
