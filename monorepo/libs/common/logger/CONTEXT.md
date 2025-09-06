# Logger

## Purpose and Responsibilities

The `logger` library provides a comprehensive, secure logging system for the xRocket platform. It implements structured JSON logging with sensitive data redaction, correlation ID tracking, and environment-specific log formatting. The logger ensures security by automatically redacting protected variables and provides consistent logging across all microservices.

## Key Components

### Logger Factory

- **createLogger()**: Main factory function for creating configured logger instances
- **Security Features**: Automatic redaction of sensitive data (API keys, passwords, tokens)
- **Correlation Tracking**: Integration with nestjs-cls for request correlation IDs
- **Environment Adaptation**: Pretty printing for development, JSON for production

### Security Features

#### Sensitive Data Redaction

- **Protected Variables**: Comprehensive list of sensitive field names to redact
- **Pattern Matching**: Regex-based detection of sensitive data in strings and objects
- **Deep Object Processing**: Recursive redaction through nested objects and arrays
- **Depth Limiting**: Prevents infinite recursion with configurable depth limits

#### Protected Variables List

- **Authentication**: `authorization`, `token`, `api-key`, `api_key`, `apikey`
- **Platform Specific**: `rocket-exchange-key`, `rocket-pay-key`
- **External APIs**: `tron-pro-api-key`, `ok-access-key`, `ok-access-sign`
- **Generic Secrets**: `password`, `access_key`, `cookie`

### Middleware Integration

- **HTTP Logging**: Automatic request/response logging with security redaction
- **Express Integration**: Seamless integration with Express.js middleware stack
- **Correlation ID**: Automatic correlation ID injection into all log entries

### Context Integration

- **CLS (Continuation Local Storage)**: Automatic context injection for user ID, app ID, request ID
- **Request Tracking**: Full request lifecycle tracking with correlation
- **User Context**: Automatic user identification in log entries

## Dependencies

### External Dependencies

- `nestjs-pino` - NestJS integration for Pino logger
- `pino-http` - HTTP request logging middleware
- `pino-std-serializers` - Standard serializers for HTTP objects
- `nestjs-cls` - Continuation Local Storage for request context
- `express` - Express.js framework integration

### Internal Dependencies

- `@app/common-shared` - Shared utilities for error handling

## Integration Points

### Application Setup

Used in all microservices for:

- **Structured Logging**: JSON-formatted logs for machine processing
- **Security Compliance**: Automatic redaction of sensitive data
- **Request Tracking**: Correlation ID tracking across service boundaries
- **Performance Monitoring**: Request timing and performance metrics

### Microservice Integration

- **Service Identification**: Automatic service name injection
- **Request Correlation**: Cross-service request tracking
- **Error Logging**: Structured error logging with context preservation

## Usage Patterns

### Basic Logger Setup

```typescript
import { createLogger } from '@app/common-logger';

// Create service logger
const { logger, middlewares } = createLogger({
  name: 'user-service',
});

// Apply middleware in NestJS app
app.use(...middlewares);
```

### Service Logging

```typescript
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(userData: CreateUserDto) {
    this.logger.log('Creating new user', {
      userId: userData.id,
      email: userData.email, // Will be redacted if contains sensitive patterns
    });

    try {
      const user = await this.userRepository.save(userData);
      this.logger.log('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error, {
        userData: userData, // Sensitive fields automatically redacted
      });
      throw error;
    }
  }
}
```

### Request Context Logging

```typescript
// Automatic context injection
this.logger.log('Processing payment', {
  amount: paymentData.amount,
  // The following are automatically injected:
  // userId: from CLS context
  // appId: from CLS context
  // requestId: correlation ID from CLS
});
```

### Error Logging with Context

```typescript
try {
  await this.processTransaction(data);
} catch (error) {
  this.logger.error('Transaction processing failed', error, {
    transactionId: data.id,
    apiKey: data.apiKey, // Automatically redacted as '[redacted]'
    privateKey: data.privateKey, // Automatically redacted
  });
}
```

