# Development Guidelines & Code Standards

> **IMPORTANT FOR AI AGENTS**: Read this entire document before writing ANY code. These rules are MANDATORY and violations will break the build.

---

## STOP - READ BEFORE YOU CODE

### MANDATORY PRE-CODING CHECKLIST

Before writing ANY code, you MUST:

1. **SEARCH for existing functions** - Run grep/search for similar functionality before creating new functions
2. **CHECK locale files** - All user-facing strings MUST exist in `libs/common/intl/locales/{en,ru}/*.json`
3. **VERIFY imports** - Never import `@app/feature-*-main` from within `libs/`
4. **USE Decimal.js** - Any arithmetic with money MUST use `@app/common-shared/util` functions

---

## CRITICAL RULES - VIOLATIONS WILL FAIL BUILD

### RULE 1: NO `any` TYPE

```typescript
// FORBIDDEN - Will fail lint
function process(data: any) { }

// REQUIRED - Use unknown + type guards
function process(data: unknown) {
  if (isValidData(data)) { /* safe */ }
}
```

**Action**: Use `unknown` with type guards. Never use `any`.

---

### RULE 2: NO `as` TYPE ASSERTIONS

```typescript
// FORBIDDEN - Unsafe cast
const user = data as User;

// REQUIRED - Type guard
if (isUser(data)) {
  const user = data; // Type-safe
}
```

**Exception**: `as const` for literal types is allowed.

---

### RULE 3: NO NATIVE ARITHMETIC FOR MONEY

```typescript
// FORBIDDEN - Precision loss
const total = price + tax;
const result = amount * rate;

// REQUIRED - Decimal.js utilities
import { add, multiply, subtract, divide } from '@app/common-shared/util';
const total = add(price, tax);
const result = multiply(amount, rate);
```

**Import map**:
| Operation | Function |
|-----------|----------|
| `a + b` | `add(a, b)` |
| `a - b` | `subtract(a, b)` |
| `a * b` | `multiply(a, b)` |
| `a / b` | `divide(a, b)` |
| `parseFloat(x)` | `decimal(x)` |
| `.toFixed(8)` | `toDbString(x, 8)` |

---

### RULE 4: NO SWITCH/IF-ELSE-IF CHAINS

```typescript
// FORBIDDEN
switch (status) {
  case 'pending': return handlePending();
  case 'done': return handleDone();
}

// FORBIDDEN
if (status === 'pending') { } else if (status === 'done') { }

// REQUIRED - Object/Map lookup
const HANDLERS: Record<Status, Handler> = {
  pending: handlePending,
  done: handleDone,
};
const handler = HANDLERS[status];
```

---

### RULE 5: NO CROSS-MODULE MAIN IMPORTS

```typescript
// FORBIDDEN - From within libs/
import { PaymentService } from '@app/feature-payment-main'; // CIRCULAR!

// ALLOWED - Only from apps/
// apps/api/src/controller.ts
import { PaymentService } from '@app/feature-payment-main'; // OK
```

**Import rules**:
- `libs/` can import: `@app/common-*`, `@app/database`, `@app/feature-*-shared`
- `apps/` can import: Everything including `@app/feature-*-main`

---

### RULE 6: NO HARDCODED USER-FACING STRINGS

```typescript
// FORBIDDEN - Hardcoded text
await ctx.reply('Welcome to the bot!');
await ctx.reply('Your balance: ' + balance);

// REQUIRED - Use localization
await ctx.reply(ctx.t('bot.welcome'));
await ctx.reply(ctx.t('balance.current', { amount: balance }));
```

**Locale files location**: `libs/common/intl/locales/{en,ru}/*.json`

**Before adding new text**:
1. Add key to `en/*.json`
2. Add key to `ru/*.json`
3. Use `ctx.t('key')` or i18n service

---

### RULE 7: NO DUPLICATE FUNCTIONS

**BEFORE creating ANY new function**:

1. Search codebase: `grep -r "functionName" libs/`
2. Check `@app/common-shared` for existing utilities
3. If similar logic exists, REUSE or EXTEND it

```typescript
// FORBIDDEN - Duplicating existing logic
function formatBalance(amount: string): string {
  return new Decimal(amount).toFixed(2);
}

// REQUIRED - Use existing utility
import { toDisplayString } from '@app/common-shared/util';
const formatted = toDisplayString(amount, 2);
```

