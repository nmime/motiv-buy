# Auth Feature - Multi-Factor Authentication and Authorization System

## Overview

The auth feature is a comprehensive authentication and authorization system that provides secure user authentication, JWT token management, multi-platform integration, and advanced security controls for the xRocket platform. This feature supports multiple authentication methods including Telegram Mini App (TMA), Telegram Widget, and development authentication, with robust security measures including token validation, user blocking, and caching optimization.

**Core Functionality:**
- Multi-platform authentication (TMA, Telegram Widget, Development mode)
- JWT token generation, validation, and lifecycle management
- Advanced user session management with Redis caching
- Role-based access control and permission management
- Composite authentication strategies for different service contexts
- Referral system integration and source tracking
- Rate limiting and throttling protection
- User visit tracking and analytics integration

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
// Multi-Stage Authentication Pipeline
Authentication Request → Route Validation → Token Extraction → Strategy Selection → User Validation → Session Creation → Response Generation
         ↓                     ↓                ↓                  ↓                ↓               ↓                ↓
    API Endpoint         Guard Check      JWT/TMA Token      Auth Strategy     User Lookup     Cache Update     JWT Token
    Rate Limiting        IP Validation    Token Parsing      TMA/Widget/Dev    Block Status    Session Store    Response DTO
    Header Analysis      Throttling       Signature Check    Composite         Permissions     Activity Log     User Data
```

## Public API Surface

### Main Module Exports
```typescript
// Primary modules
export { AuthMainModule } from './auth/main';
export { AuthSharedModule } from './auth/shared';

// Core services
export { AuthService } from './auth/main/services';
export { 
  AuthJwtValidationService,
  AuthUserService,
  AuthCompositeService,
  ExchangeTokenAuthService
} from './auth/shared/services';

// Guards and decorators
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
// Telegram Mini App authentication flow
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
    signatureVerification: boolean;    // Telegram signature validation
    timestampCheck: boolean;           // Data freshness validation
    botTokenVerification: boolean;     // Bot token authenticity
  };
  userDataExtraction: {
    telegramId: string;               // Telegram user ID
    username?: string;                // Telegram username
    firstName?: string;               // User's first name
    lastName?: string;                // User's last name
    languageCode?: string;            // User's language preference
  };
  securityValidation: {
    ipTracking: boolean;              // IP address monitoring
    deviceFingerprinting: boolean;    // Device identification
    rateLimiting: boolean;            // Request frequency control
  };
}
```

### Telegram Widget Authentication

**Widget Authentication Flow:**
```typescript
interface TelegramWidgetAuthDto {
  id: string;                      // Telegram user ID
  first_name?: string;             // User's first name
  last_name?: string;              // User's last name
  username?: string;               // Telegram username
  photo_url?: string;              // Profile photo URL
  auth_date: number;               // Authentication timestamp
  hash: string;                    // Telegram signature hash
}

// Widget validation process
const validateWidgetAuth = async (dto: TelegramWidgetAuthDto): Promise<WidgetValidationResult> => {
  // 1. Hash verification using bot token
  const isValidHash = await verifyTelegramHash(dto, botToken);
  
  // 2. Timestamp validation (not older than 24 hours)
  const isValidTimestamp = (Date.now() / 1000 - dto.auth_date) < 86400;
  
  // 3. User data consistency check
  const isValidUserData = validateUserDataConsistency(dto);
  
  return { isValid: isValidHash && isValidTimestamp && isValidUserData };
};
```

### Development Authentication

**Development Mode Features:**
```typescript
interface DevAuthConfiguration {
  enabled: boolean;                 // Development mode status
  allowedIPs: string[];            // Whitelisted IP addresses
  allowedTelegramIds: string[];    // Whitelisted Telegram IDs
  bypassSecurity: boolean;         // Security bypass for testing
}

// Development authentication with IP restrictions
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
  app: AuthJwtApp;                 // Application context (MAIN, EXCHANGE, etc.)
  userId: string;                  // User identifier
  iat: number;                     // Issued at timestamp
  exp: number;                     // Expiration timestamp
  jti: string;                     // JWT unique identifier for revocation
  premiumUntil?: Date;            // Premium subscription expiration
  language?: string;               // User's preferred language
  referralCode?: string;           // User's referral code
}

