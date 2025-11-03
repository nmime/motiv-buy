# Result<T, E> Type System Usage Guide

## Overview

The Result type system provides a robust, type-safe way to handle errors in your application. It's based on the `ts-results` library with additional utility functions and domain-specific error types.

## Installation

The Result types are available in the `@app/common-shared` package:

```typescript
import { Ok, Err, Result, AsyncResult } from '@app/common-shared';
```

## Basic Usage

### Simple Success/Error Handling

```typescript
import { Ok, Err, Result } from '@app/common-shared';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return Err('Division by zero');
  }
  return Ok(a / b);
}

// Check result and handle
const result = divide(10, 2);
if (result.ok) {
  console.log('Result:', result.val); // 5
} else {
  console.error('Error:', result.val);
}

// Using unwrapOr for safe default values
const value = divide(10, 0).unwrapOr(0); // Returns 0
```

### Async Operations

```typescript
import { Ok, Err, AsyncResult } from '@app/common-shared';

interface User {
  id: string;
  name: string;
  email: string;
}

interface ApiError {
  code: string;
  message: string;
}

async function fetchUser(id: string): AsyncResult<User, ApiError> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return Err({
        code: 'FETCH_ERROR',
        message: `HTTP ${response.status}`,
      });
    }
    const user = await response.json();
    return Ok(user);
  } catch (error) {
    return Err({
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Usage
const userResult = await fetchUser('123');
if (userResult.ok) {
  console.log('User:', userResult.val);
} else {
  console.error('Error:', userResult.val);
}
```

## Helper Functions

### isOk / isErr

```typescript
import { isOk, isErr } from '@app/common-shared';

const result = divide(10, 2);
if (isOk(result)) {
  // TypeScript knows result.val is a number
  console.log(result.val + 5);
}

if (isErr(result)) {
  // TypeScript knows result.val is a string
  console.error(result.val.toUpperCase());
}
```

### unwrapOr / unwrapOrElse

```typescript
import { unwrapOr, unwrapOrElse } from '@app/common-shared';

// Provide a default value
const value1 = unwrapOr(divide(10, 0), 0); // 0

// Compute default from error
const value2 = unwrapOrElse(divide(10, 0), (error) => {
  console.error('Error occurred:', error);
  return 0;
});
```

### map / mapErr

```typescript
import { map, mapErr } from '@app/common-shared';

const result = divide(10, 2);

// Map success value
const doubled = map(result, (x) => x * 2); // Ok(10)

// Map error
const customError = mapErr(result, (err) => new Error(err));
```

### andThen (flatMap/chain)

```typescript
import { andThen } from '@app/common-shared';

function sqrt(n: number): Result<number, string> {
  if (n < 0) {
    return Err('Cannot take square root of negative number');
  }
  return Ok(Math.sqrt(n));
}

// Chain operations
const result = andThen(divide(100, 4), sqrt); // Ok(5)
const error = andThen(divide(100, 0), sqrt); // Err('Division by zero')
```

### all / any

```typescript
import { all, any } from '@app/common-shared';

const results = [
  divide(10, 2), // Ok(5)
  divide(20, 4), // Ok(5)
  divide(30, 6), // Ok(5)
];

// Combine all - fails if any fails
const combined = all(results); // Ok([5, 5, 5])

// Get first success
const first = any([
  divide(10, 0), // Err
  divide(20, 4), // Ok(5)
  divide(30, 6), // Ok(5)
]); // Ok(5)
```

### tryCatch / tryCatchAsync

```typescript
import { tryCatch, tryCatchAsync } from '@app/common-shared';

// Wrap synchronous code
const jsonResult = tryCatch(() => JSON.parse('{"name": "John"}'));
// Ok({ name: "John" })

const badJsonResult = tryCatch(() => JSON.parse('invalid'));
// Err(SyntaxError: ...)

// Wrap async code
const asyncResult = await tryCatchAsync(async () => {
  const response = await fetch('/api/data');
  return response.json();
});
```

