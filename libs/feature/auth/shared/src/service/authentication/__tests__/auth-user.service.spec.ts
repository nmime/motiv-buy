/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars, sonarjs/no-dead-store, no-await-in-loop */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AuthUserService } from '../auth-user.service';
import { AuthCreateUserService } from '../auth-create-user.service';
import { AuthUserVisitService } from '../auth-user-visit.service';
import { getGeoByIp, GetSourceParamsService, GetUserRefLinkService, SourceRegisterService } from '../../../source';
import {
  UserEntity,
  UserLastAuthRepository,
  UserRepository,
  UserSourceVisitEntity,
  UserRefLinkType,
} from '@app/database';
import { Language } from '@app/common-shared';
import { LinkType } from '../../../source/const/link-type.enum';

// Mock the getGeoByIp utility
jest.mock('../../../source', () => ({
  ...jest.requireActual('../../../source'),
  getGeoByIp: jest.fn().mockReturnValue({
    country: { name: 'United States', code: 'US' },
    city: 'New York',
    continent: 'North America',
  }),
}));

describe('AuthUserService', () => {
  let service: AuthUserService;
  let module: TestingModule;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUserLastAuthRepository: jest.Mocked<UserLastAuthRepository>;
  let mockCreateUserService: jest.Mocked<AuthCreateUserService>;
  let mockUserVisitService: jest.Mocked<AuthUserVisitService>;
  let mockSourceRegisterService: jest.Mocked<SourceRegisterService>;
  let mockGetSourceParamsService: jest.Mocked<GetSourceParamsService>;
  let mockGetUserRefLinkService: jest.Mocked<GetUserRefLinkService>;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let loggerSpy: jest.SpyInstance;

  const mockTelegramAuthParams: any = {
    telegramId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    languageCode: 'en',
    ip: '203.0.113.1', // Use documentation IP address instead of private range
    userSource: 'telegram',
    sourceParams: {
      linkType: LinkType.Referral,
      linkCode: 'ABC123',
      refCode: 'REF456',
    },
  };

  const createMockUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: 'user-123',
      telegramId: '123456789',
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      language: 'en',
      isActive: true,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z'),
      ...overrides,
    }) as UserEntity;

  const createMockUserRefLink = (): any => ({
    id: 'ref-link-123',
    type: UserRefLinkType.User,
    userId: 'ref-user-123',
    refCode: 'REF456',
    refCodeUniqueKey: 'REF456',
    defaultUniqueKey: 'default',
    refPercentLevel1: '10',
    refPercentLevel2: '1',
    refPercentLevel3: '0',
    isDefault: false,
    isCustom: false,
    isDeleted: false,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
  });

  const createMockUserLastAuth = (): any => ({
    id: 'last-auth-123',
    ip: '203.0.113.1',
    country: 'United States',
    city: 'New York',
    continent: 'North America',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    user: { id: 'user-123' },
  });

  beforeEach(async () => {
    // Setup mocks
    mockEntityManager = {
      transactional: jest.fn(),
      nativeUpdate: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      getEntityManager: jest.fn(() => mockEntityManager),
    } as any;

    mockUserLastAuthRepository = {
      upsertUserLastAuth: jest.fn(),
    } as any;

    mockCreateUserService = {
      createUser: jest.fn(),
      determineLanguage: jest.fn(),
    } as any;

    mockUserVisitService = {
      registerVisit: jest.fn(),
    } as any;

    mockSourceRegisterService = {} as any;

    mockGetSourceParamsService = {
      parseRequest: jest.fn(),
    } as any;

    mockGetUserRefLinkService = {
      resolveUserRefLink: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        AuthUserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserLastAuthRepository, useValue: mockUserLastAuthRepository },
        { provide: AuthCreateUserService, useValue: mockCreateUserService },
        { provide: AuthUserVisitService, useValue: mockUserVisitService },
        { provide: SourceRegisterService, useValue: mockSourceRegisterService },
        { provide: GetSourceParamsService, useValue: mockGetSourceParamsService },
        { provide: GetUserRefLinkService, useValue: mockGetUserRefLinkService },
      ],
    }).compile();

    service = module.get<AuthUserService>(AuthUserService);

    // Mock logger methods
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    jest.clearAllMocks();
  });

  describe('Service Definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service['usersRepository']).toBeDefined();
      expect(service['userLastAuthRepository']).toBeDefined();
      expect(service['createUserService']).toBeDefined();
      expect(service['userVisitService']).toBeDefined();
      expect(service['sourceRegisterService']).toBeDefined();
      expect(service['getSourceParamsService']).toBeDefined();
      expect(service['getUserRefLinkService']).toBeDefined();
    });
  });

  describe('findOrCreateByWebAuth', () => {
    it('should find existing user successfully', async () => {
      const existingUser = createMockUser();
      const mockVisit = { id: 'visit-123' } as UserSourceVisitEntity;

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockGetSourceParamsService.parseRequest.mockReturnValue(mockTelegramAuthParams.sourceParams);
      mockGetUserRefLinkService.resolveUserRefLink.mockResolvedValue(createMockUserRefLink());
      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserVisitService.registerVisit.mockResolvedValue(mockVisit);
      mockUserLastAuthRepository.upsertUserLastAuth.mockResolvedValue(createMockUserLastAuth());

      const result = await service.findOrCreateByWebAuth(mockTelegramAuthParams, {
        trackUserVisit: true,
        trackUserLastAuth: true,
      });

      expect(result).toEqual(existingUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        telegramId: mockTelegramAuthParams.telegramId,
      });

      expect(mockUserVisitService.registerVisit).toHaveBeenCalled();
      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalled();
    });

    it('should create new user when not found', async () => {
      const newUser = createMockUser();
      const mockUserRefLink = createMockUserRefLink();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockGetSourceParamsService.parseRequest.mockReturnValue(mockTelegramAuthParams.sourceParams);
      mockGetUserRefLinkService.resolveUserRefLink.mockResolvedValue(mockUserRefLink);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockCreateUserService.createUser.mockResolvedValue(newUser);

      const result = await service.findOrCreateByWebAuth(mockTelegramAuthParams);

      expect(result).toEqual(newUser);
      expect(mockCreateUserService.createUser).toHaveBeenCalledWith(
        mockTelegramAuthParams,
        mockEntityManager,
        mockUserRefLink,
      );
    });

    it('should handle missing source parameters', async () => {
      const existingUser = createMockUser();
      const paramsWithoutSource = { ...mockTelegramAuthParams, userSource: undefined, sourceParams: undefined };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByWebAuth(paramsWithoutSource);

      expect(result).toEqual(existingUser);
      expect(mockGetSourceParamsService.parseRequest).not.toHaveBeenCalled();
      expect(mockGetUserRefLinkService.resolveUserRefLink).not.toHaveBeenCalled();
    });

    it('should handle invalid ref link resolution', async () => {
      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockGetSourceParamsService.parseRequest.mockReturnValue(mockTelegramAuthParams.sourceParams);
      mockGetUserRefLinkService.resolveUserRefLink.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByWebAuth(mockTelegramAuthParams);

      expect(result).toEqual(existingUser);
      expect(mockGetUserRefLinkService.resolveUserRefLink).toHaveBeenCalled();
    });
  });

  describe('findOrCreateByBot', () => {
    it('should handle bot-specific options correctly', async () => {
      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockGetSourceParamsService.parseRequest.mockReturnValue(mockTelegramAuthParams.sourceParams);
      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockEntityManager.nativeUpdate.mockResolvedValue(1);

      const result = await service.findOrCreateByBot(mockTelegramAuthParams, {
        trackUserVisit: true, // Now respects caller's choice
        trackAnalytics: true,
        trackUserLastAuth: true,
        updateUserFields: true,
      });

      expect(result).toEqual(existingUser);
      expect(mockUserVisitService.registerVisit).toHaveBeenCalled(); // Should track visits when requested
      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalled(); // Should track last auth when requested
    });

    it('should update user fields when updateUserFields is true', async () => {
      const existingUser = createMockUser({ firstName: 'OldName' });
      const updatedParams = { ...mockTelegramAuthParams, firstName: 'NewName' };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockEntityManager.nativeUpdate.mockResolvedValue(1);

      await service.findOrCreateByBot(updatedParams);

      expect(mockEntityManager.nativeUpdate).toHaveBeenCalledWith(
        UserEntity,
        { id: existingUser.id },
        expect.objectContaining({
          firstName: 'NewName',
        }),
      );
    });

    it('should not update fields if no changes detected', async () => {
      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await service.findOrCreateByBot(mockTelegramAuthParams);

      expect(mockEntityManager.nativeUpdate).not.toHaveBeenCalled();
    });
  });

  describe('User Field Updates', () => {
    it('should detect and apply field changes', async () => {
      const existingUser = createMockUser({
        firstName: 'OldFirst',
        lastName: 'OldLast',
        username: 'oldusername',
        language: undefined,
      });

      const updatedParams = {
        ...mockTelegramAuthParams,
        firstName: 'NewFirst',
        lastName: 'NewLast',
        username: 'newusername',
        languageCode: 'es',
      };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockCreateUserService.determineLanguage.mockReturnValue(Language.Spanish);
      mockEntityManager.nativeUpdate.mockResolvedValue(1);

      await service.findOrCreateByBot(updatedParams);

      expect(mockEntityManager.nativeUpdate).toHaveBeenCalledWith(
        UserEntity,
        { id: existingUser.id },
        {
          firstName: 'NewFirst',
          lastName: 'NewLast',
          username: 'newusername',
          language: 'es',
        },
      );
    });

    it('should preserve existing language when present', async () => {
      const existingUser = createMockUser({ language: 'fr' });

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await service.findOrCreateByBot(mockTelegramAuthParams);

      expect(mockCreateUserService.determineLanguage).not.toHaveBeenCalled();
      expect(mockEntityManager.nativeUpdate).not.toHaveBeenCalled();
    });

    it('should handle null values in update params', async () => {
      const existingUser = createMockUser();
      const paramsWithNulls: any = {
        ...mockTelegramAuthParams,
        firstName: null,
        lastName: undefined,
        username: '',
      };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await service.findOrCreateByBot(paramsWithNulls);

      expect(mockEntityManager.nativeUpdate).not.toHaveBeenCalled();
    });
  });

  describe('User Last Auth Updates', () => {
    it('should update user last auth with geo information', async () => {
      const existingUser = createMockUser();
      const mockGeoData = {
        country: { name: 'United States' },
        city: 'New York',
        continent: 'North America',
      };

      (getGeoByIp as jest.Mock).mockReturnValue(mockGeoData);

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserLastAuthRepository.upsertUserLastAuth.mockResolvedValue(createMockUserLastAuth());

      await service.findOrCreateByWebAuth(mockTelegramAuthParams, {
        trackUserLastAuth: true,
      });

      expect(getGeoByIp).toHaveBeenCalledWith(mockTelegramAuthParams.ip);
      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalledWith(
        {
          userId: existingUser.id,
          ip: mockTelegramAuthParams.ip,
          country: 'United States',
          city: 'New York',
          continent: 'North America',
        },
        mockEntityManager,
      );
    });

    it('should handle geo service errors gracefully', async () => {
      const existingUser = createMockUser();

      (getGeoByIp as jest.Mock).mockImplementation(() => {
        throw new Error('Geo service unavailable');
      });

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserLastAuthRepository.upsertUserLastAuth.mockResolvedValue(createMockUserLastAuth());

      await service.findOrCreateByWebAuth(mockTelegramAuthParams, {
        trackUserLastAuth: true,
      });

      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalledWith(
        {
          userId: existingUser.id,
          ip: mockTelegramAuthParams.ip,
          country: undefined,
          city: undefined,
          continent: undefined,
        },
        mockEntityManager,
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error while getting geo by ip',
        expect.objectContaining({
          ip: mockTelegramAuthParams.ip,
          error: expect.any(Error),
        }),
      );
    });

    it('should use visit data as fallback for geo information', async () => {
      const existingUser = createMockUser();
      const mockVisit = {
        id: 'visit-123',
        country: 'Canada',
        city: 'Toronto',
        continent: 'North America',
      } as UserSourceVisitEntity;

      (getGeoByIp as jest.Mock).mockReturnValue(null);

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserVisitService.registerVisit.mockResolvedValue(mockVisit);
      mockUserLastAuthRepository.upsertUserLastAuth.mockResolvedValue(createMockUserLastAuth());

      await service.findOrCreateByWebAuth(mockTelegramAuthParams, {
        trackUserVisit: true,
        trackUserLastAuth: true,
      });

      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalledWith(
        {
          userId: existingUser.id,
          ip: mockTelegramAuthParams.ip,
          country: 'Canada',
          city: 'Toronto',
          continent: 'North America',
        },
        mockEntityManager,
      );
    });

    it('should handle missing IP address', async () => {
      const existingUser = createMockUser();
      const paramsWithoutIp = { ...mockTelegramAuthParams, ip: undefined };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserLastAuthRepository.upsertUserLastAuth.mockResolvedValue(createMockUserLastAuth());

      await service.findOrCreateByWebAuth(paramsWithoutIp, {
        trackUserLastAuth: true,
      });

      expect(getGeoByIp).not.toHaveBeenCalled();
      expect(mockUserLastAuthRepository.upsertUserLastAuth).toHaveBeenCalledWith(
        {
          userId: existingUser.id,
          ip: undefined,
          country: undefined,
          city: undefined,
          continent: undefined,
        },
        mockEntityManager,
      );
    });
  });

  describe('Transaction Handling', () => {
    it('should handle transaction failures', async () => {
      const transactionError = new Error('Database transaction failed');

      mockEntityManager.transactional.mockRejectedValue(transactionError);

      await expect(service.findOrCreateByWebAuth(mockTelegramAuthParams)).rejects.toThrow(
        'Database transaction failed',
      );
    });

    it('should rollback on user creation failure', async () => {
      const createUserError = new Error('User creation failed');

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(null);
      mockCreateUserService.createUser.mockRejectedValue(createUserError);

      await expect(service.findOrCreateByWebAuth(mockTelegramAuthParams)).rejects.toThrow('User creation failed');
    });

    it('should handle partial operation failures gracefully', async () => {
      const existingUser = createMockUser();
      const visitError = new Error('Visit registration failed');

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserVisitService.registerVisit.mockRejectedValue(visitError);

      await expect(
        service.findOrCreateByWebAuth(mockTelegramAuthParams, {
          trackUserVisit: true,
        }),
      ).rejects.toThrow('Visit registration failed');
    });
  });

  describe('Source Parameter Handling', () => {
    it('should prefer sourceParams over userSource parsing', async () => {
      const existingUser = createMockUser();
      const directSourceParams: any = {
        linkType: 'direct',
        linkCode: 'DIRECT123',
        refCode: 'DIRECTREF',
      };

      const paramsWithBoth: any = {
        ...mockTelegramAuthParams,
        sourceParams: directSourceParams,
        userSource: 'different-source-string',
      };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockGetUserRefLinkService.resolveUserRefLink.mockResolvedValue(null);

      await service.findOrCreateByWebAuth(paramsWithBoth);

      expect(mockGetSourceParamsService.parseRequest).not.toHaveBeenCalled();
      expect(mockGetUserRefLinkService.resolveUserRefLink).toHaveBeenCalledWith(directSourceParams);
    });

    it('should handle incomplete source parameters', async () => {
      const existingUser = createMockUser();
      const incompleteParams = {
        linkType: LinkType.Referral,
        // Missing linkCode and refCode
      };

      const paramsWithIncomplete: any = {
        ...mockTelegramAuthParams,
        sourceParams: incompleteParams,
      };

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await service.findOrCreateByWebAuth(paramsWithIncomplete);

      expect(mockGetUserRefLinkService.resolveUserRefLink).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures', async () => {
      const dbError = new Error('Database connection lost');

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockRejectedValue(dbError);

      await expect(service.findOrCreateByWebAuth(mockTelegramAuthParams)).rejects.toThrow('Database connection lost');
    });

    it('should handle invalid telegram parameters', async () => {
      const invalidParams = {
        ...mockTelegramAuthParams,
        telegramId: '',
      };

      const newUser = createMockUser({ telegramId: '' });

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(null);
      mockCreateUserService.createUser.mockResolvedValue(newUser);
      mockCreateUserService.determineLanguage.mockReturnValue(Language.English);

      // Service should handle empty telegramId appropriately
      await expect(service.findOrCreateByWebAuth(invalidParams)).resolves.toBeDefined();
    });

    it('should handle concurrent user creation attempts', async () => {
      const newUser = createMockUser();
      let callCount = 0;

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return null; // First call - user doesn't exist
        }

        return newUser; // Second call - user was created by concurrent request
      });

      mockCreateUserService.createUser.mockRejectedValue(new Error('User already exists'));

      // First request should fail, second should find the user
      await expect(service.findOrCreateByWebAuth(mockTelegramAuthParams)).rejects.toThrow('User already exists');
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long input values', async () => {
      const longString = 'a'.repeat(1000);
      const paramsWithLongValues = {
        ...mockTelegramAuthParams,
        firstName: longString,
        lastName: longString,
        username: longString,
      };

      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByWebAuth(paramsWithLongValues);

      expect(result).toEqual(existingUser);
    });

    it('should handle special characters in user data', async () => {
      const paramsWithSpecialChars = {
        ...mockTelegramAuthParams,
        firstName: "John's",
        lastName: 'Müller',
        username: 'user@123',
      };

      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByWebAuth(paramsWithSpecialChars);

      expect(result).toEqual(existingUser);
    });

    it('should handle null and undefined values gracefully', async () => {
      const paramsWithNulls = {
        telegramId: '123456789',
        firstName: null,
        lastName: undefined,
        username: null,
        languageCode: undefined,
        ip: null,
        userSource: undefined,
        sourceParams: null,
      } as any;

      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const result = await service.findOrCreateByWebAuth(paramsWithNulls);

      expect(result).toEqual(existingUser);
    });
  });

  describe('Performance and Memory', () => {
    it('should process operations under performance threshold', async () => {
      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const start = performance.now();
      await service.findOrCreateByWebAuth(mockTelegramAuthParams);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100); // Should complete under 100ms
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const users = Array(10)
        .fill(null)
        .map((_, i) => createMockUser({ telegramId: `user${i}`, id: `user-${i}` }));

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockImplementation(async (criteria: any) => {
        const index = parseInt(criteria.telegramId.replace('user', ''));

        return users[index] || null;
      });

      const requests = Array(10)
        .fill(null)
        .map((_, i) =>
          service.findOrCreateByWebAuth({
            ...mockTelegramAuthParams,
            telegramId: `user${i}`,
          }),
        );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.telegramId).toBe(`user${index}`);
      });
    });

    it('should not leak memory during repeated operations', async () => {
      const existingUser = createMockUser();

      mockEntityManager.transactional.mockImplementation(async (callback) => {
        return await callback(mockEntityManager);
      });

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await service.findOrCreateByWebAuth({
          ...mockTelegramAuthParams,
          telegramId: `user${i}`,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
