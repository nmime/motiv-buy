# ADR-002: Traffic DTO Naming Convention

**Date:** 2025-10-02
**Status:** Implemented
**Deciders:** System Architecture Team

## Context

The traffic-main module imports `TrafficOrderDto` and `TrafficOrderStatusDto` from traffic-shared, but these DTOs don't exist. Available DTOs use different naming:
- `TrafficOrderResponseDto` (detailed order with status)
- `CreateTrafficOrderDto` (order creation)
- `UpdateTrafficOrderDto` (order updates)

### Error Messages
```
error TS2305: Module '"@app/feature-traffic-shared"' has no exported member 'TrafficOrderDto'.
error TS2305: Module '"@app/feature-traffic-shared"' has no exported member 'TrafficOrderStatusDto'.
```

## Decision

### Export Type Aliases for Backward Compatibility

Create type aliases in `/libs/feature/traffic/shared/src/dto/traffic-purchase.dto.ts`:

```typescript
// Backward compatibility type aliases
export type TrafficOrderDto = TrafficOrderResponseDto;
export type TrafficOrderStatusDto = Pick<TrafficOrderResponseDto, 'status' | 'progressPercentage'>;
```

### Rationale

1. **Minimal Impact**: Doesn't require changes to controller code
2. **Semantic Clarity**: `TrafficOrderDto` clearly maps to response DTO
3. **Type Safety**: TypeScript validates the aliasing at compile time
4. **Migration Path**: Provides clear upgrade path to use explicit response DTOs

## Alternatives Considered

### Option 1: Create New Separate DTOs
**Rejected**: Creates unnecessary duplication and divergence

### Option 2: Rename Existing DTOs
**Rejected**: Breaking change across all consumers

### Option 3: Update All Import Statements
**Rejected**: Higher risk, more files to modify

## Implementation

### Phase 1: Add Type Aliases (Immediate)
```typescript
export type TrafficOrderDto = TrafficOrderResponseDto;
export type TrafficOrderStatusDto = Pick<TrafficOrderResponseDto, 'status' | 'progressPercentage'>;
```

### Phase 2: Update Index Exports
```typescript
export * from './traffic-purchase.dto';
// Ensures all aliases are re-exported
```

## Consequences

### Positive
- Zero breaking changes to existing code
- Clear semantic meaning for DTOs
- Easy to refactor later if needed
- Maintains type safety

### Negative
- Introduces multiple names for same concept
- May confuse new developers (mitigated by documentation)

## Documentation Requirements

1. Update API documentation to prefer `TrafficOrderResponseDto`
2. Add JSDoc comments explaining the aliases
3. Create migration guide for future refactoring

## Related Patterns

This follows the **Adapter Pattern** at the type level, allowing old interfaces to work with new implementations without code changes.

## Metrics

- **Files Modified**: 1 (traffic-purchase.dto.ts)
- **Breaking Changes**: 0
- **Compilation Time**: No impact
- **Runtime Performance**: No impact (compile-time only)

## References
- TypeScript Type Aliases Documentation
- NestJS DTO Best Practices
- API Versioning Strategies