### fromNullable / toNullable

```typescript
import { fromNullable, toNullable } from '@app/common-shared';

const maybeValue: string | null = getUserName();

// Convert nullable to Result
const result = fromNullable(maybeValue, new Error('No username'));

// Convert Result back to nullable
const nullable = toNullable(result); // string | null
```

### match / matchMap

```typescript
import { match, matchMap } from '@app/common-shared';

const result = divide(10, 2);

// Execute side effects
match(result, {
  ok: (value) => console.log('Success:', value),
  err: (error) => console.error('Error:', error),
});

// Map to single type
const message = matchMap(result, {
  ok: (value) => `Success: ${value}`,
  err: (error) => `Error: ${error}`,
});
```

## Domain Error Types

Pre-defined error classes for common scenarios:

```typescript
import {
  DomainError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalError,
  DomainResult,
  AsyncDomainResult,
} from '@app/common-shared';

class UserService {
  async getUserById(id: string): AsyncDomainResult<User> {
    if (!id) {
      return Err(new ValidationError('User ID is required'));
    }

    const user = await this.repository.findById(id);
    if (!user) {
      return Err(new NotFoundError('User not found', { id }));
    }

    return Ok(user);
  }

  async updateUser(id: string, data: UpdateUserDto): AsyncDomainResult<User> {
    const userResult = await this.getUserById(id);
    if (userResult.err) {
      return userResult;
    }

    const user = userResult.val;

    try {
      const updated = await this.repository.update(user, data);
      return Ok(updated);
    } catch (error) {
      return Err(
        new InternalError('Failed to update user', {
          id,
          error: error instanceof Error ? error.message : 'Unknown',
        }),
      );
    }
  }
}

// Usage
const result = await userService.getUserById('123');
if (result.err) {
  const error = result.val;
  console.error(`[${error.code}] ${error.message}`, error.context);
}
```

## Complete Example: User Registration

```typescript
import {
  Ok,
  Err,
  DomainResult,
  AsyncDomainResult,
  ValidationError,
  ConflictError,
  InternalError,
  match,
} from '@app/common-shared';

interface CreateUserDto {
  email: string;
  password: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
}

class UserRegistrationService {
  validateInput(dto: CreateUserDto): DomainResult<void> {
    if (!dto.email || !dto.password || !dto.name) {
      return Err(new ValidationError('Missing required fields'));
    }

    if (!dto.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return Err(new ValidationError('Invalid email format'));
    }

    if (dto.password.length < 8) {
      return Err(new ValidationError('Password must be at least 8 characters'));
    }

    return Ok(undefined);
  }

  async checkUserExists(email: string): AsyncDomainResult<boolean> {
    try {
      const exists = await db.users.exists({ email });
      return Ok(exists);
    } catch (error) {
      return Err(new InternalError('Database error'));
    }
  }

  async createUser(dto: CreateUserDto): AsyncDomainResult<User> {
    // Validate input
    const validationResult = this.validateInput(dto);
    if (validationResult.err) {
      return validationResult;
    }

    // Check if user already exists
    const existsResult = await this.checkUserExists(dto.email);
    if (existsResult.err) {
      return existsResult;
    }

    if (existsResult.val) {
      return Err(new ConflictError('User already exists', { email: dto.email }));
    }

    // Create user
    try {
      const user = await db.users.create({
        id: generateId(),
        email: dto.email,
        name: dto.name,
        passwordHash: await hashPassword(dto.password),
      });

      return Ok({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      return Err(
        new InternalError('Failed to create user', {
          error: error instanceof Error ? error.message : 'Unknown',
        }),
      );
    }
  }
}

// Usage
const service = new UserRegistrationService();
const result = await service.createUser({
  email: 'user@example.com',
  password: 'securePassword123',
  name: 'John Doe',
});

match(result, {
  ok: (user) => {
    console.log('User created successfully:', user);
    // Send welcome email, redirect, etc.
  },
  err: (error) => {
    console.error(`Registration failed [${error.code}]:`, error.message);
    if (error.context) {
      console.error('Context:', error.context);
    }
    // Show error to user
  },
});
```

