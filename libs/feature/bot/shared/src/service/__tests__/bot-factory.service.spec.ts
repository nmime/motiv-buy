/* eslint-disable sonarjs/no-nested-functions */
import { Test, TestingModule } from '@nestjs/testing';
import { BotFactoryService } from '../bot-factory.service';
import { BotInstanceOptions, BotSessionContext, BotValidationResult } from '../bot-factory.types';
import { Bot } from 'grammy';

// Mock Grammy Bot
jest.mock('grammy', () => {
  return {
    Bot: jest.fn().mockImplementation((_token: string, _options?: unknown) => {
      const mockBot = {
        api: {
          getMe: jest.fn(),
        },
        use: jest.fn(),
        catch: jest.fn(),
      };

      return mockBot;
    }),
  };
});

describe('BotFactoryService', () => {
  let service: BotFactoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [BotFactoryService],
    }).compile();

    service = module.get<BotFactoryService>(BotFactoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBot', () => {
    it('should create a bot instance with valid token', () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const options: BotInstanceOptions = {
        enableSession: true,
        enableRetry: true,
        apiTimeout: 5000,
      };

      const bot = service.createBot(token, options);

      expect(bot).toBeDefined();
      expect(Bot).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          client: expect.objectContaining({
            timeoutSeconds: 5,
          }),
        }),
      );
    });

    it('should create a bot instance with default options', () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

      const bot = service.createBot(token);

      expect(bot).toBeDefined();
      expect(Bot).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          client: expect.objectContaining({
            timeoutSeconds: 30,
          }),
        }),
      );
    });

    it('should apply custom API root when provided', () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const options: BotInstanceOptions = {
        apiRoot: 'http://localhost:8081',
      };

      const bot = service.createBot(token, options);

      expect(bot).toBeDefined();
      expect(Bot).toHaveBeenCalledWith(
        token,
        expect.objectContaining({
          client: expect.objectContaining({
            apiRoot: 'http://localhost:8081',
          }),
        }),
      );
    });

    it('should throw error when token is empty', () => {
      expect(() => service.createBot('')).toThrow('Bot token is required');
    });

    it('should throw error when token is whitespace', () => {
      expect(() => service.createBot('   ')).toThrow('Bot token is required');
    });

    it('should apply error handling middleware', () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const bot = service.createBot(token);

      expect(bot.catch).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('createUnauthenticatedBot', () => {
    it('should create an unauthenticated bot instance', () => {
      const bot = service.createUnauthenticatedBot();

      expect(bot).toBeDefined();
      expect(Bot).toHaveBeenCalledWith('UNAUTHENTICATED');
    });

    it('should apply middleware to unauthenticated bot', () => {
      const bot = service.createUnauthenticatedBot();

      expect(bot.catch).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should accept options for unauthenticated bot', () => {
      const options: BotInstanceOptions = {
        apiTimeout: 10000,
      };

      const bot = service.createUnauthenticatedBot(options);

      expect(bot).toBeDefined();
    });
  });

  describe('validateBotToken', () => {
    it('should return valid result for valid token', async () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const mockBotInfo = {
        id: 123456789,
        username: 'test_bot',
        first_name: 'Test Bot',
        is_bot: true,
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: true,
        can_connect_to_business: false,
      };

      // Mock the Bot constructor and getMe method
      const mockGetMe = jest.fn().mockResolvedValue(mockBotInfo);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getMe: mockGetMe,
        },
      }));

      const result: BotValidationResult = await service.validateBotToken(token);

      expect(result.isValid).toBe(true);
      expect(result.botInfo).toBeDefined();
      expect(result.botInfo?.id).toBe(123456789);
      expect(result.botInfo?.username).toBe('test_bot');
      expect(result.botInfo?.firstName).toBe('Test Bot');
      expect(result.botInfo?.isBot).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return invalid result for empty token', async () => {
      const result = await service.validateBotToken('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Bot token is empty or undefined');
      expect(result.errorCode).toBe('EMPTY_TOKEN');
      expect(result.botInfo).toBeUndefined();
    });

    it('should return invalid result for unauthorized token', async () => {
      const token = 'invalid_token';
      const mockError = new Error('401: Unauthorized');

      const mockGetMe = jest.fn().mockRejectedValue(mockError);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getMe: mockGetMe,
        },
      }));

      const result = await service.validateBotToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('401: Unauthorized');
      expect(result.errorCode).toBe('401');
      expect(result.botInfo).toBeUndefined();
    });

    it('should handle network errors', async () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const mockError = new Error('network failed');

      const mockGetMe = jest.fn().mockRejectedValue(mockError);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getMe: mockGetMe,
        },
      }));

      const result = await service.validateBotToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('network failed');
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should handle rate limit errors', async () => {
      const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      const mockError = new Error('429: Too Many Requests');

      const mockGetMe = jest.fn().mockRejectedValue(mockError);
      (Bot as jest.Mock).mockImplementation(() => ({
        api: {
          getMe: mockGetMe,
        },
      }));

      const result = await service.validateBotToken(token);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('429');
    });
  });

  describe('getBotInfo', () => {
    it('should retrieve bot information successfully', async () => {
      const mockBotInfo = {
        id: 987654321,
        username: 'my_bot',
        first_name: 'My Bot',
        is_bot: true,
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: false,
        can_connect_to_business: false,
      };

      const mockBot = {
        api: {
          getMe: jest.fn().mockResolvedValue(mockBotInfo),
        },
      } as unknown as Bot;

      const result = await service.getBotInfo(mockBot as unknown as Bot<BotSessionContext>);

      expect(result).toBeDefined();
      expect(result.id).toBe(987654321);
      expect(result.username).toBe('my_bot');
      expect(result.firstName).toBe('My Bot');
      expect(result.isBot).toBe(true);
      expect(result.canJoinGroups).toBe(true);
      expect(result.canReadAllGroupMessages).toBe(true);
      expect(result.supportsInlineQueries).toBe(false);
    });

    it('should throw error when getMe fails', async () => {
      const mockError = new Error('API error');
      const mockBot = {
        api: {
          getMe: jest.fn().mockRejectedValue(mockError),
        },
      } as unknown as Bot;

      await expect(service.getBotInfo(mockBot as unknown as Bot<BotSessionContext>)).rejects.toThrow(
        'Failed to retrieve bot information',
      );
    });
  });

  describe('error code extraction', () => {
    it('should extract error code from different error types', async () => {
      const testCases = [
        { error: new Error('400: Bad Request'), expectedCode: '400' },
        { error: new Error('401: Unauthorized'), expectedCode: '401' },
        { error: new Error('403: Forbidden'), expectedCode: '403' },
        { error: new Error('404: Not Found'), expectedCode: '404' },
        { error: new Error('timeout occurred'), expectedCode: 'TIMEOUT' },
        { error: new Error('network failure'), expectedCode: 'NETWORK_ERROR' },
        { error: new Error('Something went wrong'), expectedCode: 'UNKNOWN_ERROR' },
      ];

      const testErrorCode = async (testCase: { error: Error; expectedCode: string }) => {
        const mockGetMe = jest.fn().mockRejectedValue(testCase.error);
        (Bot as jest.Mock).mockImplementation(() => ({
          api: {
            getMe: mockGetMe,
          },
        }));

        const result = await service.validateBotToken('test_token');
        expect(result.errorCode).toBe(testCase.expectedCode);
      };

      // Run tests in parallel
      await Promise.all(testCases.map(testErrorCode));
    });
  });
});