---

## PROJECT STRUCTURE

```
/
├── apps/
│   ├── api/              # REST API (imports from libs/*/main)
│   ├── bot/              # Telegram bot (imports from libs/*/main)
│   └── migration/        # Database migrations
└── libs/
    ├── common/           # Cross-domain utilities
    │   ├── exception/    # Exception handling
    │   ├── health/       # Health checks
    │   ├── intl/         # i18n & locales
    │   ├── logger/       # Logging (use instead of console.log)
    │   ├── nats/         # NATS messaging
    │   ├── redis/        # Redis caching
    │   ├── response/     # Response formatting
    │   ├── shared/       # Utilities (Decimal, Result, etc.)
    │   └── validation/   # Validation pipes
    ├── database/         # Entities & repositories
    └── feature/          # Domain modules
        ├── auth/
        ├── balance/
        ├── bot/
        ├── currency/
        ├── notification/
        ├── order/
        ├── payment/
        ├── statistic/
        ├── traffic/
        └── user/
            ├── main/     # Business logic (apps only)
            └── shared/   # DTOs, types (libs can import)
```

---

## ESLINT RULES - ENFORCED

### Naming Conventions

| Element | Format | Example |
|---------|--------|---------|
| Variables | camelCase | `userName`, `orderCount` |
| Functions | camelCase | `getUserById`, `processOrder` |
| Classes | PascalCase | `UserEntity`, `PaymentService` |
| Interfaces | PascalCase | `CreateUserDto`, `OrderStatus` |
| Enum Keys | StrictPascalCase | `Pending`, `Completed` |
| Enum Values | snake_case or UPPER | `"pending"`, `"USD"` |

### Enum Values

```typescript
// CORRECT - snake_case
enum OrderStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
}

// CORRECT - Short uppercase (2-5 chars)
enum Currency {
  Usd = 'USD',
  Btc = 'BTC',
}

// WRONG - Will fail lint
enum Status {
  Pending = 'Pending', // Must be 'pending'
}
```

### Required Formatting

```typescript
// REQUIRED - Blank lines between class members
class UserService {
  private readonly logger: Logger;

  constructor(private userRepo: UserRepository) {}

  async findById(id: string): Promise<User> {
    return this.userRepo.findOne({ id });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    // implementation
  }
}
```

### Key Rules

- `no-console` - Use `@app/common-logger` instead
- `eqeqeq` - Always `===` and `!==`
- `curly` - Always use braces `{ }`
- `no-await-in-loop` - Use `Promise.all()` instead
- `no-param-reassign` - Don't modify parameters
- `@typescript-eslint/no-non-null-assertion` - No `!` assertions
- `@typescript-eslint/explicit-member-accessibility` - No `public` keyword

---

## TYPE SAFETY

### TypeScript Strict Mode

All these flags are enabled - code MUST comply:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictPropertyInitialization": true
}
```

### Type Guards Pattern

```typescript
// Define type guard
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data
  );
}

// Use type guard
function processUser(data: unknown) {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  // data is now typed as User
  console.log(data.email);
}
```

---

## DECIMAL ARITHMETIC

### Why Required

```javascript
0.1 + 0.2 === 0.3  // false! Returns 0.30000000000000004
```

### Required Functions

```typescript
import {
  decimal,        // Create Decimal instance
  add,            // Addition
  subtract,       // Subtraction
  multiply,       // Multiplication
  divide,         // Division
  sum,            // Sum array
  percentage,     // Calculate percentage
  toDbString,     // Format for DB storage
  toDisplayString,// Format for display
  toNumber,       // Convert to number (display only!)
} from '@app/common-shared/util';
```

### Usage

```typescript
// Calculate total
const total = add(price, tax);
const discount = multiply(total, '0.1');
const final = subtract(total, discount);

// Save to database
user.balance = toDbString(add(balance, amount), 8);

// Display to user (ONLY at final output)
return { balance: toNumber(final) };
```

---

## CODE PATTERNS

### Error Handling

```typescript
import { Result, Ok, Err } from '@app/common-shared';

