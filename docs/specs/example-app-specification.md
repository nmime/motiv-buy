# Application Specification: Authentication Service API

## Overview

This document outlines the implementation of a comprehensive authentication service API for the xRocket platform. This serves as a template for documenting NestJS application specifications using enterprise-grade backend patterns.

### Application Type
This is an **API** application type - one of three application types in xRocket:
- **api**: HTTP API services (like this auth service) - deployed with N replicas
- **scheduler**: Background job processing - single replica deployment
- **consumer**: Message queue consumers - deployed with N replicas

### Application Objectives
- Provide secure authentication for Telegram Mini App users
- Support multiple authentication methods (TMA, Telegram Widget, Dev mode)
- Implement comprehensive JWT token management with caching
- Ensure enterprise-grade security and rate limiting
- Maintain high performance with Redis caching and database optimization

### Domain Ownership
This application composes the **auth** domain, which includes:
- Authentication business logic
- User session management
- JWT token lifecycle
- Cross-domain authentication events

### Key Technologies
- **Backend Framework**: NestJS 10+ with TypeScript
- **Database**: MySQL with TypeORM for user management
- **Caching**: Redis for JWT tokens, user preferences, and session data
- **Authentication**: JWT tokens with custom validation and caching
- **Rate Limiting**: NestJS Throttler with Redis backend
- **Build System**: Nx workspace with optimized builds

## Architecture

### Application Structure

**Important:** Following xRocket's domain-driven architecture, applications are thin deployment artifacts that compose pre-built domain libraries. No new business logic is written inside an app.

```
apps/auth/auth-api/
├── src/
│   ├── auth-api.module.ts          # Main application module (composition root)
│   ├── main.ts                     # Application entry point
│   └── config/                     # Application-specific configuration
│       └── auth-api.config.ts      # Environment configuration
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── jest.config.ts                  # Jest testing configuration
├── webpack.config.js               # Webpack build configuration
└── README.md                       # Application documentation
```

### Service Architecture Flow

Following the Controller → Service → Repository → Mapper pattern:

```
┌─────────────────┐
│ HTTP Requests   │
│ (TMA/Widget)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                          │
│  • HTTP/Message ingress point                                   │
│  • Request validation (DTOs)                                    │
│  • Guards & Interceptors                                        │
│  • Response mapping                                             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                           │
│  • Use-case orchestration                                       │
│  • Transaction boundaries                                       │
│  • Business logic execution                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       REPOSITORY LAYER                          │
│  • Data persistence contracts                                   │
│  • Query specifications                                         │
│  • No direct database access                                    │
└────────────────────────-────────────────────────────────────────┘

Cross-Domain Communication (when needed):
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Auth Domain │ ──────▶ │   RabbitMQ   │ ──────▶ │  User Domain │
│   (Producer) │         │   Message    │         │  (Consumer)  │
└──────────────┘         └──────────────┘         └──────────────┘
```

## Technical Specifications

### 1. Core Services

#### Application Module (Composition Root)

The application module is where we compose the domain libraries. No business logic here:

```typescript
// apps/auth/auth-api/src/auth-api.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthMainModule } from '@app/features-auth-main';
import { AuthSharedModule } from '@app/features-auth-shared';
import { CommonDatabaseModule } from '@app/common-database';
import { CommonRedisModule } from '@app/common-redis';
import { CommonRabbitMQModule } from '@app/common-rabbitmq';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CommonDatabaseModule,
    CommonRedisModule,
    CommonRabbitMQModule,
    AuthSharedModule,
    AuthMainModule, // This imports all controllers, services, etc. from the domain
  ],
})
export class AuthApiModule {}
```

#### Application-Level Configuration

Application-specific configuration and environment setup:

```typescript
// apps/auth/auth-api/src/config/auth-api.config.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get baseUrl(): string {
    return this.configService.get<string>('BASE_URL', 'http://localhost:3000');
  }

  get envName(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isDev(): boolean {
    return this.envName === 'development';
  }

  get gracefulShutdownEnabled(): boolean {
    return this.configService.get<boolean>('GRACEFUL_SHUTDOWN_ENABLED', true);
  }

  get corsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS', '*');
    return origins === '*' ? ['*'] : origins.split(',');
  }

  get rateLimitMax(): number {
    return this.configService.get<number>('RATE_LIMIT_MAX', 100);
  }

  get rateLimitTtl(): number {
    return this.configService.get<number>('RATE_LIMIT_TTL', 60);
  }
}
```

#### Application Entry Point

Main application bootstrap and server setup:

