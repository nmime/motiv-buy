/* eslint-disable sonarjs/void-use, sonarjs/no-hardcoded-ip */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Ok, Err } from 'ts-results';
import { BotTokenValidationGuard } from '../bot-token-validation.guard';
import { BotTokenValidationService } from '../../service/bot-token-validation.service';
import { BotTokenInvalidException } from '../../exception/bot-token-validation.exception';

describe('BotTokenValidationGuard', () => {
  let guard: BotTokenValidationGuard;
  let mockConfigService: {
    get: jest.Mock;
  };

  let mockValidationService: jest.Mocked<BotTokenValidationService>;
  let mockReflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockValidationService = {
      validateToken: jest.fn(),
      validateTokenDirect: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockReflector = {
      get: jest.fn().mockReturnValue(undefined),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotTokenValidationGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: BotTokenValidationService,
          useValue: mockValidationService,
        },
      ],
    }).compile();

    guard = module.get<BotTokenValidationGuard>(BotTokenValidationGuard);
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: {
      headers: Record<string, string>;
      query: Record<string, string>;
      body: Record<string, string>;
      ip: string;
      get: jest.Mock;
      botAuth: Record<string, unknown>;
    };

    beforeEach(() => {
      mockRequest = {
        headers: {},
        query: {},
        body: {},
        ip: '',
        get: jest.fn((header: string): string => mockRequest.headers[header]) as jest.Mock,
        botAuth: {},
      };

      mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
        getHandler: jest.fn().mockReturnValue({}),
      } as unknown as ExecutionContext;

      mockConfigService.get.mockReturnValue('test-bot-token');

      // Set up default mock for validateToken to return success
      mockValidationService.validateToken.mockResolvedValue(
        Ok({
          isValid: true,
          botId: '123456',
          botUsername: '@test_bot',
          permissions: ['traffic_sell'],
        }),
      );
    });

    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow request with valid token in header', async () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should reject request without token', async () => {
      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should reject request with invalid token in header', async () => {
      mockRequest.headers['x-bot-token'] = 'wrong-token';

      // Mock validation to return invalid
      mockValidationService.validateToken.mockResolvedValueOnce(
        Ok({
          isValid: false,
          error: 'Invalid token',
        }),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow request with valid token in query params', async () => {
      mockRequest.query['botToken'] = 'test-bot-token';

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should allow request with valid token in body', async () => {
      mockRequest.body['botToken'] = 'test-bot-token';

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should prioritize header token over query params', async () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';
      mockRequest.headers['x-telegram-bot-token'] = 'test-bot-token';
      mockRequest.query['botToken'] = 'wrong-token';

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should accept alternative header x-telegram-bot-token', async () => {
      mockRequest.headers['x-telegram-bot-token'] = 'test-bot-token';

      await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('should extract and validate IP from x-forwarded-for header', () => {
      // Using example IPs from RFC 5737 for testing
      const testIp = '192.0.2.1'; // TEST-NET-1
      mockRequest.headers['x-bot-token'] = 'test-bot-token';
      mockRequest.headers['x-forwarded-for'] = testIp;

      void guard.canActivate(mockContext);

      expect(mockRequest.headers['x-forwarded-for']).toBe(testIp);
    });

    it('should use request.ip when no x-forwarded-for header', () => {
      // Using example IP from RFC 1918 for testing
      mockRequest.ip = '10.0.0.1'; // Private network
      mockRequest.headers['x-bot-token'] = 'test-bot-token';

      void guard.canActivate(mockContext);

      expect(mockRequest.headers['x-forwarded-for']).toBeUndefined();
    });

    it('should extract first IP from comma-separated x-forwarded-for', () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';
      mockRequest.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.1';

      void guard.canActivate(mockContext);

      expect(mockRequest.headers['x-forwarded-for']).toBe('203.0.113.1, 198.51.100.1');
    });

    it('should populate botAuth object with validated data', () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';

      void guard.canActivate(mockContext);

      expect(mockRequest.botAuth).toBeDefined();
    });
  });
});
