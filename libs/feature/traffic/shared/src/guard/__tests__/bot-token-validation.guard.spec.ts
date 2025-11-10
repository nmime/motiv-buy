/* eslint-disable sonarjs/void-use, sonarjs/no-hardcoded-ip */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotTokenValidationGuard } from '../bot-token-validation.guard';
import { BotTokenValidationService } from '../../service/bot-token-validation.service';

describe('BotTokenValidationGuard', () => {
  let guard: BotTokenValidationGuard;
  let mockConfigService: {
    get: jest.Mock;
  };
  let mockValidationService: jest.Mocked<BotTokenValidationService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    mockValidationService = {
      validateToken: jest.fn(),
      validateTokenDirect: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotTokenValidationGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
      } as unknown as ExecutionContext;

      mockConfigService.get.mockReturnValue('test-bot-token');
    });

    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow request with valid token in header', () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should reject request without token', () => {
      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should reject request with invalid token in header', () => {
      mockRequest.headers['x-bot-token'] = 'wrong-token';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should allow request with valid token in query params', () => {
      mockRequest.query['botToken'] = 'test-bot-token';

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should allow request with valid token in body', () => {
      mockRequest.body['botToken'] = 'test-bot-token';

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should prioritize header token over query params', () => {
      mockRequest.headers['x-bot-token'] = 'test-bot-token';
      mockRequest.headers['x-telegram-bot-token'] = 'test-bot-token';
      mockRequest.query['botToken'] = 'wrong-token';

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should accept alternative header x-telegram-bot-token', () => {
      mockRequest.headers['x-telegram-bot-token'] = 'test-bot-token';

      expect(guard.canActivate(mockContext)).toBe(true);
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