### Structured Data Logging

```typescript
this.logger.log('Financial operation completed', {
  operation: 'deposit',
  amount: '1000.00',
  currency: 'USD',
  authorization: 'Bearer token123', // Redacted to '[redacted]'
  metadata: {
    provider: 'stripe',
    webhook_secret: 'secret123', // Redacted due to pattern matching
  },
});
```

## Configuration

### Environment Variables

- **LOG_LEVEL**: Log level (debug, info, warn, error) - defaults to 'debug'
- **NODE_ENV**: Environment setting (affects log formatting)
  - `production`: JSON format for machine processing
  - `development/other`: Pretty printed format for human readability

### Logger Configuration

```typescript
const params: Params = {
  pinoHttp: {
    name: 'service-name',
    level: process.env['LOG_LEVEL'] ?? 'debug',
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
            },
          }
        : undefined,
  },
};
```

## Security Considerations

### Automatic Data Redaction

- **Pattern-Based**: Detects sensitive data patterns in strings
- **Field-Based**: Redacts known sensitive field names
- **Deep Scanning**: Processes nested objects and arrays
- **Safe Defaults**: Errs on the side of caution for data protection

### Security Patterns

```typescript
// These patterns are automatically redacted:
const sensitiveData = {
  'password': 'secret123', // → '[redacted]'
  'authorization': 'Bearer token', // → '[redacted]'
  'api-key': 'key123', // → '[redacted]'
  'message': 'password=secret123', // → 'password="[redacted]"'
};
```

### Request/Response Sanitization

- **HTTP Headers**: Authorization headers automatically redacted
- **Request Bodies**: Sensitive fields in request payloads redacted
- **Response Data**: Sensitive response data protected
- **URL Parameters**: API keys in URLs redacted

## Performance Notes

### Efficient Redaction

- **Regex Optimization**: Compiled regex patterns for fast string processing
- **Depth Limiting**: Prevents performance issues with deep object graphs
- **Lazy Processing**: Redaction only applied when logging actually occurs
- **Memory Management**: Efficient memory usage for large object redaction

### Production Optimization

- **JSON Formatting**: Structured JSON logs for efficient parsing
- **Minimal Overhead**: Low-latency logging with async processing
- **Context Caching**: Efficient context retrieval from CLS storage

## Development Notes

### Architecture Pattern

Implements **Secure Structured Logging** pattern:

1. **Security by Default**: All logs automatically sanitized
2. **Context Injection**: Automatic correlation and user context
3. **Environment Adaptation**: Different formats for different environments
4. **Middleware Integration**: Seamless HTTP request/response logging

### Redaction Algorithm

```typescript
function redactSensitiveStrings(str: string): string {
  return protectedVariables.reduce((acc, key) => {
    const regex = new RegExp(`(${key})["']?[:=]\\s*["']?[^"'\n ]+`, 'gi');
    return acc.replace(regex, `$1="[redacted]"`);
  }, str);
}
```

### Context Integration

```typescript
// Automatic context injection from CLS
const cls = ClsServiceManager.getClsService();
const userId = cls.get('userId');
const appId = cls.get('appId');
const requestId = cls.getId();

// Injected into every log entry
{
  (context, error, params, userId, appId, requestId);
}
```

### Error Serialization

- **Standard Serializers**: Uses Pino standard serializers for consistent error formatting
- **Stack Trace Handling**: Proper stack trace serialization with security filtering
- **Cause Chain**: Preserves error cause chains for debugging

### Development Features

- **Pretty Printing**: Human-readable logs in development
- **Color Coding**: Colored output for easier development debugging
- **Single Line**: Compact format for development environments

### Production Features

- **JSON Format**: Machine-parseable structured logs
- **Performance Optimized**: Minimal logging overhead
- **Security Focused**: All sensitive data automatically protected
- **Correlation Ready**: Built-in correlation ID support for distributed tracing
