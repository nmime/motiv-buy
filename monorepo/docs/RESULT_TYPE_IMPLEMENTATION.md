# Result<T, E> Type System Implementation Summary

## Overview

A comprehensive Result type system has been implemented in
`/Users/nmi/IT/Projects/motiv-buy/monorepo/libs/common/shared/src/types/result.type.ts` that provides type-safe error
handling throughout the monorepo.

## What Was Created

### 1. Core Result Types (`result.type.ts`)

**Location**: `/Users/nmi/IT/Projects/motiv-buy/monorepo/libs/common/shared/src/types/result.type.ts`

**Exports**:

- `Ok<T>` - Constructor for success results
- `Err<E>` - Constructor for error results
- `Result<T, E>` - Union type for Ok<T> | Err<E>
- `AsyncResult<T, E>` - AsyncResult<T, E>> (re-exported from class-constructor.types)

### 2. Helper Functions

**Type Guards**:

- `isOk<T, E>(result)` - Check if result is Ok
- `isErr<T, E>(result)` - Check if result is Err
- `isResult(value)` - Check if value is a Result

**Unwrapping**:

- `unwrapOr<T, E>(result, defaultValue)` - Unwrap or return default
- `unwrapOrElse<T, E>(result, fn)` - Unwrap or compute from error

**Transformations**:

- `map<T, U, E>(result, fn)` - Map success value
- `mapErr<T, E, F>(result, fn)` - Map error value
- `andThen<T, U, E>(result, fn)` - Chain operations (flatMap)

**Combining**:

- `all<T, E>(results)` - Combine all results (fails if any fails)
- `any<T, E>(results)` - Get first success or last error

**Exception Handling**:

- `tryCatch<T>(fn)` - Wrap throwing function
- `tryCatchAsync<T>(fn)` - Wrap async throwing function

**Nullable Conversion**:

- `fromNullable<T, E>(value, error)` - Convert nullable to Result
- `toNullable<T, E>(result)` - Convert Result to nullable

**Pattern Matching**:

- `match<T, E>(result, handlers)` - Execute side effects
- `matchMap<T, E, U>(result, handlers)` - Map to single type

### 3. Domain Error Classes

Pre-built error types for common scenarios:

- `DomainError` - Base class with code and context
- `ValidationError` - For validation failures (code: VALIDATION_ERROR)
- `NotFoundError` - For resource not found (code: NOT_FOUND)
- `UnauthorizedError` - For authentication failures (code: UNAUTHORIZED)
- `ForbiddenError` - For authorization failures (code: FORBIDDEN)
- `ConflictError` - For resource conflicts (code: CONFLICT)
- `InternalError` - For internal errors (code: INTERNAL_ERROR)

**Domain Result Types**:

- `DomainResult<T>` - Result<T, DomainError>
- `AsyncDomainResult<T>` - AsyncResult<T, DomainError>>

## How to Use

### Import

```typescript
import { Ok, Err, Result, AsyncResult } from '@app/common-shared';
```

### Basic Usage

```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return Err('Division by zero');
  }
  return Ok(a / b);
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.val); // 5
} else {
  console.error(result.val);
}
```

### With Domain Errors

```typescript
import { AsyncDomainResult, ValidationError, NotFoundError, match } from '@app/common-shared';

async function getUserById(id: string): AsyncDomainResult<User> {
  if (!id) {
    return Err(new ValidationError('ID is required'));
  }

  const user = await db.findUser(id);
  if (!user) {
    return Err(new NotFoundError('User not found', { id }));
  }

  return Ok(user);
}

// Usage
const result = await getUserById('123');
match(result, {
  ok: (user) => console.log('Found:', user),
  err: (error) => console.error(`[${error.code}]`, error.message),
});
```

## Files Created

1. `/Users/nmi/IT/Projects/motiv-buy/monorepo/libs/common/shared/src/types/result.type.ts` - Main implementation
2. `/Users/nmi/IT/Projects/motiv-buy/monorepo/libs/common/shared/src/types/__tests__/result.type.spec.ts` -
   Comprehensive tests
3. `/Users/nmi/IT/Projects/motiv-buy/monorepo/docs/result-type-usage.md` - Complete usage documentation
4. `/Users/nmi/IT/Projects/motiv-buy/monorepo/docs/result-type-quickstart.md` - Quick reference guide

## Integration

The Result types are now available globally via:

```typescript
import { Ok, Err, Result, ... } from '@app/common-shared';
```

The types are built on top of the existing `ts-results` package (already installed in package.json) and extend it with:

- Additional helper functions
- Domain-specific error classes
- TypeScript-friendly type guards
- Pattern matching utilities

## Testing

Run tests:

```bash
cd /Users/nmi/IT/Projects/motiv-buy/monorepo
npm run test -- libs/common/shared
```

## Build Verification

The library builds successfully and exports are confirmed:

```bash
cd /Users/nmi/IT/Projects/motiv-buy/monorepo
npm run build:libs
# Or specifically:
npx nx build @app/common-shared
```

## Next Steps

1. **Migrate existing error handling**: Replace `throw new Error()` with `return Err()` in services
2. **Update service signatures**: Change `Promise<T>` to `AsyncDomainResult<T>` for operations that can fail
3. **Add tests**: Use the test file as a template for testing your services
4. **Documentation**: Reference the usage guides when training team members

## Benefits

1. **Type Safety**: Errors are part of the type signature
2. **Explicit Error Handling**: No hidden exceptions
3. **Composable**: Chain operations with `andThen`, `map`, etc.
4. **Consistent**: Domain errors provide uniform structure
5. **Debuggable**: Context fields help with debugging

## Example Migration

### Before (Exception-based)

```typescript
async function getUser(id: string): Promise<User> {
  if (!id) throw new Error('ID required');
  const user = await db.findUser(id);
  if (!user) throw new Error('Not found');
  return user;
}

// Usage requires try/catch
try {
  const user = await getUser('123');
  console.log(user);
} catch (error) {
  console.error(error);
}
```

### After (Result-based)

```typescript
async function getUser(id: string): AsyncDomainResult<User> {
  if (!id) return Err(new ValidationError('ID required'));
  const user = await db.findUser(id);
  if (!user) return Err(new NotFoundError('Not found', { id }));
  return Ok(user);
}

// Usage is explicit
const result = await getUser('123');
match(result, {
  ok: (user) => console.log(user),
  err: (error) => console.error(`[${error.code}]`, error.message),
});
```

## Related Documentation

- Full API Reference: [result-type-usage.md](./result-type-usage.md)
- Quick Start: [result-type-quickstart.md](./result-type-quickstart.md)
- ts-results Library: https://github.com/vultix/ts-results

## Architecture Decision

This implementation:

- ✅ Uses the existing `ts-results` package (already in dependencies)
- ✅ Extends it with domain-specific utilities
- ✅ Avoids duplication (re-exports AsyncResult from class-constructor.types)
- ✅ Provides consistent error handling across the monorepo
- ✅ Maintains backward compatibility (doesn't break existing code)

## Support

For questions or issues with the Result type system:

1. Check the documentation in `docs/result-type-usage.md`
2. Review the test file for usage examples
3. Refer to ts-results documentation for advanced features
