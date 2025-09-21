import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BotTokenValidationGuard } from '../bot-token-validation.guard';
import { BotTokenValidationService } from '../../service';
import { BadTokenException, RateLimitException } from '@app/common-exception';
import { Ok, Err } from 'ts-results';

describe('BotTokenValidationGuard', () => {
  let guard: BotTokenValidationGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockTokenValidationService: jest.Mocked<BotTokenValidationService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(async () => {
    const mockReflectorMethods = {
      get: jest.fn(),
    };

    const mockServiceMethods = {
      validateToken: jest.fn(),
    };

    mockRequest = {
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
    };

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotTokenValidationGuard,
        {
          provide: Reflector,
          useValue: mockReflectorMethods,
        },
        {
          provide: BotTokenValidationService,
          useValue: mockServiceMethods,
        },
      ],
    }).compile();

    guard = module.get<BotTokenValidationGuard>(BotTokenValidationGuard);
    mockReflector = module.get(Reflector);
    mockTokenValidationService = module.get(BotTokenValidationService);
    mockExecutionContext = mockContext as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow request when no token and validation is optional', async () => {
      mockReflector.get.mockReturnValueOnce(true); // isOptional
      mockReflector.get.mockReturnValueOnce(false); // isRequired
      mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockTokenValidationService.validateToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no token and validation is required', async () => {
      mockReflector.get.mockReturnValueOnce(false); // isOptional
      mockReflector.get.mockReturnValueOnce(true); // isRequired
      mockReflector.get.mockReturnValueOnce('bot_management'); // operationContext

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow request when no validation is configured', async () => {
      mockReflector.get.mockReturnValueOnce(false); // isOptional
      mockReflector.get.mockReturnValueOnce(false); // isRequired
      mockReflector.get.mockReturnValueOnce(undefined); // operationContext

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockTokenValidationService.validateToken).not.toHaveBeenCalled();
    });

    describe('with valid token in Authorization header', () => {
      beforeEach(() => {
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
      });

      it('should validate token and allow request', async () => {
        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        const validationResponse = {
          isValid: true,
          botId: '123456',
          botUsername: '@test_bot',
          permissions: ['traffic_sell'],
          expiresAt: new Date(),
        };

        mockTokenValidationService.validateToken.mockResolvedValue(Ok(validationResponse));

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockRequest.botAuth).toEqual({
          botId: '123456',
          botUsername: '@test_bot',
          permissions: ['traffic_sell'],
          expiresAt: validationResponse.expiresAt,
          metadata: undefined,
        });
      });

      it('should throw UnauthorizedException for invalid token', async () => {
        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        const validationResponse = {
          isValid: false,
          error: 'Invalid token',
        };

        mockTokenValidationService.validateToken.mockResolvedValue(Ok(validationResponse));

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
      });

      it('should throw specific error for rate limiting', async () => {
        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Err(new RateLimitException('Rate limit exceeded')));

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(RateLimitException);
      });
    });

    describe('token extraction from different sources', () => {
      it('should extract token from X-Bot-Token header', async () => {
        mockRequest.headers['x-bot-token'] = '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          {
            token: '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
            operationContext: 'traffic_sell',
          },
          '127.0.0.1',
        );
      });

      it('should extract token from query parameter', async () => {
        mockRequest.query.bot_token = '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          expect.objectContaining({
            token: '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
          }),
          '127.0.0.1',
        );
      });

      it('should extract token from request body', async () => {
        mockRequest.body.botToken = '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true);
        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          expect.objectContaining({
            token: '123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
          }),
          '127.0.0.1',
        );
      });

      it('should prioritize Authorization header over other sources', async () => {
        mockRequest.headers.authorization = 'Bot 111111:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
        mockRequest.headers['x-bot-token'] = '222222:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
        mockRequest.query.bot_token = '333333:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '111111' }));

        await guard.canActivate(mockExecutionContext);

        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          expect.objectContaining({
            token: '111111:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK',
          }),
          '127.0.0.1',
        );
      });
    });

    describe('IP address extraction', () => {
      it('should extract IP from X-Forwarded-For header', async () => {
        mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        await guard.canActivate(mockExecutionContext);

        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          expect.any(Object),
          '192.168.1.1', // First IP from forwarded header
        );
      });

      it('should extract IP from X-Real-IP header', async () => {
        mockRequest.headers['x-real-ip'] = '203.0.113.1';
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        await guard.canActivate(mockExecutionContext);

        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(expect.any(Object), '203.0.113.1');
      });

      it('should fallback to request.ip', async () => {
        mockRequest.ip = '198.51.100.1';
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(true); // isOptional

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        await guard.canActivate(mockExecutionContext);

        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(expect.any(Object), '198.51.100.1');
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';
        mockReflector.get.mockReturnValueOnce(true); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('traffic_sell'); // operationContext
      });

      it('should handle service errors gracefully', async () => {
        mockTokenValidationService.validateToken.mockRejectedValue(new Error('Service unavailable'));

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
      });

      it('should re-throw specific auth errors', async () => {
        mockTokenValidationService.validateToken.mockResolvedValue(Err(new BadTokenException('Bad token')));

        await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(BadTokenException);
      });

      it('should handle malformed Authorization header', async () => {
        mockRequest.headers.authorization = 'Bearer invalid-format';

        const result = await guard.canActivate(mockExecutionContext);

        expect(result).toBe(true); // Should allow since validation is optional
        expect(mockTokenValidationService.validateToken).not.toHaveBeenCalled();
      });
    });

    describe('metadata extraction', () => {
      it('should pass correct operation context to validation service', async () => {
        mockRequest.headers.authorization = 'Bot 123456:AAFdqTcLreQksK5d_oM4c9ZhLNbxFV9qHlK';

        mockReflector.get.mockReturnValueOnce(false); // isOptional
        mockReflector.get.mockReturnValueOnce(false); // isRequired
        mockReflector.get.mockReturnValueOnce('bot_management'); // operationContext

        mockTokenValidationService.validateToken.mockResolvedValue(Ok({ isValid: true, botId: '123456' }));

        await guard.canActivate(mockExecutionContext);

        expect(mockTokenValidationService.validateToken).toHaveBeenCalledWith(
          expect.objectContaining({
            operationContext: 'bot_management',
          }),
          expect.any(String),
        );
      });
    });
  });
});