```typescript
// apps/auth/auth-api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AuthApiModule } from './auth-api.module';
import { ApiConfigService } from './config/auth-api.config';

async function bootstrap() {
  const app = await NestFactory.create(AuthApiModule);
  const configService = app.get(ApiConfigService);

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.enableCors({
    origin: configService.corsOrigins,
    credentials: true,
  });

  // Validation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation (only in dev)
  if (configService.isDev) {
    const config = new DocumentBuilder()
      .setTitle('Auth API')
      .setDescription('Authentication service for xRocket platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  if (configService.gracefulShutdownEnabled) {
    app.enableShutdownHooks();
  }

  await app.listen(configService.port);
  console.log(`Auth API is running on: ${await app.getUrl()}`);
}

bootstrap();
```

### 2. Environment Configuration

Environment variables and application settings:

```bash
# Application Configuration
PORT=3000
NODE_ENV=production
BASE_URL=https://auth-api.xrocket.com

# Security Configuration
CORS_ORIGINS=https://app.xrocket.com,https://widget.xrocket.com
RATE_LIMIT_MAX=100
RATE_LIMIT_TTL=60
GRACEFUL_SHUTDOWN_ENABLED=true

# External Dependencies (configured at application level)
DATABASE_URL=mysql://user:pass@localhost:3306/xrocket
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672

# Monitoring & Observability
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 3. Application Middleware and Pipes

Application-level middleware configuration:

```typescript
// apps/auth/auth-api/src/main.ts - middleware setup
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';

async function configureMiddleware(app: any, config: ApiConfigService) {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: !config.isDev,
    }),
  );
}
```

## Implementation Plan

### Phase 1: Application Setup (Week 1)
- [ ] Create auth-api application structure in `apps/auth/auth-api/`
- [ ] Configure application module to import domain libraries
- [ ] Set up application-specific configuration service
- [ ] Configure environment variables and deployment settings
- [ ] Set up application entry point with middleware configuration

### Phase 2: Application Integration (Week 2)
- [ ] Wire up domain modules (AuthMainModule, AuthSharedModule)
- [ ] Configure database, Redis, and RabbitMQ connections
- [ ] Set up application-level middleware (helmet, CORS, compression)
- [ ] Configure validation pipes and exception filters
- [ ] Implement health check endpoints for monitoring

### Phase 3: Production Configuration (Week 3)
- [ ] Configure Swagger/OpenAPI documentation
- [ ] Set up security headers and CORS policies
- [ ] Configure rate limiting and throttling at application level
- [ ] Set up logging with correlation IDs and structured output
- [ ] Configure graceful shutdown and error handling

### Phase 4: Build and Deployment (Week 4)
- [ ] Configure Nx build pipeline with webpack optimization
- [ ] Set up Docker containerization for production deployment
- [ ] Configure Kubernetes deployment manifests
- [ ] Set up environment-specific configuration management
- [ ] Configure monitoring, metrics, and alerting

### Phase 5: Testing and Validation (Week 5)
- [ ] Application-level integration testing
- [ ] End-to-end API testing with real domain integration
- [ ] Load testing for authentication endpoints
- [ ] Security testing and vulnerability assessment
- [ ] Performance testing and optimization

## API Design Considerations

### RESTful Endpoints
- Consistent URL patterns following REST conventions
- Proper HTTP status codes and response formatting
- Comprehensive OpenAPI/Swagger documentation
- Standardized error response structure

### Performance Optimization
- Redis caching for frequently accessed data
- Database connection pooling with configurable limits
- Efficient JWT token validation with caching
- Rate limiting to prevent abuse and ensure fair usage

### Monitoring and Observability
- Structured logging with correlation IDs
- Health check endpoints for infrastructure monitoring
- Metrics collection for performance tracking
- Error tracking and alerting with Sentry integration

## Security Considerations

### API Security
```typescript
// Example: Secure authentication validation
@Injectable()
export class AuthValidationService {
  constructor(
    private readonly configService: AuthConfigService,
    private readonly jwtCacheService: AuthJwtCacheService
  ) {}