enum AuthJwtApp {
  MAIN = 'main',                   // Main application context
  EXCHANGE = 'exchange',           // Trading platform context
  API = 'api',                     // API access context
  ADMIN = 'admin'                  // Administrative access
}
```

### Token Lifecycle Management

**Token Generation Process:**
```typescript
// Comprehensive token creation
const generateJwtToken = async (user: User, app: AuthJwtApp): Promise<JwtTokenResult> => {
  const payload: AuthJwtPayloadDto = {
    app,
    userId: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
    jti: generateUniqueJti(),
    premiumUntil: user.premiumUntil,
    language: user.language,
    referralCode: user.referralCode
  };
  
  const token = await jwtService.signAsync(payload);
  
  // Cache token for quick validation
  await authJwtCacheService.cacheToken(payload.jti, payload, JWT_EXPIRATION_SECONDS);
  
  return { token, payload };
};
```

**Token Validation Pipeline:**
```typescript
// Multi-stage token validation
const validateJwtToken = async (token: string): Promise<ValidationResult> => {
  try {
    // 1. Token structure validation
    const payload = await jwtService.verifyAsync<AuthJwtPayloadDto>(token);
    
    // 2. JTI revocation check
    const isRevoked = await authJtiCacheService.isTokenRevoked(payload.jti);
    if (isRevoked) {
      return { valid: false, reason: 'TOKEN_REVOKED' };
    }
    
    // 3. User status validation
    const validationResult = await authJwtValidationService.validate(payload);
    if (validationResult.err) {
      return { valid: false, reason: validationResult.val.message };
    }
    
    // 4. Cache validation result
    await authJwtCacheService.cacheValidation(payload.jti, validationResult.val);
    
    return { valid: true, userData: validationResult.val };
  } catch (error) {
    return { valid: false, reason: 'INVALID_TOKEN' };
  }
};
```

### Token Revocation System

**Comprehensive Token Revocation:**
```typescript
interface TokenRevocationService {
  revokeUserTokens(userId: string): Promise<void>;
  revokeSpecificToken(jti: string): Promise<void>;
  revokeTokensByApp(userId: string, app: AuthJwtApp): Promise<void>;
  revokePremiumTokens(userId: string): Promise<void>;
}

// Mass token revocation implementation
const revokeUserTokens = async (userId: string): Promise<void> => {
  // 1. Get all active tokens for user
  const activeTokens = await authJwtCacheService.getUserTokens(userId);
  
  // 2. Mark all JTIs as revoked
  await Promise.all(
    activeTokens.map(token => authJtiCacheService.revokeToken(token.jti))
  );
  
  // 3. Clear user-specific auth caches
  await Promise.all([
    authJwtCacheService.clearUserTokens(userId),
    authBlockedCacheService.clearUserStatus(userId),
    authPremiumCacheService.clearUserPremium(userId)
  ]);
  
  // 4. Log revocation event
  await auditService.logTokenRevocation(userId, activeTokens.length);
};
```

## Advanced Caching System

### Multi-Layer Authentication Caching

**Cache Architecture:**
```typescript
interface AuthCacheServices {
  authJwtCache: {
    purpose: 'JWT token validation caching';
    ttl: 3600; // 1 hour
    keys: `jwt:${jti}`;
  };
  authBlockedCache: {
    purpose: 'User blocking status caching';
    ttl: 1800; // 30 minutes
    keys: `blocked:${userId}`;
  };
  authPremiumCache: {
    purpose: 'Premium subscription status caching';
    ttl: 900; // 15 minutes
    keys: `premium:${userId}`;
  };
  authLanguageCache: {
    purpose: 'User language preference caching';
    ttl: 7200; // 2 hours
    keys: `lang:${userId}`;
  };
}
```

**Performance-Optimized Validation:**
```typescript
// Cached validation with fallback
const validateWithCache = async (payload: AuthJwtPayloadDto): Promise<UserData> => {
  // 1. Check cache first
  const cachedValidation = await authJwtCacheService.getCachedValidation(payload.jti);
  if (cachedValidation) {
    return cachedValidation;
  }
  
  // 2. Parallel cache lookups for user status
  const [isBlocked, premiumStatus, language] = await Promise.all([
    authBlockedCacheService.isUserBlocked(payload.userId),
    authPremiumCacheService.getUserPremium(payload.userId),
    authLanguageCacheService.getUserLanguage(payload.userId)
  ]);
  
  // 3. Fallback to database if cache miss
  if (isBlocked === null) {
    const user = await userRepository.findOne(payload.userId);
    if (!user) throw new UserNotFoundException();
    
    // Update all caches
    await Promise.all([
      authBlockedCacheService.saveIsUserBlocked(payload.userId, user.isBlocked),
      authPremiumCacheService.saveUserPremium(payload.userId, user.premiumUntil),
      authLanguageCacheService.saveUserLanguage(payload.userId, user.language)
    ]);
    
    return createUserData(user);
  }
  
  return createUserData({ isBlocked, premiumStatus, language });
};
```

## Security and Guard System

### Composite Authentication Guards

**Multi-Strategy Guard System:**
```typescript
interface CompositeAuthGuard extends AuthGuard('composite') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
}

