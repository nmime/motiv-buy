# Domain Library Specification: Authentication Feature

## Overview

This document outlines the implementation of the authentication domain for the xRocket platform. This serves as a template for documenting domain library specifications following domain-driven design principles.

### Library Type
This is a **domain** library - following xRocket's feature organization:
- **Domain libraries** (`libs/features/*/main` and `libs/features/*/shared`) - Domain-specific business logic
- **Main library** (`libs/features/auth/main`) - Core domain implementation and controllers  
- **Shared library** (`libs/features/auth/shared`) - Reusable utilities, guards, services, and DTOs
- Libraries follow the principle of minimal surface exposure to maintain domain isolation

### Domain Objectives
- Provide comprehensive authentication and authorization for xRocket platform
- Support multiple authentication methods (TMA, Telegram Widget, Dev mode)
- Implement JWT token lifecycle management with Redis caching
- Enable role-based access control and session management
- Integrate referral system tracking and source attribution
- Follow Controller → Mapper -> Service → Repository layers

### Key Technologies
- **Language**: TypeScript with strict type checking
- **Framework**: NestJS with decorators and dependency injection
- **Authentication**: JWT tokens with Passport.js strategies
- **Caching**: Redis for token validation and user state
- **Security**: Rate limiting, IP validation, token revocation
- **Testing**: Jest with comprehensive test coverage
- **Distribution**: Nx domain libraries with proper exports

## Architecture

### Library Structure

Following xRocket's auth domain organization:

```
libs/features/auth/
├── main/                           # Core domain implementation
│   ├── src/
│   │   ├── index.ts               # Public API exports (AuthMainModule, AuthService)
│   │   ├── lib/
│   │   │   ├── auth-main.module.ts # Main NestJS module
│   │   │   ├── service/            # Core authentication services
│   │   │   │   └── auth.service.ts # Primary authentication orchestration
│   │   │   └── controller/         # HTTP controllers (if any)
│   │   └── test/                   # Unit tests for main services
│   ├── package.json               # Main library dependencies
│   ├── tsconfig.json              # TypeScript configuration
│   ├── tsconfig.lib.json          # Library-specific TS config
│   ├── jest.config.ts             # Jest configuration
│   └── project.json               # Nx project configuration
├── shared/                         # Reusable auth utilities and services
│   ├── src/
│   │   ├── index.ts               # Public API exports (minimal surface)
│   │   ├── lib/
│   │   │   ├── auth-shared.module.ts # Shared NestJS module
│   │   │   ├── service/            # Shared authentication services
│   │   │   │   ├── auth-jwt-validation.service.ts
│   │   │   │   ├── auth-user.service.ts
│   │   │   │   ├── auth-composite.service.ts
│   │   │   │   ├── exchange-token-auth.service.ts
│   │   │   │   └── user-tokens-revoke.service.ts
│   │   │   ├── cache/              # Caching services
│   │   │   │   ├── auth-jwt-cache.service.ts
│   │   │   │   ├── auth-blocked-cache.service.ts
│   │   │   │   └── auth-premium-cache.service.ts
│   │   │   ├── guard/              # Authentication guards
│   │   │   │   ├── composite-auth.guard.ts
│   │   │   │   └── exchange-auth.guard.ts
│   │   │   ├── strategy/           # Passport strategies
│   │   │   │   └── composite.strategy.ts
│   │   │   ├── decorator/          # Custom decorators
│   │   │   │   ├── current-user-id.decorator.ts
│   │   │   │   └── auth-jwt-app.decorator.ts
│   │   │   ├── dto/                # Data transfer objects
│   │   │   │   ├── auth-jwt-payload.dto.ts
│   │   │   │   ├── telegram-widget-auth.dto.ts
│   │   │   │   └── auth-result.dto.ts
│   │   │   ├── type/               # Type definitions
│   │   │   │   ├── auth.type.ts
│   │   │   │   └── jwt.type.ts
│   │   │   ├── exception/          # Custom exceptions
│   │   │   │   ├── auth-api-problem.exception.ts
│   │   │   │   └── user-not-found.exception.ts
│   │   │   ├── const/              # Authentication constants
│   │   │   │   ├── jwt.const.ts
│   │   │   │   └── auth.const.ts
│   │   │   └── config/             # Configuration modules
│   │   │       └── auth-config.module.ts
│   │   └── test/                   # Unit tests mirroring structure
│   ├── package.json               # Shared library dependencies
│   ├── tsconfig.json              # TypeScript configuration
│   ├── tsconfig.lib.json          # Library-specific TS config
│   ├── jest.config.ts             # Jest configuration
│   └── project.json               # Nx project configuration
├── CONTEXT.md                      # Comprehensive domain documentation
└── README.md                       # Library overview and usage
```