async function createPayment(dto: CreatePaymentDto): Promise<Result<Payment, Error>> {
  try {
    const payment = await this.repo.create(dto);
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

### Parallel Operations

```typescript
// CORRECT - Parallel
const [user, balance, orders] = await Promise.all([
  this.userRepo.findById(userId),
  this.balanceRepo.findByUser(userId),
  this.orderRepo.findByUser(userId),
]);

// WRONG - Sequential (slow)
const user = await this.userRepo.findById(userId);
const balance = await this.balanceRepo.findByUser(userId);
```

### Validation

```typescript
import { IsString, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';

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

## FILE ORGANIZATION

### Rules

1. **Maximum 500 lines per file** - Split if larger
2. **No files in root folder** - Use appropriate directories
3. **File naming**:
   - `*.service.ts` - Services
   - `*.controller.ts` - Controllers
   - `*.repository.ts` - Repositories
   - `*.entity.ts` - Entities
   - `*.dto.ts` - DTOs
   - `*.interface.ts` - Interfaces
   - `*.constants.ts` - Constants

---

## BUILD & COMMANDS

### Package Manager

**Use `pnpm` only** - Not npm or yarn.

### Required Commands After Changes

```bash
pnpm run build    # Build project
pnpm run test     # Run tests
pnpm run lint     # Check linting (MUST PASS)
pnpm run lint:fix # Auto-fix lint issues
```

### Development

```bash
pnpm run dev          # Start all services
pnpm run dev:api      # Start API only
pnpm run dev:bot      # Start bot only
```

### Database

```bash
pnpm run migration:run    # Run migrations
pnpm run migration:status # Check status
pnpm run migration:revert # Rollback last
```

---

## ENVIRONMENT VARIABLES

```typescript
// FORBIDDEN - Hardcoded secrets
const apiKey = 'sk-xxx-hardcoded';

// REQUIRED - Use ConfigService
import { ConfigService } from '@nestjs/config';

constructor(private config: ConfigService) {}

const apiKey = this.config.get<string>('CRYPTO_BOT_API_KEY');
```

---

## DATABASE

```typescript
// Monetary values - ALWAYS decimal(20,8)
@Property({ type: 'decimal(20,8)' })
balance: string;

// Indexes for queried fields
@Index()
@Property()
userId: string;

// Transactions for multi-step operations
await this.em.transactional(async (em) => {
  const user = await em.findOne(UserEntity, { id: userId });
  user.balance = newBalance;
  await em.flush();
});
```

---

## QUICK REFERENCE

### MUST DO - REQUIRED

- **MUST** use TypeScript strict mode
- **MUST** use Decimal.js for money (`add`, `subtract`, `multiply`, `divide`)
- **MUST** use type guards instead of `as` assertions
- **MUST** use Maps/objects instead of switch/if-else
- **MUST** use Result type for fallible operations
- **MUST** use module separation (main vs shared)
- **MUST** use ConfigService for environment variables
- **MUST** use localization for all user-facing text
- **MUST** use `Promise.all()` for parallel operations
- **MUST** search for existing functions before creating new ones
- **MUST** keep files under 500 lines
- **MUST** run `pnpm run lint` before committing

### NEVER DO - FORBIDDEN

- **NEVER** use `any` type - use `unknown` with type guards
- **NEVER** use `as` type assertions - only `as const` allowed
- **NEVER** use `+`, `-`, `*`, `/` for money - use Decimal.js
- **NEVER** use `switch` or `if-else-if` - use Map/object lookup
- **NEVER** use `parseFloat` for financial data - use `decimal()`
- **NEVER** import `@app/feature-*-main` from `libs/` - circular dependency
- **NEVER** hardcode secrets or user-facing strings - use config/locales
- **NEVER** use `console.log` - use `@app/common-logger`
- **NEVER** create duplicate functions - search and reuse existing
- **NEVER** skip error handling - use Result type or try/catch
- **NEVER** commit commented-out code - delete unused code
- **NEVER** use magic numbers - define named constants

---

## RESOURCES

- **Locale Files**: `libs/common/intl/locales/`
- **Shared Utilities**: `libs/common/shared/src/`
- **Database Entities**: `libs/database/src/`

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# Nx Guidelines

- Run tasks through `nx` (e.g., `nx run`, `nx run-many`, `nx affected`)
- Use `nx_workspace` tool to understand workspace architecture
- Use `nx_project_details` for specific project structure
- Use `nx_docs` for configuration questions

<!-- nx configuration end-->
