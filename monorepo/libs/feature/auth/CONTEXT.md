# Auth Feature - Multi-Factor Authentication and Authorization System

## Overview

The auth feature is a comprehensive authentication and authorization system that provides secure user authentication, JWT token management, multi-platform integration, and advanced security controls. This feature supports multiple authentication methods including Telegram Mini App (TMA), Telegram Widget, and development authentication, with robust security measures including token validation, user blocking, and caching optimization.

**Core Functionality:**

- Multi-platform authentication (TMA, Telegram Widget, Development mode)
- JWT token generation, validation, and lifecycle management
- Advanced user session management with Redis caching
- Role-based access control and permission management
- Composite authentication strategies for different service contexts
- Referral system integration and source tracking
- Rate limiting and throttling protection
- User visit tracking and analytics integration

## Coding Standards

### Exception Handling

- **All exceptions MUST use the Exception class from @app/common/exception**
- Use `Exception({ kind: ExceptionKind.*, problemType: 'snake_case', title: 'Title' })`
- Never use `throw new Error()` or `HttpException`
- All exception types must map to appropriate ExceptionKind values

Example:

```typescript
export class BadTokenException extends Exception({
  kind: ExceptionKind.Unauthorized,
  problemType: 'bad_token',
  title: 'Bad Token',
}) {
  constructor(message: string = 'Invalid token') {
    super({ detail: message });
  }
}
```

### Enum Format Standards

- **Keys**: CamelCase
- **Values**: snake_case
- No UPPER_CASE keys

Example:

```typescript
enum UserStatus {
  ActiveUser = 'active_user',
  InactiveUser = 'inactive_user',
  BlockedUser = 'blocked_user',
}
```

### Code Comments Policy

- **No comments allowed in code**
- Code must be self-documenting through clear naming
- Use descriptive variable and function names instead of comments

### Project References

- **No project-specific names in code**
- Use generic terms like 'Application' instead of specific project names
- Focus on functional naming rather than brand-specific terms

## Architecture Overview

### Module Structure

**Main Authentication Module (`auth/main`):**

- `AuthService` - Core authentication logic and user verification
- `AuthController` - REST API endpoints for authentication operations
- Integration with user repositories and bonus systems

**Shared Authentication Module (`auth/shared`):**

- Comprehensive authentication services and utilities
- JWT strategies and guard systems
- Caching services for performance optimization
- Exception handling and security validation

### Main Components

**Core Authentication Services:**

- `AuthService` - Primary authentication orchestration
- `AuthJwtValidationService` - JWT token validation and verification
- `AuthUserService` - User authentication and session management
- `AuthCreateUserService` - New user creation and onboarding
- `AuthCompositeService` - Multi-strategy authentication coordination

**Security and Validation Services:**

- `AuthBlockedCacheService` - User blocking status caching
- `AuthJwtCacheService` - JWT token caching and invalidation
- `AuthJtiCacheService` - JWT ID tracking for token revocation
- `UserTokensRevokeService` - Token lifecycle and revocation management

**Specialized Services:**

- `ExchangeTokenAuthService` - Trading platform authentication
- `ExchangeJwtService` - Exchange-specific JWT handling
- `AuthLegacyService` - Legacy authentication system compatibility
- `AuthUserVisitService` - User activity tracking and analytics

### Authentication Flow Architecture

```typescript
Authentication Request → Route Validation → Token Extraction → Strategy Selection → User Validation → Session Creation → Response Generation
         ↓                     ↓                ↓                  ↓                ↓               ↓                ↓
    API Endpoint         Guard Check      JWT/TMA Token      Auth Strategy     User Lookup     Cache Update     JWT Token
    Rate Limiting        IP Validation    Token Parsing      TMA/Widget/Dev    Block Status    Session Store    Response DTO
    Header Analysis      Throttling       Signature Check    Composite         Permissions     Activity Log     User Data
```

## Public API Surface

### Main Module Exports

```typescript
export { AuthMainModule } from './auth/main';
export { AuthSharedModule } from './auth/shared';

export { AuthService } from './auth/main/services';
export {
  AuthJwtValidationService,
  AuthUserService,
  AuthCompositeService,
  ExchangeTokenAuthService,
} from './auth/shared/services';

export * from './auth/shared/guards';
export * from './auth/shared/decorator';
export * from './auth/shared/exceptions';
export * from './auth/shared/dto';
```

### Key Service APIs

**Primary Authentication Interface:**

```typescript
interface AuthService {
  authDev(userId: string): AsyncResult<AuthResultDto, AuthError>;
  authTma(params: TmaAuthParams): AsyncResult<AuthResultDto, AuthError>;
  authTelegramWidget(params: WidgetAuthParams): AsyncResult<AuthResultDto, AuthError>;
}

interface TmaAuthParams {
  url: string;
  hostname: string;
  ip?: string;
}

interface WidgetAuthParams {
  dto: TelegramWidgetAuthDto;
  ip?: string;
}
```

**JWT Validation Service:**

```typescript
interface AuthJwtValidationService {
  validate(payload: AuthJwtPayloadDto): Promise<Result<UserData, AuthValidationError>>;
}

interface AuthJwtPayloadDto {
  app: AuthJwtApp;
  userId: string;
  iat?: number;
  exp?: number;
  jti?: string;
}
```

## Multi-Platform Authentication System

### Telegram Mini App (TMA) Authentication

**TMA Integration Process:**