  async validateTelegramData(
    searchParams: URLSearchParams,
    botToken: string
  ): Promise<boolean> {
    try {
      // Validate Telegram Mini App data signature
      const isValid = validateWebAppData(botToken, searchParams);
      
      if (!isValid) {
        this.logger.warn('Invalid Telegram data signature');
        return false;
      }

      // Check auth date expiration (except in dev mode)
      if (!this.configService.isDev) {
        const authDate = searchParams.get('auth_date');
        if (!authDate) {
          return false;
        }

        const authTimestamp = parseInt(authDate) * 1000;
        const currentTime = Date.now();
        const maxAge = 3 * 60 * 1000; // 3 minutes

        if (currentTime - authTimestamp > maxAge) {
          this.logger.warn('Auth date expired', {
            authDate: new Date(authTimestamp),
            currentTime: new Date(currentTime)
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Telegram data validation failed', {
        error: error.message
      });
      return false;
    }
  }

  async validateJwtToken(
    token: string
  ): Promise<AuthJwtPayloadDto | null> {
    try {
      // Verify JWT signature
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtSecret
      }) as AuthJwtPayloadDto;

      // Validate token exists in cache (not revoked)
      const cachedPayload = await this.jwtCacheService.validateJwtKey(
        payload.userId,
        payload.uniqueKey
      );

      if (!cachedPayload) {
        this.logger.warn('JWT token not found in cache', {
          userId: payload.userId,
          uniqueKey: payload.uniqueKey
        });
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.error('JWT validation failed', {
        error: error.message
      });
      return null;
    }
  }
}
```

### Data Protection
- All sensitive data encrypted in transit with HTTPS
- JWT tokens with proper expiration and revocation
- Database credentials and API keys stored securely
- Input validation and sanitization on all endpoints
- Rate limiting to prevent brute force attacks
- Helmet.js security headers implementation

## Testing Strategy

### Unit Tests
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthUserService } from '@app/features-auth-shared';
import { UserRepository } from '@app/mysql';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: UserRepository;
  let authUserService: AuthUserService;

  const mockUser = {
    id: 'user_123',
    telegramId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    isBlocked: false,
    isCreator: false,
    isAdmin: false,
    isDev: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findOneClean: jest.fn(),
          },
        },
        {
          provide: AuthUserService,
          useValue: {
            findOrCreateByWebAuth: jest.fn(),
          },
        },
        // ... other mocked dependencies
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepository>(UserRepository);
    authUserService = module.get<AuthUserService>(AuthUserService);
  });

  describe('authDev', () => {
    it('should authenticate user in dev mode', async () => {
      jest.spyOn(userRepository, 'findOneClean').mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'configService', 'get').mockReturnValue({ isDev: true });

      const result = await service.authDev('user_123');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toHaveProperty('token');
    });

    it('should reject authentication in production mode', async () => {
      jest.spyOn(service as any, 'configService', 'get').mockReturnValue({ isDev: false });

      const result = await service.authDev('user_123');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotInDevModeException);
    });

    it('should reject blocked users', async () => {
      const blockedUser = { ...mockUser, isBlocked: true };
      jest.spyOn(userRepository, 'findOneClean').mockResolvedValue(blockedUser);
      jest.spyOn(service as any, 'configService', 'get').mockReturnValue({ isDev: true });

      const result = await service.authDev('user_123');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(UserBlockedException);
    });
  });

  describe('authTma', () => {
    it('should authenticate valid TMA data', async () => {
      const mockParams = {
        hostname: 'xrocket.tg',
        url: '/auth?user=%7B%22id%22%3A123456789%7D&auth_date=1640995200&hash=validhash',
        ip: '127.0.0.1',
      };

      jest.spyOn(authUserService, 'findOrCreateByWebAuth').mockResolvedValue(mockUser);
      // Mock validateWebAppData to return true
      jest.doMock('@grammyjs/validator', () => ({
        validateWebAppData: jest.fn(() => true),
      }));

      const result = await service.authTma(mockParams);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toHaveProperty('token');
    });

    it('should reject invalid TMA signature', async () => {
      const mockParams = {
        hostname: 'xrocket.tg',
        url: '/auth?user=%7B%22id%22%3A123456789%7D&auth_date=1640995200&hash=invalidhash',
        ip: '127.0.0.1',
      };

      // Mock validateWebAppData to return false
      jest.doMock('@grammyjs/validator', () => ({
        validateWebAppData: jest.fn(() => false),
      }));

      const result = await service.authTma(mockParams);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(TmaDataValidationException);
    });
  });
});
```

### Integration Tests
- Database integration testing with test containers
- Redis caching integration tests
- JWT token lifecycle testing
- Rate limiting and throttling integration tests

### E2E Tests
```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthApiModule } from '../src/auth-api.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthApiModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/dev (GET)', () => {
    it('should authenticate user in dev mode', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/dev')
        .query({ id: 'test_user_123' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
          expect(typeof res.body.token).toBe('string');
        });
    });

    it('should reject invalid user ID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/dev')
        .query({ id: 'invalid_user' })
        .expect(404);
    });

    it('should apply rate limiting', async () => {
      const promises = [];
      
      // Make 25 requests (exceeding the 20 req/min limit)
      for (let i = 0; i < 25; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/api/v1/auth/dev')
            .query({ id: 'test_user_123' })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('/api/v1/auth/tma (GET)', () => {
    it('should authenticate valid TMA data', () => {
      const tmaParams = new URLSearchParams({
        user: JSON.stringify({
          id: 123456789,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe',
          language_code: 'en',
        }),
        auth_date: Math.floor(Date.now() / 1000).toString(),
        hash: 'valid_hash_here', // This would be a real hash in actual tests
      });

      return request(app.getHttpServer())
        .get(`/api/v1/auth/tma?${tmaParams.toString()}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
        });
    });

    it('should reject expired auth_date', () => {
      const expiredAuthDate = Math.floor((Date.now() - 5 * 60 * 1000) / 1000); // 5 minutes ago
      const tmaParams = new URLSearchParams({
        user: JSON.stringify({ id: 123456789, first_name: 'John' }),
        auth_date: expiredAuthDate.toString(),
        hash: 'valid_hash_here',
      });

      return request(app.getHttpServer())
        .get(`/api/v1/auth/tma?${tmaParams.toString()}`)
        .expect(400);
    });
  });
});
```

## Deployment Strategy

### Build Configuration
```javascript
// webpack.config.js
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  return {
    ...config,
    optimization: {
      ...config.optimization,
      minimize: process.env.NODE_ENV === 'production',
    },
    resolve: {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
      },
    },
  };
});

