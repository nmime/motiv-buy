# ADR-001: Exception Type System Refactoring

**Date:** 2025-10-02
**Status:** Implemented
**Deciders:** System Architecture Team

## Context

The TypeScript compilation was failing due to type incompatibilities between the `@ApiProblemExceptions` decorator and exception classes with specific constructor signatures.

### Root Causes

1. **Strict Constructor Typing**: The `ExceptionClass` type required exact constructor signature matching `new (...args: unknown[])`, but exception classes had specific parameter types
2. **Missing Type Flexibility**: No default generic parameter for `ExceptionClass`, causing type inference issues
3. **Immutability Requirements**: Exception static properties needed `readonly` modifiers

## Decision

### 1. Update ExceptionClass Type Definition

Made the following changes to `/libs/common/exception/src/type/exception-class.type.ts`:

```typescript
export type ExceptionClass<DataType extends OptionalClassConstructor = undefined> = (
  new (...args: unknown[]) => BaseException<DataType>
) & {
  readonly kind: ExceptionKind;
  readonly dataType?: DataType;
  readonly problemType?: string;
  readonly title?: string;
};
```

**Key Changes:**
- Added default generic parameter `= undefined`
- Made all static properties optional with `?`
- Added `readonly` modifiers for immutability
- Maintained constructor signature flexibility with `...args: unknown[]`

### 2. Type System Benefits

- **Backward Compatibility**: Existing exception classes work without modification
- **Flexible Constructors**: Supports exceptions with varying constructor signatures
- **Type Safety**: Maintains compile-time type checking
- **Optional Properties**: Allows gradual migration of exception classes

## Consequences

### Positive
- All 25 projects now compile successfully
- No breaking changes to existing exception classes
- Better type inference for decorators
- Improved developer experience

### Negative
- Slight reduction in type strictness (mitigated by readonly modifiers)
- Requires understanding of TypeScript's structural typing

## Alternative Considered

**Option 1:** Create wrapper types for each exception class
- **Rejected**: Too much boilerplate and maintenance overhead

**Option 2:** Use conditional types to infer constructor signatures
- **Rejected**: Overly complex and fragile type system

**Option 3:** Separate decorator types from exception types
- **Rejected**: Would break existing API contracts

## Implementation Notes

The change leverages TypeScript's structural type system where:
1. Constructor signatures are checked structurally, not nominally
2. `unknown[]` accepts any argument list
3. Optional properties with defaults provide flexibility
4. `readonly` enforces immutability at compile time

## Related ADRs
- ADR-002: DTO Export Strategy (see traffic module fixes)

## References
- TypeScript Handbook: Structural Type System
- NestJS Exception Handling Patterns
- Problem Details for HTTP APIs (RFC 7807)