```typescript
1. TMA Data Extraction → Parse Telegram Mini App initialization data
2. Signature Validation → Verify Telegram bot token signature
3. User Data Processing → Extract user information from TMA payload
4. Session Creation → Generate JWT token and create user session
5. Security Validation → IP tracking, rate limiting, and fraud detection
```

**TMA Data Validation:**

```typescript
interface TmaValidationProcess {
  initDataValidation: {
    signatureVerification: boolean;
    timestampCheck: boolean;
    botTokenVerification: boolean;
  };
  userDataExtraction: {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  };
  securityValidation: {
    ipTracking: boolean;
    deviceFingerprinting: boolean;
    rateLimiting: boolean;
  };
}
```

### Telegram Widget Authentication

**Widget Authentication Flow:**

```typescript
interface TelegramWidgetAuthDto {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const validateWidgetAuth = async (dto: TelegramWidgetAuthDto): Promise<WidgetValidationResult> => {
  const isValidHash = await verifyTelegramHash(dto, botToken);
  const isValidTimestamp = Date.now() / 1000 - dto.auth_date < 86400;
  const isValidUserData = validateUserDataConsistency(dto);

  return { isValid: isValidHash && isValidTimestamp && isValidUserData };
};
```

### Development Authentication

**Development Mode Features:**

```typescript
interface DevAuthConfiguration {
  enabled: boolean;
  allowedIPs: string[];
  allowedTelegramIds: string[];
  bypassSecurity: boolean;
}

const authDev = async (userId: string, ip: string): Promise<AuthResult> => {
  if (!configService.isDev) {
    throw new NotInDevModeException();
  }

  if (!isAllowedIP(ip)) {
    throw new UnauthorizedException('IP not allowed in dev mode');
  }

  return await createDevSession(userId);
};
```

## JWT Token Management System

### Comprehensive Token Architecture

**JWT Payload Structure:**

```typescript
interface AuthJwtPayloadDto {
  app: AuthJwtApp;
  userId: string;
  iat: number;
  exp: number;
  jti: string;
  premiumUntil?: Date;
  language?: string;
  referralCode?: string;
}

enum AuthJwtApp {
  Captcha = 'captcha',
  WebExchange = 'web_exchange',
  Wallet = 'wallet',
  MainApp = 'main_app',
  Default = 'default',
  TelegramWidget = 'telegram_widget',
}
```

### Token Lifecycle Management

**Token Generation Process:**

```typescript
const generateJwtToken = async (user: User, app: AuthJwtApp): Promise<JwtTokenResult> => {
  const payload: AuthJwtPayloadDto = {
    app,
    userId: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
    jti: generateUniqueJti(),
    premiumUntil: user.premiumUntil,
    language: user.language,
    referralCode: user.referralCode,
  };

  const token = await jwtService.signAsync(payload);
  await authJwtCacheService.cacheToken(payload.jti, payload, JWT_EXPIRATION_SECONDS);

  return { token, payload };
};
```

**Token Validation Pipeline:**

```typescript
const validateJwtToken = async (token: string): Promise<ValidationResult> => {
  try {
    const payload = await jwtService.verifyAsync<AuthJwtPayloadDto>(token);

    const isRevoked = await authJtiCacheService.isTokenRevoked(payload.jti);
    if (isRevoked) {
      return { valid: false, reason: 'TOKEN_REVOKED' };
    }

    const validationResult = await authJwtValidationService.validate(payload);
    if (validationResult.err) {
      return { valid: false, reason: validationResult.val.message };
    }

    await authJwtCacheService.cacheValidation(payload.jti, validationResult.val);

    return { valid: true, userData: validationResult.val };
  } catch (error) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }
};
```

## Integration Examples

### Basic Authentication Flow

```typescript
import { AuthService, AuthJwtValidationService } from '@app/feature-auth-main';

const authResult = await authService.authTma({
  url: 'https://app.example.com/?tgWebAppData=user%3D...',
  hostname: 'app.example.com',
  ip: '192.168.1.1',
});

if (authResult.ok) {
  const { token, user } = authResult.val;
  console.log('Authentication successful:', token);

  const userContext = await authJwtValidationService.validate(jwt.decode(token) as AuthJwtPayloadDto);
}
```

### Guard Implementation

```typescript
import { CompositeAuthGuard, CurrentUserId } from '@app/feature-auth-shared';

@Controller('protected')
@UseGuards(CompositeAuthGuard)
export class ProtectedController {
  @Get('profile')
  async getProfile(@CurrentUserId() userId: string) {
    return await this.userService.getProfile(userId);
  }
}
```

## Configuration and Environment

### Authentication Configuration

```bash
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRATION_SECONDS=3600
JWT_ISSUER=application-platform

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WIDGET_VERIFICATION_ENABLED=true

AUTH_DEV_MODE_ENABLED=false
AUTH_DEV_ALLOWED_IPS=127.0.0.1,::1
AUTH_DEV_ALLOWED_TELEGRAM_IDS=12345,67890

AUTH_CACHE_TTL_JWT=3600
AUTH_CACHE_TTL_BLOCKED=1800
AUTH_CACHE_TTL_PREMIUM=900
AUTH_CACHE_TTL_LANGUAGE=7200

AUTH_RATE_LIMIT_TTL=60000
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_BLOCK_DURATION=300000

AUTH_TOKEN_REVOCATION_ENABLED=true
AUTH_IP_VALIDATION_ENABLED=true
AUTH_REFERRAL_TRACKING_ENABLED=true
```

This auth feature provides enterprise-grade authentication and authorization capabilities with comprehensive security measures, performance optimizations, and extensive integration support for the platform's multi-service architecture.