// Composite strategy implementation
class CompositeStrategy extends PassportStrategy(Strategy, 'composite') {
  async validate(payload: AuthJwtPayloadDto): Promise<UserData> {
    // Delegated to AuthJwtValidationService for comprehensive validation
    const result = await this.authJwtValidationService.validate(payload);
    
    if (result.err) {
      throw new UnauthorizedException(result.val.message);
    }
    
    return result.val;
  }
}
```

**Specialized Guard Implementations:**
```typescript
// Exchange-specific authentication
class ExchangeAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    
    if (!token) return false;
    
    // Exchange-specific validation
    const isValidExchangeToken = await this.exchangeTokenAuthService.validateToken(token);
    return isValidExchangeToken;
  }
}

// IP-based authentication for development
class IpAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIP = request.ip || request.connection.remoteAddress;
    
    return this.configService.isDev && this.isAllowedIP(clientIP);
  }
}
```

### Rate Limiting and Throttling

**Advanced Throttling System:**
```typescript
interface AppThrottlerGuard extends ThrottlerGuard {
  generateKey(context: ExecutionContext): string;
  getTracker(req: Request): string;
}

// Multi-dimensional rate limiting
const throttlerConfig = {
  auth: {
    ttl: 60000,        // 1 minute window
    limit: 10,         // 10 requests per window
    blockDuration: 300000  // 5 minute block
  },
  apiKey: {
    ttl: 3600000,      // 1 hour window
    limit: 1000,       // 1000 requests per hour
    blockDuration: 0   // No blocking for API keys
  }
};
```

## Referral System Integration

### Comprehensive Referral Tracking

**Referral Source Management:**
```typescript
interface SourceRegisterService {
  registerUserSource(params: {
    userId: string;
    sourceType: string;
    sourceId?: string;
    referralCode?: string;
    ip?: string;
  }): Promise<void>;
}

interface GetSourceParamsService {
  extractSourceParams(url: string): SourceParams;
}

// Referral link generation and tracking
const generateUserRefLink = async (userId: string): Promise<UserRefLinkDto> => {
  const user = await userRepository.findOne(userId);
  if (!user) throw new UserNotFoundException();
  
  const refLink = await userRefLinkRepository.findOrCreate({
    userId,
    linkType: LinkType.DEFAULT,
    code: generateReferralCode(userId)
  });
  
  return {
    code: refLink.code,
    url: `https://t.me/xrocket/app?startapp=${refLink.code}`,
    linkType: refLink.linkType,
    createdAt: refLink.createdAt
  };
};
```

### Source Attribution Pipeline

**Multi-Channel Attribution:**
```typescript
enum LinkType {
  DEFAULT = 'default',
  CAMPAIGN = 'campaign',
  SOCIAL = 'social',
  AFFILIATE = 'affiliate',
  WIDGET = 'widget'
}

