import { Test, TestingModule } from '@nestjs/testing';
import { RedisClient } from '@app/common-redis';
import { BotFactoryService } from '@app/feature-bot-shared';
import { BotTokenValidationService } from '../bot-token-validation.service';
import { BotTokenValidationDto } from '../../dto';
import { BotTokenInvalidException, BotTokenRateLimitException } from '../../exception/bot-token-validation.exception';

describe('BotTokenValidationService', () => {
  let service: BotTokenValidationService;
  let mockRedisClient: jest.Mocked<RedisClient>;
  let mockBotFactoryService: jest.Mocked<BotFactoryService>;

  const validToken = '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
  const invalidToken = 'invalid-token';

  // Extract mock bot validation result to avoid duplication
  const mockBotValidationResult = {
    isValid: true,
    botInfo: {
      id: 123456,
      isBot: true,
      username: 'testbot',
      firstName: 'Test Bot',
      canJoinGroups: true,
      canReadAllGroupMessages: false,
      supportsInlineQueries: true,
    },
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    const mockBotFactory = {
      validateBotToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotTokenValidationService,
        {
          provide: 'RedisInjectToken',
          useValue: mockRedis,
        },
        {
          provide: BotFactoryService,
          useValue: mockBotFactory,
        },
      ],
    }).compile();

    service = module.get<BotTokenValidationService>(BotTokenValidationService);
    mockRedisClient = module.get('RedisInjectToken');
    mockBotFactoryService = module.get(BotFactoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    const dto: BotTokenValidationDto = {
      token: validToken,
      operationContext: 'traffic_sell',
    };

    it('should validate token successfully with no cache', async () => {
      // Mock Redis cache miss
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      // Mock rate limiting
      mockRedisClient.incr.mockResolvedValue(1);

      // Mock bot factory validation
      mockBotFactoryService.validateBotToken.mockResolvedValue(mockBotValidationResult);

      const result = await service.validateToken(dto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.isValid).toBe(true);
        expect(result.val.botId).toBe('123456');
        expect(result.val.permissions).toContain('traffic_sell');
      }
    });

    it('should return cached validation result', async () => {
      const cachedResult = {
        isValid: true,
        botId: '123456',
        permissions: ['traffic_sell'],
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.validateToken(dto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toEqual(cachedResult);
      }

      // Should not call validation logic
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid token format', async () => {
      const invalidDto: BotTokenValidationDto = {
        token: invalidToken,
        operationContext: 'traffic_sell',
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.validateToken(invalidDto);

      expect(result.err).toBe(true);
      if (result.err) {
        const error = result.val;
        expect(error).toBeInstanceOf(BotTokenInvalidException);
        expect(error.message).toContain('Invalid token format');
      }
    });

    it('should handle rate limiting', async () => {
      const clientIp = '127.0.0.1';

      // Mock rate limit exceeded
      mockRedisClient.incr.mockResolvedValue(101); // Over limit of 100
      mockRedisClient.ttl.mockResolvedValue(30);

      const result = await service.validateToken(dto, clientIp);

      expect(result.err).toBe(true);
      if (result.err) {
        const error = result.val;
        expect(error).toBeInstanceOf(BotTokenRateLimitException);
        expect(error.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle rate limiting setup for new IP', async () => {
      const clientIp = '127.0.0.1';

      // Mock first request from IP
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      // Mock bot factory validation
      mockBotFactoryService.validateBotToken.mockResolvedValue(mockBotValidationResult);

      const result = await service.validateToken(dto, clientIp);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('bot_token_rate_limit:127.0.0.1', 60);
      expect(result.ok).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedisClient.incr.mockResolvedValue(1);

      // Mock bot factory validation
      mockBotFactoryService.validateBotToken.mockResolvedValue(mockBotValidationResult);

      const result = await service.validateToken(dto);

      expect(result.ok).toBe(true); // Should still validate without cache
    });

    it('should handle BotFactoryService validation failure', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.set.mockResolvedValue('OK');

      // Mock bot factory returning invalid token (no error message to use default)
      mockBotFactoryService.validateBotToken.mockResolvedValue({
        isValid: false,
        errorCode: 'UNAUTHORIZED',
        timestamp: new Date(),
      });

      const result = await service.validateToken(dto);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.isValid).toBe(false);
        expect(result.val.error).toBe('Invalid or expired token');
      }
    });
  });

  describe('validateTokenDirect', () => {
    it('should validate token format directly', async () => {
      const dto: BotTokenValidationDto = {
        token: validToken,
        operationContext: 'traffic_sell',
      };

      // Mock bot factory validation
      mockBotFactoryService.validateBotToken.mockResolvedValue(mockBotValidationResult);

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.validateTokenDirect(dto);

      expect(result.isValid).toBe(true);
      expect(result.botId).toBe('123456');
    });

    it('should reject invalid token format directly', async () => {
      const dto: BotTokenValidationDto = {
        token: invalidToken,
        operationContext: 'traffic_sell',
      };

      const result = await service.validateTokenDirect(dto);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid token format');
    });
  });

  describe('isTokenValidationRequired', () => {
    it('should return true for traffic_sell operations', () => {
      expect(service.isTokenValidationRequired('traffic_sell')).toBe(true);
    });

    it('should return true for bot_management operations', () => {
      expect(service.isTokenValidationRequired('bot_management')).toBe(true);
    });

    it('should return true for traffic_analytics operations', () => {
      expect(service.isTokenValidationRequired('traffic_analytics')).toBe(true);
    });

    it('should return false for unknown operations', () => {
      expect(service.isTokenValidationRequired('unknown_operation')).toBe(false);
    });

    it('should return false for undefined operations', () => {
      expect(service.isTokenValidationRequired()).toBe(false);
    });
  });

  describe('getBotPermissions', () => {
    it('should return cached permissions', async () => {
      const permissions = ['traffic_sell', 'traffic_stats'];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(permissions));

      const result = await service.getBotPermissions('123456');

      expect(result).toEqual(permissions);
    });

    it('should return default permissions and cache them', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.getBotPermissions('123456');

      expect(result).toEqual(['traffic_sell', 'traffic_stats', 'bot_management']);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'bot_token_validation:permissions:123456',
        JSON.stringify(['traffic_sell', 'traffic_stats', 'bot_management']),
        'EX',
        600,
      );
    });

    it('should return empty array on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.getBotPermissions('123456');

      expect(result).toEqual([]);
    });
  });

  describe('invalidateToken', () => {
    it('should invalidate token and permissions cache', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.invalidateToken(validToken);

      expect(mockRedisClient.del).toHaveBeenCalledTimes(2); // Token and permissions
    });

    it('should handle invalidation errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.invalidateToken(validToken)).resolves.not.toThrow();
    });
  });

  describe('private methods behavior', () => {
    it('should extract bot ID correctly', async () => {
      const dto: BotTokenValidationDto = {
        token: '987654:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
        operationContext: 'traffic_sell',
      };

      // Mock bot factory validation for different botId
      mockBotFactoryService.validateBotToken.mockResolvedValue({
        isValid: true,
        botInfo: {
          id: 987654,
          isBot: true,
          username: 'testbot2',
          firstName: 'Test Bot 2',
          canJoinGroups: true,
          canReadAllGroupMessages: false,
          supportsInlineQueries: true,
        },
        timestamp: new Date(),
      });

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      // This tests the private extractBotId method indirectly
      await expect(service.validateTokenDirect(dto)).resolves.toMatchObject({
        botId: '987654',
      });
    });

    it('should handle tokens with invalid format gracefully', async () => {
      const dto: BotTokenValidationDto = {
        token: 'no-colon-token',
        operationContext: 'traffic_sell',
      };

      const result = await service.validateTokenDirect(dto);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid token format');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete validation flow with caching', async () => {
      const clientIp = '203.0.113.10';
      const dto: BotTokenValidationDto = {
        token: validToken,
        operationContext: 'traffic_sell',
      };

      // First call - no cache
      mockRedisClient.get.mockResolvedValueOnce(null); // Cache miss
      mockRedisClient.incr.mockResolvedValue(1); // Rate limit OK
      mockRedisClient.set.mockResolvedValue('OK'); // Cache set

      // Mock bot factory validation
      mockBotFactoryService.validateBotToken.mockResolvedValue(mockBotValidationResult);

      const firstResult = await service.validateToken(dto, clientIp);
      expect(firstResult.ok).toBe(true);

      // Second call - with cache
      const cachedResult = {
        isValid: true,
        botId: '123456',
        permissions: ['traffic_sell'],
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResult)); // Cache hit

      const secondResult = await service.validateToken(dto, clientIp);
      expect(secondResult.ok).toBe(true);
      if (secondResult.ok) {
        expect(secondResult.val).toEqual(cachedResult);
      }
    });

    it('should handle bot-shared integration failure gracefully', async () => {
      // This would test the integration with bot-shared when it fails
      // Using a token with non-numeric botId to simulate bot-shared validation failure
      const dto: BotTokenValidationDto = {
        token: 'abc123:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK', // Non-numeric bot ID fails validation
        operationContext: 'traffic_sell',
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.validateToken(dto);

      // Token with non-numeric botId should be rejected during format validation
      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val).toBeInstanceOf(BotTokenInvalidException);
      }
    });
  });
});
