import { Test, TestingModule } from '@nestjs/testing';
import { RedisClient } from '@app/common-redis';
import { BadTokenException, RateLimitException, InternalException } from '@app/common-exception';
import { BotTokenValidationService } from '../bot-token-validation.service';
import { BotTokenValidationDto } from '../../dto';

describe('BotTokenValidationService', () => {
  let service: BotTokenValidationService;
  let mockRedisClient: jest.Mocked<RedisClient>;

  const validToken = '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
  const invalidToken = 'invalid-token';

  beforeEach(async () => {
    const mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotTokenValidationService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<BotTokenValidationService>(BotTokenValidationService);
    mockRedisClient = module.get('REDIS_CLIENT');
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

      const result = await service.validateToken(dto);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.isValid).toBe(true);
        expect(result.value.botId).toBe('123456');
        expect(result.value.permissions).toContain('traffic_sell');
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

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(cachedResult);
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

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(BadTokenException);
        expect(result.error.message).toContain('Invalid token format');
      }
    });

    it('should handle rate limiting', async () => {
      const clientIp = '127.0.0.1';

      // Mock rate limit exceeded
      mockRedisClient.incr.mockResolvedValue(101); // Over limit of 100
      mockRedisClient.ttl.mockResolvedValue(30);

      const result = await service.validateToken(dto, clientIp);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RateLimitException);
        expect(result.error.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle rate limiting setup for new IP', async () => {
      const clientIp = '127.0.0.1';

      // Mock first request from IP
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await service.validateToken(dto, clientIp);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('bot_token_rate_limit:127.0.0.1', 60);
      expect(result.isOk()).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.validateToken(dto);

      expect(result.isOk()).toBe(true); // Should still validate without cache
    });
  });

  describe('validateTokenDirect', () => {
    it('should validate token format directly', async () => {
      const dto: BotTokenValidationDto = {
        token: validToken,
        operationContext: 'traffic_sell',
      };

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
      expect(service.isTokenValidationRequired(undefined)).toBe(false);
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
    it('should extract bot ID correctly', () => {
      const dto: BotTokenValidationDto = {
        token: '987654:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
        operationContext: 'traffic_sell',
      };

      // This tests the private extractBotId method indirectly
      expect(service.validateTokenDirect(dto)).resolves.toMatchObject({
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
      const clientIp = '192.168.1.1';

      // First call - no cache
      mockRedisClient.get.mockResolvedValueOnce(null); // Cache miss
      mockRedisClient.incr.mockResolvedValue(1); // Rate limit OK
      mockRedisClient.set.mockResolvedValue('OK'); // Cache set

      const firstResult = await service.validateToken(dto, clientIp);
      expect(firstResult.isOk()).toBe(true);

      // Second call - with cache
      const cachedResult = {
        isValid: true,
        botId: '123456',
        permissions: ['traffic_sell'],
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResult)); // Cache hit

      const secondResult = await service.validateToken(dto, clientIp);
      expect(secondResult.isOk()).toBe(true);
      if (secondResult.isOk()) {
        expect(secondResult.value).toEqual(cachedResult);
      }
    });

    it('should handle bot-shared integration failure gracefully', async () => {
      // This would test the integration with bot-shared when it fails
      const dto: BotTokenValidationDto = {
        token: '999999:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK', // Non-existent bot
        operationContext: 'traffic_sell',
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.validateToken(dto);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should return invalid validation due to bot-shared integration failure
        expect(result.value.isValid).toBe(false);
      }
    });
  });
});