// project.json
{
  "name": "auth-api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/auth/auth-api/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "target": "node",
        "compiler": "tsc",
        "outputPath": "dist/apps/auth/auth-api",
        "main": "apps/auth/auth-api/src/main.ts",
        "tsConfig": "apps/auth/auth-api/tsconfig.app.json",
        "assets": ["apps/auth/auth-api/src/assets"],
        "webpackConfig": "apps/auth/auth-api/webpack.config.js"
      },
      "configurations": {
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "inspect": false
        },
        "production": {
          "optimization": true,
          "extractLicenses": true,
          "inspect": false,
          "fileReplacements": [
            {
              "replace": "apps/auth/auth-api/src/environments/environment.ts",
              "with": "apps/auth/auth-api/src/environments/environment.prod.ts"
            }
          ]
        }
      }
    },
    "serve": {
      "executor": "@nx/js:node",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "auth-api:build"
      },
      "configurations": {
        "development": {
          "buildTarget": "auth-api:build:development"
        },
        "production": {
          "buildTarget": "auth-api:build:production"
        }
      }
    }
  }
}
```

### Docker Configuration
```dockerfile
# Multi-stage build for NestJS application
FROM node:20.12.2-alpine3.18 AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the auth-api application
RUN npm run build:auth-api

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nestjs /app/dist/apps/auth/auth-api ./
COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
# Copy package.json for dependencies
COPY --chown=nestjs:nestjs package.json ./

# Install only production dependencies
RUN npm ci --production=true && npm cache clean --force

USER nestjs

EXPOSE 3000
ENV PORT=3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "main.js"]
```


## Related Files

### Application Files
- `apps/auth/auth-api/src/auth-api.module.ts` - Main application module (composition root)
- `apps/auth/auth-api/src/main.ts` - Application entry point and bootstrap
- `apps/auth/auth-api/src/config/auth-api.config.ts` - Application-specific configuration
- `apps/auth/auth-api/package.json` - Application dependencies and scripts
- `apps/auth/auth-api/tsconfig.json` - TypeScript configuration
- `apps/auth/auth-api/webpack.config.js` - Build configuration
- `apps/auth/auth-api/project.json` - Nx project configuration
- `apps/auth/auth-api/Dockerfile` - Container configuration

### Build and Deployment
- `apps/auth/auth-api/environments/` - Environment-specific configurations
- `apps/auth/auth-api/k8s/` - Kubernetes deployment manifests
- `apps/auth/auth-api/.env.template` - Environment variables template
- `apps/auth/auth-api/docker-compose.yml` - Local development setup

## Success Criteria

- [ ] Application can be built without errors

---

*This application specification template provides a comprehensive approach to building secure authentication services with NestJS, TypeScript, and enterprise-grade patterns. Customize based on your specific authentication requirements and security standards.*