// Source tracking implementation
const trackUserSource = async (authParams: AuthParams): Promise<void> => {
  const sourceParams = await getSourceParamsService.extractSourceParams(authParams.url);
  
  if (sourceParams.referralCode) {
    await sourceRegisterService.registerUserSource({
      userId: authParams.userId,
      sourceType: 'referral',
      sourceId: sourceParams.referralCode,
      ip: authParams.ip
    });
    
    // Award referral bonuses
    await referralBonusService.processReferralSignup({
      newUserId: authParams.userId,
      referralCode: sourceParams.referralCode
    });
  }
};
```

## Integration Examples

### Basic Authentication Flow
```typescript
import { AuthService, AuthJwtValidationService } from '@app/features-auth-main';

// Authenticate user via Telegram Mini App
const authResult = await authService.authTma({
  url: 'https://app.xrocket.com/?tgWebAppData=user%3D...',
  hostname: 'app.xrocket.com',
  ip: '192.168.1.1'
});

if (authResult.ok) {
  const { token, user } = authResult.val;
  console.log('Authentication successful:', token);
  
  // Use token for subsequent requests
  const userContext = await authJwtValidationService.validate(
    jwt.decode(token) as AuthJwtPayloadDto
  );
}
```

### Guard Implementation
```typescript
import { CompositeAuthGuard, CurrentUserId } from '@app/features-auth-shared';

@Controller('protected')
@UseGuards(CompositeAuthGuard)
export class ProtectedController {
  @Get('profile')
  async getProfile(@CurrentUserId() userId: string) {
    // userId automatically extracted and validated from JWT
    return await this.userService.getProfile(userId);
  }
}
```

### Token Revocation
```typescript
import { UserTokensRevokeService } from '@app/features-auth-shared';

// Revoke all user tokens (e.g., on password change or security breach)
await userTokensRevokeService.revokeUserTokens('user123');

// Revoke specific token
await userTokensRevokeService.revokeSpecificToken('jti_token_id');
```

## Performance and Security Considerations

### Security Hardening

**Multi-Layer Security:**
- **JWT Security**: HMAC-SHA256 signing with configurable expiration
- **Token Revocation**: JTI-based token blacklisting with Redis persistence
- **Rate Limiting**: Multi-dimensional throttling (IP, user, endpoint)
- **IP Validation**: Development mode IP whitelisting
- **Cache Security**: Encrypted cache storage for sensitive authentication data

### Performance Optimizations

**Caching Strategy:**
- **Token Validation**: Cached validation results with 1-hour TTL
- **User Status**: Cached blocking and premium status with 30-minute TTL
- **Language Preferences**: 2-hour TTL for user language settings
- **Referral Data**: Cached referral relationships for quick lookup

### Monitoring and Analytics

**Key Metrics:**
- **Authentication Success Rate**: Percentage of successful authentications by method
- **Token Validation Performance**: Average response time for token validation
- **Cache Hit Rates**: Performance metrics for authentication caches
- **Security Events**: Failed authentication attempts and security violations
- **User Activity**: Authentication patterns and session duration analytics

## Configuration and Environment

### Authentication Configuration

```bash
# JWT Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRATION_SECONDS=3600
JWT_ISSUER=xrocket-platform

# Telegram Integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WIDGET_VERIFICATION_ENABLED=true

# Development Settings
AUTH_DEV_MODE_ENABLED=false
AUTH_DEV_ALLOWED_IPS=127.0.0.1,::1
AUTH_DEV_ALLOWED_TELEGRAM_IDS=12345,67890

# Cache Configuration
AUTH_CACHE_TTL_JWT=3600
AUTH_CACHE_TTL_BLOCKED=1800
AUTH_CACHE_TTL_PREMIUM=900
AUTH_CACHE_TTL_LANGUAGE=7200

# Rate Limiting
AUTH_RATE_LIMIT_TTL=60000
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_BLOCK_DURATION=300000

# Security Settings
AUTH_TOKEN_REVOCATION_ENABLED=true
AUTH_IP_VALIDATION_ENABLED=true
AUTH_REFERRAL_TRACKING_ENABLED=true
```

This auth feature provides enterprise-grade authentication and authorization capabilities with comprehensive security measures, performance optimizations, and extensive integration support for the xRocket platform's multi-service architecture.