## Technical Specifications

### 1. Core Authentication Services

#### Main Authentication Service

Primary authentication orchestration service:

```typescript
// libs/features/auth/main/src/lib/service/auth.service.ts
import { Injectable } from '@nestjs/common';
import { AuthResultDto, TmaAuthParams, WidgetAuthParams } from '@app/features-auth-shared';
import { AsyncResult } from '@app/common-result';

@Injectable()
export class AuthService {
  constructor(
    private readonly authUserService: AuthUserService,
    private readonly authCreateUserService: AuthCreateUserService,
    private readonly sourceRegisterService: SourceRegisterService,
  ) {}

  async authDev(userId: string): AsyncResult<AuthResultDto, AuthError> {
    // Development authentication with IP validation
    if (!this.configService.isDev) {
      return Err(new NotInDevModeException());
    }
    return await this.createUserSession(userId, 'dev');
  }

  async authTma(params: TmaAuthParams): AsyncResult<AuthResultDto, AuthError> {
    // Telegram Mini App authentication flow
    const tmaData = await this.validateTmaData(params.url);
    if (!tmaData.isValid) {
      return Err(new InvalidTmaDataException(tmaData.error));
    }
    
    return await this.processAuthentication({
      telegramId: tmaData.user.id,
      authMethod: 'tma',
      sourceParams: params,
    });
  }

  async authTelegramWidget(
    params: WidgetAuthParams
  ): AsyncResult<AuthResultDto, AuthError> {
    // Telegram Widget authentication with hash verification
    const isValidWidget = await this.validateWidgetHash(params.dto);
    if (!isValidWidget) {
      return Err(new InvalidWidgetHashException());
    }
    
    return await this.processAuthentication({
      telegramId: params.dto.id,
      authMethod: 'widget',
      userData: params.dto,
      ip: params.ip,
    });
  }
}
```

#### JWT Validation Service

```typescript
// libs/features/auth/shared/src/lib/service/auth-jwt-validation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AuthJwtPayloadDto, UserData } from '../dto';
import { Result, Ok, Err } from '@app/common-result';
import { AuthValidationError, UserNotFoundException } from '../exception';
import { UserRepository } from '@app/mysql';
import { AuthBlockedCacheService, AuthPremiumCacheService } from '../cache';

@Injectable()
export class AuthJwtValidationService {
  private readonly logger = new Logger(AuthJwtValidationService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly authBlockedCacheService: AuthBlockedCacheService,
    private readonly authPremiumCacheService: AuthPremiumCacheService,
  ) {}

  async validate(
    payload: AuthJwtPayloadDto
  ): Promise<Result<UserData, AuthValidationError>> {
    try {
      // Check if user is blocked (with caching)
      const isBlocked = await this.authBlockedCacheService.isUserBlocked(payload.userId);
      if (isBlocked) {
        return Err(new AuthValidationError('User is blocked'));
      }

      // Get user data with caching
      const user = await this.getUserWithCache(payload.userId);
      if (!user) {
        return Err(new UserNotFoundException(payload.userId));
      }

      // Validate premium status
      const premiumStatus = await this.authPremiumCacheService.getUserPremium(payload.userId);
      
      const userData: UserData = {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        isBlocked: user.isBlocked,
        premiumUntil: premiumStatus?.premiumUntil,
        referralCode: user.referralCode,
      };

      return Ok(userData);
    } catch (error) {
      this.logger.error('JWT validation failed', {
        userId: payload.userId,
        app: payload.app,
        error: error.message,
      });
      
      return Err(new AuthValidationError('Validation failed'));
    }
  }

  private async getUserWithCache(userId: string): Promise<User | null> {
    // Implementation would use caching layer
    return await this.userRepository.findOne({ where: { id: userId } });
  }
}
```

#### Caching Services

Redis-based caching services for performance optimization:

