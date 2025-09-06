# Exception

## Purpose and Responsibilities

The `exception` library provides a comprehensive, standardized exception handling system for the xRocket platform. It defines custom exception types, HTTP status code mappings, validation errors, and provides consistent error responses across all services. The library ensures type-safe error handling with structured error data and proper HTTP status code mapping.

## Key Components

### Custom Exception Types

#### InternalException

- **Purpose**: Internal server errors and unexpected failures
- **HTTP Status**: 500 (Internal Server Error)
- **Use Case**: System failures, database errors, external service failures

#### NotImplementedException

- **Purpose**: Features or endpoints not yet implemented
- **HTTP Status**: 501 (Not Implemented)
- **Use Case**: Placeholder endpoints, future features

#### InvalidCursorException

- **Purpose**: Pagination cursor validation errors
- **HTTP Status**: 400 (Bad Request)
- **Use Case**: Invalid pagination parameters

#### InvalidLimitException

- **Purpose**: Pagination limit validation errors
- **HTTP Status**: 400 (Bad Request)
- **Use Case**: Invalid limit values in paginated requests

#### RateLimitExceededException

- **Purpose**: API rate limiting violations
- **HTTP Status**: 429 (Too Many Requests)
- **Use Case**: API throttling, abuse prevention

### Exception Infrastructure

#### ExceptionHttpStatusMapper

- **HTTP Status Mapping**: Maps exception kinds to appropriate HTTP status codes
- **Kind-to-Status Translation**: Provides consistent HTTP responses
- **Reverse Mapping**: Maps HTTP status codes back to exception kinds

#### HttpStatusMapper

- **Utility Functions**: Additional HTTP status mapping utilities
- **Status Code Constants**: Centralized HTTP status code definitions

## Dependencies

### External Dependencies

- `@nestjs/common` - NestJS core functionality for exception handling
- `ts-results` - Result type for functional error handling

### Internal Dependencies

- `@app/common-shared` - Shared utilities for error processing

## Integration Points

### Global Exception Handling

- **Response Transformers**: Integrates with response transformation middleware
- **HTTP Filters**: Works with NestJS exception filters for consistent error responses
- **Problem Response**: Supports RFC 9457 Problem Details for HTTP APIs

### Validation Integration

- **DTOs**: Used in Data Transfer Objects for validation errors
- **Pipes**: Integrates with NestJS validation pipes
- **Guards**: Works with authentication and authorization guards

## Usage Patterns

### Basic Exception Throwing

```typescript
@Injectable()
export class UserService {
  async findUser(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new InternalException({
        title: 'User Not Found',
        detail: `User with ID ${id} does not exist`,
        instance: `/users/${id}`,
      });
    }

    return user;
  }
}
```

### Validation Exceptions

```typescript
@Post('users')
async createUser(@Body() userData: CreateUserDto) {
  if (userData.limit > 1000) {
    throw new InvalidLimitException({
      detail: 'User limit cannot exceed 1000',
      instance: '/users'
    });
  }

  return this.userService.create(userData);
}
```

### Rate Limiting

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (this.isRateLimited(request)) {
      throw new RateLimitExceededException({
        title: 'Rate Limit Exceeded',
        detail: 'Too many requests, please try again later',
        instance: request.url,
      });
    }

    return true;
  }
}
```

### Functional Error Handling

```typescript
import { Result } from 'ts-results';

async processPayment(paymentData: any): Promise<Result<Payment, InternalException>> {
  try {
    const payment = await this.paymentService.process(paymentData);
    return Result.ok(payment);
  } catch (error) {
    return Result.err(new InternalException({
      title: 'Payment Processing Failed',
      detail: 'Unable to process payment due to system error',
      cause: error
    }));
  }
}
```

### Exception with Context

```typescript
async withdrawFunds(userId: string, amount: number) {
  try {
    return await this.walletService.withdraw(userId, amount);
  } catch (error) {
    throw new InternalException({
      title: 'Withdrawal Failed',
      detail: 'Unable to process withdrawal request',
      instance: `/users/${userId}/withdrawals`,
      cause: error // Original error preserved for debugging
    });
  }
}
```

## Configuration

### HTTP Status Mapping

```typescript
const statusMappings = {
  [ExceptionKind.Internal]: 500,
  [ExceptionKind.BadRequest]: 400,
  [ExceptionKind.Unauthorized]: 401,
  [ExceptionKind.Forbidden]: 403,
  [ExceptionKind.NotFound]: 404,
  [ExceptionKind.Conflict]: 409,
  [ExceptionKind.TooManyRequests]: 429,
};
```

### Exception Response Format

```typescript
interface ExceptionResponse {
  name: string; // Exception class name
  kind: ExceptionKind; // Exception category
  message: string; // Human-readable error message
  data?: unknown; // Additional error context
}
```

## Security Considerations

- **Error Message Sanitization**: Prevents exposure of sensitive system information
- **Stack Trace Filtering**: Stack traces excluded from production error responses
- **Input Validation**: Comprehensive validation prevents injection attacks
- **Rate Limiting**: Built-in rate limiting exceptions help prevent abuse

## Performance Notes

- **Lightweight Exceptions**: Minimal overhead for exception creation and handling
- **Efficient Mapping**: Fast HTTP status code mapping using lookup tables
- **Error Aggregation**: Supports batching of validation errors for efficiency

## Development Notes

### Architecture Pattern

Implements **Structured Exception Handling** pattern:

1. **Exception Hierarchy**: Organized exception types with clear inheritance
2. **Status Code Mapping**: Automatic HTTP status code assignment
3. **Context Preservation**: Original error context maintained for debugging
4. **Type Safety**: Full TypeScript support for exception handling

### Exception Hierarchy

```
BaseException
├── InternalException (500)
├── NotImplementedException (501)
├── InvalidCursorException (400)
├── InvalidLimitException (400)
└── RateLimitExceededException (429)
```

### Exception Factory Pattern

```typescript
export class Exception {
  static create(options: { kind: ExceptionKind; problemType: string; title: string }) {
    return class extends BaseException {
      constructor(options?: ExceptionOptions) {
        super({
          kind: options.kind,
          problemType: options.problemType,
          title: options.title || options.title,
          detail: options.detail,
          instance: options.instance,
          cause: options.cause,
        });
      }
    };
  }
}
```

### Error Response Standards

- **RFC 9457 Compliance**: Follows Problem Details for HTTP APIs standard
- **Consistent Structure**: All errors use standardized response format
- **Machine Readable**: Structured error data for automated error handling
- **Human Readable**: Clear error messages for developers and users

### Integration with NestJS

- **Exception Filters**: Custom filters handle exception-to-response transformation
- **Interceptors**: Response interceptors normalize error responses
- **Guards**: Exception types integrate with authentication and authorization
- **Pipes**: Validation pipes throw appropriate exception types

### Deprecation Notes

- **ResponseTransformer**: Deprecated in favor of ProblemResponseTransformer for RFC 9457 compliance
- **Legacy Message Field**: `message` field deprecated in favor of `detail` field
- **Migration Path**: Clear upgrade path to newer exception handling patterns