## API Reference

### Types

- `Result<T, E>` - A result that is either Ok<T> or Err<E>
- `AsyncResult<T, E>` - AsyncResult<T, E>>
- `DomainResult<T>` - Result<T, DomainError>
- `AsyncDomainResult<T>` - AsyncResult<T, DomainError>>

### Constructors

- `Ok<T>(value: T)` - Create a success result
- `Err<E>(error: E)` - Create an error result

### Checking Functions

- `isOk<T, E>(result: Result<T, E>): boolean`
- `isErr<T, E>(result: Result<T, E>): boolean`
- `isResult(value: unknown): boolean`

### Unwrapping Functions

- `result.unwrap()` - Unwrap or throw (built-in)
- `result.unwrapOr(defaultValue)` - Unwrap or use default (built-in)
- `unwrapOr<T, E>(result, defaultValue): T`
- `unwrapOrElse<T, E>(result, fn): T`

### Transformation Functions

- `map<T, U, E>(result, fn): Result<U, E>`
- `mapErr<T, E, F>(result, fn): Result<T, F>`
- `andThen<T, U, E>(result, fn): Result<U, E>`

### Combination Functions

- `all<T, E>(results: Result<T, E>[]): Result<T[], E>`
- `any<T, E>(results: Result<T, E>[]): Result<T, E>`

### Conversion Functions

- `tryCatch<T>(fn): Result<T, Error>`
- `tryCatchAsync<T>(fn): AsyncResult<T, Error>`
- `fromNullable<T, E>(value, error): Result<T, E>`
- `toNullable<T, E>(result): T | null`

### Pattern Matching

- `match<T, E>(result, handlers): void`
- `matchMap<T, E, U>(result, handlers): U`

### Error Classes

- `DomainError` - Base domain error with code and context
- `ValidationError` - For validation failures
- `NotFoundError` - For resource not found
- `UnauthorizedError` - For authentication failures
- `ForbiddenError` - For authorization failures
- `ConflictError` - For resource conflicts
- `InternalError` - For internal server errors

## Best Practices

1. **Always use Result for operations that can fail** - Don't throw exceptions for expected errors
2. **Use domain error types** - They provide consistent error structure across your application
3. **Chain operations with andThen** - Keep your code clean and avoid nested if statements
4. **Provide context in errors** - Use the context parameter to add debugging information
5. **Use match for side effects** - It's more explicit than if/else
6. **Prefer unwrapOr over unwrap** - Avoid runtime errors with safe defaults
7. **Type your AsyncResults** - Always specify both success and error types

## Migration from Throwing Exceptions

### Before

```typescript
async function getUser(id: string): Promise<User> {
  if (!id) {
    throw new Error('ID is required');
  }

  const user = await db.findUser(id);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Usage - requires try/catch
try {
  const user = await getUser('123');
  console.log(user);
} catch (error) {
  console.error(error);
}
```

### After

```typescript
async function getUser(id: string): AsyncDomainResult<User> {
  if (!id) {
    return Err(new ValidationError('ID is required'));
  }

  const user = await db.findUser(id);
  if (!user) {
    return Err(new NotFoundError('User not found', { id }));
  }

  return Ok(user);
}

// Usage - explicit error handling
const result = await getUser('123');
match(result, {
  ok: (user) => console.log(user),
  err: (error) => console.error(`[${error.code}]`, error.message),
});
```

## Related Packages

- [ts-results](https://github.com/vultix/ts-results) - The underlying Result library
- Rust's Result type - Inspiration for this pattern
- Functional programming error handling