```typescript
// libs/features/auth/shared/src/lib/cache/auth-jwt-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@app/common-redis';
import { AuthJwtPayloadDto, UserData } from '../dto';

@Injectable()
export class AuthJwtCacheService {
  private readonly logger = new Logger(AuthJwtCacheService.name);
  private readonly JWT_CACHE_TTL = 3600; // 1 hour

  constructor(private readonly redisService: RedisService) {}

  async cacheToken(
    jti: string,
    payload: AuthJwtPayloadDto,
    ttl: number = this.JWT_CACHE_TTL
  ): Promise<void> {
    const key = this.getTokenKey(jti);
    await this.redisService.setex(key, ttl, JSON.stringify(payload));
  }

  async getCachedValidation(jti: string): Promise<UserData | null> {
    const key = this.getValidationKey(jti);
    const cached = await this.redisService.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheValidation(
    jti: string,
    userData: UserData,
    ttl: number = this.JWT_CACHE_TTL
  ): Promise<void> {
    const key = this.getValidationKey(jti);
    await this.redisService.setex(key, ttl, JSON.stringify(userData));
  }

  async clearUserTokens(userId: string): Promise<void> {
    const pattern = `jwt:user:${userId}:*`;
    const keys = await this.redisService.keys(pattern);
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  private getTokenKey(jti: string): string {
    return `jwt:token:${jti}`;
  }

  private getValidationKey(jti: string): string {
    return `jwt:validation:${jti}`;
  }
}

// libs/features/auth/shared/src/lib/cache/auth-blocked-cache.service.ts
@Injectable()
export class AuthBlockedCacheService {
  private readonly BLOCKED_CACHE_TTL = 1800; // 30 minutes

  constructor(private readonly redisService: RedisService) {}

  async isUserBlocked(userId: string): Promise<boolean | null> {
    const key = `blocked:${userId}`;
    const cached = await this.redisService.get(key);
    return cached !== null ? cached === 'true' : null;
  }

  async saveIsUserBlocked(
    userId: string,
    isBlocked: boolean,
    ttl: number = this.BLOCKED_CACHE_TTL
  ): Promise<void> {
    const key = `blocked:${userId}`;
    await this.redisService.setex(key, ttl, isBlocked.toString());
  }

  async clearUserStatus(userId: string): Promise<void> {
    const key = `blocked:${userId}`;
    await this.redisService.del(key);
  }
}
```

#### Authentication Guards and Strategies

Passport-based authentication guards and strategies:

```typescript
// libs/features/auth/shared/src/lib/strategy/composite.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthJwtValidationService } from '../service';
import { AuthJwtPayloadDto, UserData } from '../dto';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class CompositeStrategy extends PassportStrategy(Strategy, 'composite') {
  constructor(
    private readonly authJwtValidationService: AuthJwtValidationService,
  ) {
    super();
  }

  async validate(payload: AuthJwtPayloadDto): Promise<UserData> {
    const result = await this.authJwtValidationService.validate(payload);
    
    if (result.err) {
      throw new UnauthorizedException(result.val.message);
    }
    
    return result.val;
  }
}

// libs/features/auth/shared/src/lib/guard/composite-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class CompositeAuthGuard extends AuthGuard('composite') {
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

#### Token Revocation Service

Comprehensive token lifecycle management:

```typescript
// libs/features/auth/shared/src/lib/service/user-tokens-revoke.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AuthJtiCacheService, AuthJwtCacheService } from '../cache';
import { AuthJwtApp } from '../type';

@Injectable()
export class UserTokensRevokeService {
  private readonly logger = new Logger(UserTokensRevokeService.name);

  constructor(
    private readonly authJtiCacheService: AuthJtiCacheService,
    private readonly authJwtCacheService: AuthJwtCacheService,
  ) {}

