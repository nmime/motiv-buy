# Development Guidelines & Code Standards

## Table of Contents
1. [Project Overview](#project-overview)
2. [Critical Rules](#critical-rules)
3. [Module Architecture](#module-architecture)
4. [Type Safety & TypeScript](#type-safety--typescript)
5. [Decimal Arithmetic](#decimal-arithmetic)
6. [Code Style & Patterns](#code-style--patterns)
7. [File Organization](#file-organization)
8. [Build & Development](#build--development)

---

## Project Overview

NestJS monorepo application with:
- **API Application** (`apps/api`) - REST API backend
- **Bot Application** (`apps/bot`) - Telegram bot interface
- **Shared Libraries** (`libs/`) - Common functionality used by both apps

**Stack:**
- TypeScript (strict mode)
- NestJS framework
- MikroORM with PostgreSQL
- Telegram Bot API
- Decimal.js for financial calculations

---

## Critical Rules

### 🚨 MANDATORY - NO EXCEPTIONS

1. **NO `any` TYPE**
   - Use proper types, interfaces, or `unknown`
   - Use type guards for runtime type checking
   - Example: `if (isString(value))` instead of `value as string`

2. **NO `as` TYPE ASSERTIONS**
   - Use type guards instead
   - Only use `as const` for literal types
   - Only use assertions when critically needed with clear justification

3. **NO FLOATING-POINT ARITHMETIC**
   - Use Decimal.js for ALL monetary/financial calculations
   - Never use native `+`, `-`, `*`, `/` for money
   - See [Decimal Arithmetic](#decimal-arithmetic) section

4. **USE MAPS INSTEAD OF SWITCH/IF-ELSE-IF**
   - Use object/Map lookups for O(1) performance
   - See [Code Patterns](#code-patterns) section

5. **NEVER IMPORT `main` MODULES IN `libs`**
   - Causes circular dependencies
   - Only apps can import from `libs/*/main`
   - See [Module Architecture](#module-architecture)

---

## Module Architecture

### Directory Structure

```
monorepo/
├── apps/
│   ├── api/              # REST API application
│   └── bot/              # Telegram bot application
└── libs/
    ├── common/           # Cross-domain utilities
    │   ├── exception/
    │   ├── logger/
    │   ├── validation/
    │   └── shared/       # Common utilities for ALL domains
    ├── database/         # Database entities & repositories
    └── feature/          # Domain-specific modules
        ├── auth/
        │   ├── main/     # Business logic (apps import)
        │   └── shared/   # Types/DTOs (other libs import)
        ├── payment/
        ├── balance/
        └── traffic/
```

### Module Import Rules

#### ✅ CORRECT Imports

```typescript
// Apps can import from libs/*/main
import { PaymentService } from '@app/feature-payment-main';
import { UserRepository } from '@app/database';

// Libs can import from libs/*/shared
import { CreateInvoiceDto } from '@app/feature-payment-shared';
import { CurrencyCode } from '@app/database';

// Libs can import from libs/common
import { Logger } from '@app/common-logger';
import { ValidationPipe } from '@app/common-validation';
```

#### ❌ WRONG Imports

```typescript
// NEVER: libs importing from other libs/*/main
// libs/feature/balance/main/service.ts
import { PaymentService } from '@app/feature-payment-main'; // ❌ CIRCULAR DEPENDENCY!

// NEVER: importing from apps
// libs/feature/auth/main/service.ts
import { AppController } from '@app/api'; // ❌ WRONG DIRECTION!
```

### Module Organization Rules

1. **`libs/feature/*/main`**
   - Business logic, services, controllers
   - **ONLY** imported by apps (`apps/api`, `apps/bot`)
   - Cannot be imported by other libs

2. **`libs/feature/*/shared`**
   - DTOs, types, interfaces, enums, constants
   - Can be imported by other libs
   - No business logic

3. **`libs/common/*`**
   - Cross-cutting concerns (logging, validation, exceptions)
   - Can be imported by all libs and apps

4. **`libs/database`**
   - Entities, repositories, database utilities
   - Can be imported by all libs and apps

---

## Type Safety & TypeScript

### Strict TypeScript Configuration

All strict flags MUST be enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Type Guards Over Assertions

**❌ WRONG - Type Assertion:**
```typescript
function processUser(data: unknown) {
  const user = data as User; // ❌ Unsafe!
  console.log(user.name);
}
```

**✅ CORRECT - Type Guard:**
```typescript
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'email' in data &&
    typeof data.name === 'string' &&
    typeof data.email === 'string'
  );
}

function processUser(data: unknown) {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  console.log(data.name); // ✅ Type-safe!
}
```

### Using `unknown` Instead of `any`

**❌ WRONG:**
```typescript
function handleError(error: any) { // ❌ any hides bugs
  console.log(error.message);
}
```

**✅ CORRECT:**
```typescript
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.log(error.message); // ✅ Type-safe
  } else {
    console.log('Unknown error:', error);
  }
}
```

---

## Decimal Arithmetic

### Why Decimal.js?

JavaScript's native numbers use floating-point arithmetic with precision issues:

```javascript
0.1 + 0.2 === 0.3  // false! (actually 0.30000000000000004)
0.1 + 0.7 === 0.8  // false! (0.7999999999999999)
```

**Use Decimal.js for ALL financial calculations!**

### Decimal Utility Functions

Import from `@app/common-shared/util`:

```typescript
import {
  decimal,        // Create Decimal instance
  add,            // Addition
  subtract,       // Subtraction
  multiply,       // Multiplication
  divide,         // Division
  sum,            // Sum array of values
  percentage,     // Calculate percentage
  toDbString,     // Format for database (string)
  toDisplayString,// Format for UI display
  toNumber,       // Convert to number (use only for display)
} from '@app/common-shared/util';
```

### Examples

**❌ WRONG - Native Arithmetic:**
```typescript
// Payment calculation
const total = parseFloat(price) + parseFloat(tax);
const discount = total * 0.1;
const final = total - discount;

// Balance update
userBalance.balance = (parseFloat(balance) + amount).toString();

// Currency conversion
const converted = amount * parseFloat(rate);
```

**✅ CORRECT - Decimal.js:**
```typescript
// Payment calculation
const total = add(price, tax);
const discount = multiply(total, '0.1');
const final = subtract(total, discount);

// Balance update
userBalance.balance = toDbString(add(balance, amount), 8);

// Currency conversion
const converted = multiply(amount, rate);
```

### Migration Patterns

| Native JavaScript | Decimal.js Utility |
|-------------------|-------------------|
| `parseFloat(x)` | `decimal(x)` |
| `x + y` | `add(x, y)` |
| `x - y` | `subtract(x, y)` |
| `x * y` | `multiply(x, y)` |
| `x / y` | `divide(x, y)` |
| `Math.abs(x)` | `abs(x)` |
| `array.reduce((s, v) => s + v, 0)` | `sum(array)` |
| `(value / total) * 100` | `percentage(value, total)` |
| `.toFixed(8)` (storage) | `toDbString(value, 8)` |
| `.toFixed(2)` (display) | `toDisplayString(value, 2)` |

### When to Use `toNumber()`

Only convert Decimal to number for **final display** purposes:

```typescript
// ✅ CORRECT
const balance = decimal(user.balance);
const pending = decimal(user.pendingAmount);
const available = subtract(balance, pending);

// Return to API/UI (only here we convert to number)
return {
  balance: toNumber(balance),
  available: toNumber(available),
};

// ❌ WRONG - Don't convert mid-calculation
const balanceNum = toNumber(decimal(user.balance)); // ❌
const result = balanceNum - pendingNum; // ❌ Lost precision!
```

---

## Code Style & Patterns

### Use Maps Instead of Switch/If-Else-If

**❌ AVOID - Switch/Case:**
```typescript
function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending':
      return 'Order is pending';
    case 'processing':
      return 'Order is being processed';
    case 'completed':
      return 'Order completed';
    case 'cancelled':
      return 'Order cancelled';
    default:
      return 'Unknown status';
  }
}
```

**❌ AVOID - If-Else-If Chain:**
```typescript
function getStatusMessage(status: string): string {
  if (status === 'pending') {
    return 'Order is pending';
  } else if (status === 'processing') {
    return 'Order is being processed';
  } else if (status === 'completed') {
    return 'Order completed';
  } else if (status === 'cancelled') {
    return 'Order cancelled';
  }
  return 'Unknown status';
}
```

**✅ CORRECT - Object/Map Lookup:**
```typescript
const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Order is pending',
  processing: 'Order is being processed',
  completed: 'Order completed',
  cancelled: 'Order cancelled',
} as const;

function getStatusMessage(status: string): string {
  return STATUS_MESSAGES[status] ?? 'Unknown status';
}
```

**✅ CORRECT - Map with Functions:**
```typescript
type StatusHandler = (order: Order) => Promise<void>;

const STATUS_HANDLERS: Record<OrderStatus, StatusHandler> = {
  pending: async (order) => await sendPendingEmail(order),
  processing: async (order) => await notifyWarehouse(order),
  completed: async (order) => await sendInvoice(order),
  cancelled: async (order) => await refundPayment(order),
};

async function handleStatus(status: OrderStatus, order: Order): Promise<void> {
  const handler = STATUS_HANDLERS[status];
  if (!handler) {
    throw new Error(`Unknown status: ${status}`);
  }
  await handler(order);
}
```

**Benefits:**
- **Performance**: O(1) lookup vs O(n) comparisons
- **Maintainability**: Add/remove cases without modifying function logic
- **Readability**: Clear separation of data and behavior
- **Type Safety**: Better TypeScript inference with Record types
- **Testability**: Easy to test individual mappings

### Additional Code Patterns

#### Error Handling

```typescript
// ✅ Use Result type for operations that can fail
import { Result, Ok, Err } from '@app/common-shared';

async function createPayment(dto: CreatePaymentDto): Promise<Result<Payment, Error>> {
  try {
    const payment = await this.paymentRepository.create(dto);
    return Ok(payment);
  } catch (error) {
    return Err(toError(error));
  }
}

// Usage
const result = await createPayment(dto);
if (result.err) {
  logger.error('Payment failed', result.val);
  throw result.val;
}
const payment = result.val;
```

#### Async/Await Best Practices

```typescript
// ✅ CORRECT - Parallel independent operations
const [user, balance, orders] = await Promise.all([
  this.userRepository.findById(userId),
  this.balanceRepository.findByUser(userId),
  this.orderRepository.findByUser(userId),
]);

// ❌ WRONG - Sequential when could be parallel
const user = await this.userRepository.findById(userId);
const balance = await this.balanceRepository.findByUser(userId);
const orders = await this.orderRepository.findByUser(userId);
```

#### Validation

```typescript
// ✅ Use class-validator decorators
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  amount: string; // Decimal as string

  @IsNumber()
  @Min(1)
  @Max(1000)
  quantity: number;
}
```

---

## File Organization

### Project Structure Rules

1. **NEVER save files to root folder**
   - No working files, markdown, or tests in root
   - Use appropriate subdirectories

2. **Directory Usage:**
   - `/apps/*` - Application entry points
   - `/libs/*` - Shared libraries
   - `/docs/*` - Documentation
   - `/scripts/*` - Utility scripts
   - `/config/*` - Configuration files

3. **File Naming Conventions:**
   - Services: `*.service.ts`
   - Controllers: `*.controller.ts`
   - Repositories: `*.repository.ts`
   - Entities: `*.entity.ts`
   - DTOs: `*.dto.ts`
   - Interfaces: `*.interface.ts`
   - Types: `*.types.ts`
   - Constants: `*.constants.ts`

### File Size Limits

- **Maximum 500 lines per file**
- If file exceeds 500 lines, split into:
  - Multiple smaller services
  - Separate helper utilities
  - Extract constants/types to separate files

---

## Build & Development

### Commands

```bash
# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm run test

# Database migrations
npm run migration:create
npm run migration:up
npm run migration:down
```

### Environment Variables

**NEVER hardcode secrets or configuration!**

```typescript
// ✅ CORRECT
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {}

const apiKey = this.configService.get<string>('CRYPTO_BOT_API_KEY');

// ❌ WRONG
const apiKey = 'hardcoded-key-123'; // ❌ NEVER DO THIS!
```

### Database Best Practices

```typescript
// ✅ Use decimal(20,8) for monetary values
@Property({ type: 'decimal(20,8)' })
balance: string;

// ✅ Use indexes for frequently queried fields
@Index()
@Property()
userId: string;

// ✅ Use transactions for multi-step operations
await this.em.transactional(async (em) => {
  const user = await em.findOne(UserEntity, { id: userId });
  user.balance = newBalance;
  await em.flush();
});
```

---

## Best Practices Summary

### DO ✅

- Use TypeScript strict mode
- Use Decimal.js for all financial calculations
- Use type guards instead of assertions
- Use Maps/objects instead of switch/if-else chains
- Use Result type for fallible operations
- Use proper module separation (main vs shared)
- Use environment variables for configuration
- Write tests before implementation (TDD)
- Keep files under 500 lines
- Use meaningful variable/function names
- Document complex logic with comments
- Use async/await instead of promises
- Validate all user inputs
- Handle all error cases
- Use transactions for multi-step database operations

### DON'T ❌

- Don't use `any` type
- Don't use `as` assertions (except `as const`)
- Don't use native arithmetic for money (`+`, `-`, `*`, `/`)
- Don't use switch/case or if-else-if chains
- Don't import `main` modules in libs
- Don't hardcode secrets or configuration
- Don't save files to root folder
- Don't create files over 500 lines
- Don't use `parseFloat` for financial data
- Don't convert Decimal to number mid-calculation
- Don't skip error handling
- Don't ignore TypeScript errors
- Don't commit commented-out code
- Don't use magic numbers (use constants)

---

## Additional Resources

- **Complete Guidelines**: `/docs/DEVELOPMENT-GUIDELINES.md`
- **API Documentation**: Generated via Swagger/OpenAPI
- **Database Schema**: See MikroORM entities in `/libs/database`
- **Testing Guide**: `/docs/TESTING.md` (if exists)

---

## Questions or Issues?

1. Check `/docs/DEVELOPMENT-GUIDELINES.md` for detailed standards
2. Review existing code for patterns and examples
3. Ask team members for clarification
4. Create an issue in the repository for discussion

---

**Remember**: Code quality and type safety are non-negotiable. These standards exist to prevent bugs, ensure maintainability, and protect financial data integrity.
