# Result Type Quick Start

## Import

```typescript
import { Ok, Err, Result } from '@app/common-shared';
```

## Basic Examples

### Simple Error Handling

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

### Async with Domain Errors

```typescript
import { AsyncDomainResult, ValidationError, NotFoundError } from '@app/common-shared';

async function getUser(id: string): AsyncDomainResult<User> {
  if (!id) {
    return Err(new ValidationError('ID required'));
  }

  const user = await db.findUser(id);
  if (!user) {
    return Err(new NotFoundError('User not found', { id }));
  }

  return Ok(user);
}
```

### Pattern Matching

```typescript
import { match } from '@app/common-shared';

const result = await getUser('123');
match(result, {
  ok: (user) => console.log('Found:', user),
  err: (error) => console.error(`[${error.code}]`, error.message),
});
```

## Available Exports

- **Types**: `Result`, `AsyncResult`, `DomainResult`, `AsyncDomainResult`
- **Constructors**: `Ok`, `Err`
- **Helpers**: `isOk`, `isErr`, `unwrapOr`, `map`, `andThen`, `all`, `tryCatch`
- **Errors**: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`,
  `InternalError`

See full documentation in `result-type-usage.md`