  async revokeUserTokens(userId: string): Promise<void> {
    try {
      // Get all active tokens for user
      const activeTokens = await this.authJwtCacheService.getUserTokens(userId);
      
      // Mark all JTIs as revoked
      await Promise.all(
        activeTokens.map(token => this.authJtiCacheService.revokeToken(token.jti))
      );
      
      // Clear user-specific auth caches
      await this.authJwtCacheService.clearUserTokens(userId);
      
      this.logger.log(`Revoked ${activeTokens.length} tokens for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to revoke user tokens', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async revokeSpecificToken(jti: string): Promise<void> {
    await this.authJtiCacheService.revokeToken(jti);
    this.logger.log(`Revoked specific token: ${jti}`);
  }

  async revokeTokensByApp(userId: string, app: AuthJwtApp): Promise<void> {
    const userTokens = await this.authJwtCacheService.getUserTokens(userId);
    const appTokens = userTokens.filter(token => token.app === app);
    
    await Promise.all(
      appTokens.map(token => this.authJtiCacheService.revokeToken(token.jti))
    );
    
    this.logger.log(`Revoked ${appTokens.length} ${app} tokens for user ${userId}`);
  }

  async revokePremiumTokens(userId: string): Promise<void> {
    const userTokens = await this.authJwtCacheService.getUserTokens(userId);
    const premiumTokens = userTokens.filter(token => 
      token.premiumUntil && new Date(token.premiumUntil) > new Date()
    );
    
    await Promise.all(
      premiumTokens.map(token => this.authJtiCacheService.revokeToken(token.jti))
    );
    
    this.logger.log(`Revoked ${premiumTokens.length} premium tokens for user ${userId}`);
  }
}
```

### 2. Custom Decorators and DTOs

#### Current User Decorator
```typescript
// libs/features/auth/shared/src/lib/decorator/current-user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserData } from '../dto';

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserData = request.user;
    
    if (!user) {
      throw new Error('User not found in request context');
    }
    
    return user.id;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserData => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserData = request.user;
    
    if (!user) {
      throw new Error('User not found in request context');
    }
    
    return user;
  },
);

// JWT App context decorator
export const CurrentJwtApp = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthJwtApp => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserData = request.user;
    
    if (!user?.jwtApp) {
      throw new Error('JWT app context not found');
    }
    
    return user.jwtApp;
  },
);
```

#### Data Transfer Objects
```typescript
// libs/features/auth/shared/src/lib/dto/auth-jwt-payload.dto.ts
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { AuthJwtApp } from '../type';

export class AuthJwtPayloadDto {
  @IsEnum(AuthJwtApp)
  app!: AuthJwtApp;

  @IsString()
  userId!: string;

  @IsNumber()
  iat!: number;

  @IsNumber()
  exp!: number;

  @IsString()
  jti!: string;

  @IsOptional()
  premiumUntil?: Date;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

// libs/features/auth/shared/src/lib/dto/telegram-widget-auth.dto.ts
export class TelegramWidgetAuthDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsNumber()
  auth_date!: number;

  @IsString()
  hash!: string;
}

// libs/features/auth/shared/src/lib/dto/auth-result.dto.ts
export class AuthResultDto {
  @IsString()
  token!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  premiumUntil?: Date;

  @IsOptional()
  @IsString()
  language?: string;
}
```

### 3. Type Definitions

#### Core Authentication Types
```typescript
// libs/features/auth/shared/src/lib/type/auth.type.ts
export interface UserData {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  isBlocked: boolean;
  premiumUntil?: Date;
  referralCode?: string;
  jwtApp?: AuthJwtApp;
}

export interface TmaAuthParams {
  url: string;
  hostname: string;
  ip?: string;
}

export interface WidgetAuthParams {
  dto: TelegramWidgetAuthDto;
  ip?: string;
}

export interface SourceParams {
  referralCode?: string;
  campaign?: string;
  sourceType?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

// libs/features/auth/shared/src/lib/type/jwt.type.ts
export enum AuthJwtApp {
  MAIN = 'main',
  EXCHANGE = 'exchange',
  API = 'api',
  ADMIN = 'admin'
}

export interface JwtTokenResult {
  token: string;
  payload: AuthJwtPayloadDto;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  userData?: UserData;
}
```

#### Authentication Exception Types
```typescript
// libs/features/auth/shared/src/lib/exception/auth-api-problem.exception.ts
import { ApiProblemException } from '@app/common-exception';

export class AuthApiProblemException extends ApiProblemException {
  constructor(
    message: string,
    code: string,
    status: number = 401,
    metadata?: Record<string, any>
  ) {
    super({
      title: 'Authentication Error',
      detail: message,
      status,
      type: 'authentication-error',
      instance: code,
      extensions: {
        code,
        ...metadata
      }
    });
  }
}

export class UserNotFoundException extends AuthApiProblemException {
  constructor(userId: string) {
    super(
      `User not found: ${userId}`,
      'USER_NOT_FOUND',
      404,
      { userId }
    );
  }
}

export class InvalidTmaDataException extends AuthApiProblemException {
  constructor(reason: string) {
    super(
      `Invalid Telegram Mini App data: ${reason}`,
      'INVALID_TMA_DATA',
      400,
      { reason }
    );
  }
}

export class InvalidWidgetHashException extends AuthApiProblemException {
  constructor() {
    super(
      'Invalid Telegram Widget hash',
      'INVALID_WIDGET_HASH',
      400
    );
  }
}

export class NotInDevModeException extends AuthApiProblemException {
  constructor() {
    super(
      'Development authentication not available',
      'NOT_IN_DEV_MODE',
      403
    );
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthValidationError';
  }
}
```

### 4. Constants and Configuration

#### Authentication Constants
```typescript
// libs/features/auth/shared/src/lib/const/jwt.const.ts
import { JwtModuleOptions } from '@nestjs/jwt';
import { AuthJwtApp } from '../type';

export const JWT_EXPIRATION_SECONDS = 3600; // 1 hour
export const JWT_REFRESH_EXPIRATION_SECONDS = 7 * 24 * 3600; // 7 days

export const authJwtModuleOptions: JwtModuleOptions = {
  secret: process.env.JWT_SECRET || 'default-secret-for-dev',
  signOptions: {
    expiresIn: JWT_EXPIRATION_SECONDS,
    issuer: 'xrocket-platform',
  },
};

export const JWT_APP_CONTEXTS: Record<AuthJwtApp, { name: string; scopes: string[] }> = {
  [AuthJwtApp.MAIN]: {
    name: 'Main Application',
    scopes: ['user.read', 'user.write', 'payments.read'],
  },
  [AuthJwtApp.EXCHANGE]: {
    name: 'Exchange Platform',
    scopes: ['exchange.read', 'exchange.write', 'trading.execute'],
  },
  [AuthJwtApp.API]: {
    name: 'Public API',
    scopes: ['api.read'],
  },
  [AuthJwtApp.ADMIN]: {
    name: 'Administrative Access',
    scopes: ['admin.read', 'admin.write', 'system.manage'],
  },
};

// libs/features/auth/shared/src/lib/const/auth.const.ts
export const CACHE_TTL = {
  JWT_VALIDATION: 3600,     // 1 hour
  USER_BLOCKED: 1800,       // 30 minutes
  USER_PREMIUM: 900,        // 15 minutes
  USER_LANGUAGE: 7200,      // 2 hours
} as const;

export const RATE_LIMITS = {
  AUTH_ATTEMPTS: {
    ttl: 60000,        // 1 minute window
    limit: 10,         // 10 attempts per window
    blockDuration: 300000, // 5 minute block
  },
  API_REQUESTS: {
    ttl: 3600000,      // 1 hour window
    limit: 1000,       // 1000 requests per hour
  },
} as const;
```

### 5. NestJS Module Integration

#### Auth Shared Module

Following dependency injection with service pattern:

```typescript
// libs/features/auth/shared/src/lib/auth-shared.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import { BullModule, BullQueue } from '@app/common-bull';
import { EventBusModule } from '@app/features/event-bus-shared';
import { authJwtModuleOptions } from './const';
import { AuthConfigModule } from './config';
import {
  AuthBlockedCacheService,
  AuthCreateUserService,
  AuthJwtCacheService,
  AuthJwtValidationService,
  AuthLanguageCacheService,
  AuthLegacyService,
  AuthPremiumCacheService,
  AuthUserService,
  AuthUserVisitService,
  ExchangeTokenAuthService,
  GetSourceParamsService,
  GetUserRefLinkService,
  SourceRegisterService,
  ExchangeJwtService,
  UserTokensRevokeService,
  AuthJtiCacheService,
  AuthCompositeService,
} from './service';
import { CompositeStrategy } from './strategy';
import {
  AcceleratorCampaignReferralRepository,
  ChequeRepository,
  CoinCurrencyRepository,
  // ... other repositories
  UserRepository,
} from '@app/mysql';

@Module({
  imports: [
    RedisModule,
    AuthConfigModule,
    JwtModule.register(authJwtModuleOptions),
    BullModule,
    BullModule.registerQueue({
      name: BullQueue.BotMainMenuPush,
      defaultJobOptions: {
        backoff: { type: 'exponential', delay: 500 },
      },
      limiter: { max: 100, duration: 1000 },
    }),
    EventBusModule,
  ],
  providers: [
    // Cache services
    AuthPremiumCacheService,
    AuthBlockedCacheService,
    AuthLanguageCacheService,
    AuthJwtCacheService,
    AuthJtiCacheService,
    
    // Core auth services
    AuthJwtValidationService,
    AuthCreateUserService,
    AuthUserService,
    AuthCompositeService,
    
    // Specialized services
    ExchangeTokenAuthService,
    ExchangeJwtService,
    UserTokensRevokeService,
    AuthLegacyService,
    AuthUserVisitService,
    
    // Referral and source services
    GetSourceParamsService,
    GetUserRefLinkService,
    SourceRegisterService,
    
    // Repositories
    UserRepository,
    // ... other repositories
    
    // Strategies
    CompositeStrategy,
  ],
  exports: [
    // Export main services for use in other modules
    AuthJwtValidationService,
    AuthUserService,
    AuthCompositeService,
    ExchangeTokenAuthService,
    UserTokensRevokeService,
    AuthJwtCacheService,
    CompositeStrategy,
  ],
})
export class AuthSharedModule {}
```

#### Auth Main Module
```typescript
// libs/features/auth/main/src/lib/auth-main.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@app/common-redis';
import { AuthSharedModule, AuthConfigModule, authJwtModuleOptions } from '@app/features-auth-shared';
import { AuthService } from './service';
import {
  AcceleratorCampaignReferralRepository,
  ChequeRepository,
  UserRepository,
  // ... other repositories
} from '@app/mysql';

@Module({
  imports: [
    JwtModule.register(authJwtModuleOptions),
    AuthSharedModule,
    AuthConfigModule,
    RedisModule,
  ],
  providers: [
    AuthService,
    UserRepository,
    // ... other repositories used by main auth service
  ],
  exports: [
    AuthService,
  ],
})
export class AuthMainModule {}
```

## Implementation Plan

### Phase 1: Core Authentication Infrastructure (Week 1)
- [ ] Set up auth domain structure: `libs/features/auth/main` and `libs/features/auth/shared`
- [ ] Implement core service interfaces (AuthService, AuthJwtValidationService)
- [ ] Set up JWT token management with Redis caching
- [ ] Configure NestJS modules with dependency injection
- [ ] Create DTOs and type definitions
- [ ] Unit test foundation for core services

### Phase 2: Multi-Platform Authentication (Week 2)
- [ ] Implement Telegram Mini App (TMA) authentication flow
- [ ] Implement Telegram Widget authentication with hash verification
- [ ] Add development mode authentication with IP restrictions
- [ ] Create comprehensive caching services (JWT, blocked users, premium status)
- [ ] Implement token revocation system with JTI tracking
- [ ] Unit tests for authentication methods

### Phase 3: Guards, Strategies, and Security (Week 3)
- [ ] Implement Passport strategies (CompositeStrategy)
- [ ] Create authentication guards (CompositeAuthGuard, ExchangeAuthGuard)
- [ ] Add rate limiting and throttling protection
- [ ] Implement custom decorators (@CurrentUserId, @CurrentUser)
- [ ] Add comprehensive exception handling
- [ ] Integration tests with mock dependencies

### Phase 4: Referral System and Advanced Features (Week 4)
- [ ] Implement referral tracking and source attribution
- [ ] Add user visit tracking and analytics integration
- [ ] Create exchange-specific authentication services
- [ ] Performance optimization and caching strategies
- [ ] Comprehensive documentation and usage examples
- [ ] Integration testing across multiple applications

## Usage Examples

### Basic Authentication Flow
```typescript
// In an authentication controller
import { Injectable } from '@nestjs/common';
import { AuthService } from '@app/features-auth-main';
import { TmaAuthParams, WidgetAuthParams } from '@app/features-auth-shared';

@Injectable()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async authenticateViaTma(params: TmaAuthParams) {
    const result = await this.authService.authTma({
      url: params.url,
      hostname: params.hostname,
      ip: params.ip,
    });

    if (result.err) {
      throw new UnauthorizedException(result.val.message);
    }

    return {
      token: result.val.token,
      userId: result.val.userId,
      premiumUntil: result.val.premiumUntil,
    };
  }

  async authenticateViaWidget(params: WidgetAuthParams) {
    const result = await this.authService.authTelegramWidget(params);
    
    if (result.err) {
      throw new UnauthorizedException(result.val.message);
    }
    
    return result.val;
  }
}
```

### Guard Integration
```typescript
// In a protected controller
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CompositeAuthGuard, CurrentUserId, CurrentUser } from '@app/features-auth-shared';
import { UserData } from '@app/features-auth-shared';

@Controller('protected')
@UseGuards(CompositeAuthGuard)
export class ProtectedController {
  @Get('profile')
  async getProfile(@CurrentUserId() userId: string) {
    // userId automatically extracted and validated from JWT
    return await this.userService.getProfile(userId);
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: UserData) {
    // Full user data extracted from JWT validation
    return {
      userId: user.id,
      username: user.username,
      isPremium: user.premiumUntil && new Date(user.premiumUntil) > new Date(),
      language: user.language,
    };
  }
}
```

### Token Management
```typescript
// In a user management service
import { Injectable } from '@nestjs/common';
import { UserTokensRevokeService, AuthJwtValidationService } from '@app/features-auth-shared';

@Injectable()
export class UserManagementService {
  constructor(
    private readonly userTokensRevokeService: UserTokensRevokeService,
    private readonly authJwtValidationService: AuthJwtValidationService,
  ) {}

  async blockUser(userId: string): Promise<void> {
    // Block user in database
    await this.userRepository.update(userId, { isBlocked: true });
    
    // Revoke all active tokens
    await this.userTokensRevokeService.revokeUserTokens(userId);
  }

  async validateUserAccess(token: string): Promise<UserData> {
    const payload = this.jwtService.decode(token) as AuthJwtPayloadDto;
    const result = await this.authJwtValidationService.validate(payload);
    
    if (result.err) {
      throw new UnauthorizedException(result.val.message);
    }
    
    return result.val;
  }

  async revokeUserPremiumTokens(userId: string): Promise<void> {
    // When premium expires, revoke premium-enabled tokens
    await this.userTokensRevokeService.revokePremiumTokens(userId);
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('AuthJwtValidationService', () => {
  let service: AuthJwtValidationService;
  let userRepository: jest.Mocked<UserRepository>;
  let authBlockedCacheService: jest.Mocked<AuthBlockedCacheService>;
  let authPremiumCacheService: jest.Mocked<AuthPremiumCacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthJwtValidationService,
        {
          provide: UserRepository,
          useValue: createMockRepository(),
        },
        {
          provide: AuthBlockedCacheService,
          useValue: createMockCacheService(),
        },
        {
          provide: AuthPremiumCacheService,
          useValue: createMockCacheService(),
        },
      ],
    }).compile();

    service = module.get<AuthJwtValidationService>(AuthJwtValidationService);
    userRepository = module.get(UserRepository);
    authBlockedCacheService = module.get(AuthBlockedCacheService);
    authPremiumCacheService = module.get(AuthPremiumCacheService);
  });

  describe('validate', () => {
    it('should validate JWT payload and return user data', async () => {
      const payload: AuthJwtPayloadDto = {
        app: AuthJwtApp.MAIN,
        userId: 'user123',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
        jti: 'jti123',
      };

      const mockUser = {
        id: 'user123',
        telegramId: '123456789',
        username: 'testuser',
        isBlocked: false,
      };

      authBlockedCacheService.isUserBlocked.mockResolvedValue(false);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      authPremiumCacheService.getUserPremium.mockResolvedValue(null);

      const result = await service.validate(payload);

      expect(result.ok).toBe(true);
      expect(result.val.id).toBe('user123');
      expect(result.val.username).toBe('testuser');
      expect(result.val.isBlocked).toBe(false);
    });

    it('should reject blocked user', async () => {
      const payload: AuthJwtPayloadDto = {
        app: AuthJwtApp.MAIN,
        userId: 'blocked-user',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
        jti: 'jti123',
      };

      authBlockedCacheService.isUserBlocked.mockResolvedValue(true);

      const result = await service.validate(payload);

      expect(result.err).toBe(true);
      expect(result.val.message).toContain('User is blocked');
    });

    it('should handle user not found', async () => {
      const payload: AuthJwtPayloadDto = {
        app: AuthJwtApp.MAIN,
        userId: 'nonexistent-user',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
        jti: 'jti123',
      };

      authBlockedCacheService.isUserBlocked.mockResolvedValue(false);
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validate(payload);

      expect(result.err).toBe(true);
      expect(result.val).toBeInstanceOf(UserNotFoundException);
    });
  });
});
```

### Integration Tests
```typescript
describe('Auth Integration', () => {
  let app: INestApplication;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthMainModule, AuthSharedModule],
    }).compile();

    app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    await app.init();
  });

  describe('TMA Authentication Flow', () => {
    it('should authenticate user via TMA', async () => {
      const tmaParams: TmaAuthParams = {
        url: 'https://app.xrocket.com/?tgWebAppData=user%3D%7B%22id%22%3A123456789%7D',
        hostname: 'app.xrocket.com',
        ip: '127.0.0.1',
      };

      const result = await authService.authTma(tmaParams);

      expect(result.ok).toBe(true);
      expect(result.val.token).toBeDefined();
      expect(result.val.userId).toBeDefined();

      // Verify token is valid
      const decoded = jwtService.decode(result.val.token) as AuthJwtPayloadDto;
      expect(decoded.app).toBe(AuthJwtApp.MAIN);
      expect(decoded.userId).toBe(result.val.userId);
    });
  });

  describe('Guard Protection', () => {
    it('should protect endpoints with CompositeAuthGuard', async () => {
      // This would be a full E2E test with HTTP requests
      const validToken = await generateTestToken();
      
      const response = await request(app.getHttpServer())
        .get('/protected/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.userId).toBeDefined();
    });

    it('should reject invalid tokens', async () => {
      await request(app.getHttpServer())
        .get('/protected/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
```


## Security Considerations

### Multi-Layer Security
- **JWT Security**: HMAC-SHA256 signing with configurable expiration and secure secret management
- **Token Revocation**: JTI-based token blacklisting with Redis persistence for immediate invalidation
- **Rate Limiting**: Multi-dimensional throttling (IP, user, endpoint) with exponential backoff
- **Input Validation**: All authentication inputs sanitized and validated before processing
- **Cache Security**: Encrypted cache storage for sensitive authentication data with TTL management

### Authentication Security
- **TMA Validation**: Telegram bot token signature verification with timestamp validation
- **Widget Security**: Hash verification using Telegram bot token with replay attack prevention
- **Development Mode**: IP whitelisting and restricted access for development authentication
- **Session Management**: Secure session creation with correlation ID tracking

### Error Handling and Logging
- No sensitive information (tokens, user data) in error messages or logs
- Consistent error codes for different authentication failures
- Security event logging (failed attempts, blocked users, token revocations)
- Audit trail for authentication events with correlation IDs

## Related Files

### Auth Domain Structure
- `libs/features/auth/main/src/index.ts` - Main module public API (AuthMainModule, AuthService)
- `libs/features/auth/main/src/lib/auth-main.module.ts` - Main NestJS module
- `libs/features/auth/main/src/lib/service/auth.service.ts` - Core authentication service
- `libs/features/auth/shared/src/index.ts` - Shared module public API (minimal surface)
- `libs/features/auth/shared/src/lib/auth-shared.module.ts` - Shared NestJS module
- `libs/features/auth/shared/src/lib/service/` - Shared authentication services
- `libs/features/auth/shared/src/lib/cache/` - Redis-based caching services
- `libs/features/auth/shared/src/lib/guard/` - Authentication guards
- `libs/features/auth/shared/src/lib/strategy/` - Passport strategies
- `libs/features/auth/shared/src/lib/decorator/` - Custom decorators
- `libs/features/auth/shared/src/lib/dto/` - Data transfer objects
- `libs/features/auth/shared/src/lib/type/` - Type definitions
- `libs/features/auth/shared/src/lib/exception/` - Custom exceptions
- `libs/features/auth/shared/src/lib/const/` - Authentication constants
- `libs/features/auth/shared/src/lib/config/` - Configuration modules
- `libs/features/auth/CONTEXT.md` - Comprehensive domain documentation

### Integration Points
- `apps/*/src/` - Applications importing AuthMainModule for authentication
- `libs/features/*/main/src/controller/` - Controllers using authentication guards
- `libs/features/*/main/src/service/` - Services using @CurrentUserId decorator
- `libs/features/auth/main/package.json` - Main library dependencies
- `libs/features/auth/shared/package.json` - Shared library dependencies
- `libs/features/auth/main/project.json` - Nx main project configuration
- `libs/features/auth/shared/project.json` - Nx shared project configuration

## Success Criteria

- [ ] Library can be built without errors

---

*This auth domain specification demonstrates xRocket's architecture principles applied to a comprehensive authentication and authorization system. The structure follows the main/shared library pattern with proper dependency injection, caching strategies, and security best practices for a production-ready financial platform.*
