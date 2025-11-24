# Development Guidelines & Code Standards

## TL;DR - CRITICAL RULES

> **AI AGENT INSTRUCTION**: These 7 rules are NON-NEGOTIABLE. Violations will fail the build.

| # | Rule | Instead Use |
|---|------|-------------|
| 1 | **NEVER** `any` type | `unknown` + type guards |
| 2 | **NEVER** `as` assertions | Type guards (except `as const`) |
| 3 | **NEVER** `+`,`-`,`*`,`/` for money | `add()`, `subtract()`, `multiply()`, `divide()` |
| 4 | **NEVER** `switch`/`if-else-if` | `Record<K,V>` object lookup |
| 5 | **NEVER** import `*-main` in libs | Only `*-shared` in libs |
| 6 | **NEVER** hardcode strings | `ctx.t('key')` from locales |
| 7 | **NEVER** duplicate functions | Search first, reuse existing |

---

## BEFORE YOU CODE - MANDATORY CHECKLIST

```
[ ] SEARCHED for existing similar functions in codebase
[ ] CHECKED locale files exist for any user-facing text
[ ] VERIFIED imports don't use @app/feature-*-main from libs/
[ ] CONFIRMED using Decimal.js for any money calculations
```

---

## CRITICAL RULES - VIOLATIONS FAIL BUILD

### RULE 1: NO `any` TYPE

```typescript
// FORBIDDEN
function process(data: any) { }

// REQUIRED
function process(data: unknown) {
  if (isValidData(data)) { /* safe */ }
}
```

---

### RULE 2: NO `as` TYPE ASSERTIONS

```typescript
// FORBIDDEN
const user = data as User;

// REQUIRED
if (isUser(data)) {
  const user = data; // Type-safe
}
```

**Exception**: `as const` is allowed.

---

### RULE 3: NO NATIVE ARITHMETIC FOR MONEY

```typescript
// FORBIDDEN
const total = price + tax;

// REQUIRED
import { add, subtract, multiply, divide } from '@app/common-shared/util';
const total = add(price, tax);
```

| Native | Decimal.js |
|--------|------------|
| `a + b` | `add(a, b)` |
| `a - b` | `subtract(a, b)` |
| `a * b` | `multiply(a, b)` |
| `a / b` | `divide(a, b)` |
| `parseFloat(x)` | `decimal(x)` |
| `.toFixed(8)` | `toDbString(x, 8)` |
| `.toFixed(2)` | `toDisplayString(x, 2)` |

---

### RULE 4: NO SWITCH/IF-ELSE-IF

```typescript
// FORBIDDEN
switch (status) {
  case 'pending': return handlePending();
  case 'done': return handleDone();
}

// FORBIDDEN
if (status === 'pending') { } else if (status === 'done') { }

// REQUIRED
const HANDLERS: Record<Status, Handler> = {
  pending: handlePending,
  done: handleDone,
};
const handler = HANDLERS[status];
```

---

### RULE 5: NO CROSS-MODULE MAIN IMPORTS

```typescript
// FORBIDDEN - From libs/
import { PaymentService } from '@app/feature-payment-main'; // CIRCULAR!

// ALLOWED - From apps/
import { PaymentService } from '@app/feature-payment-main'; // OK
```

| Location | Can Import |
|----------|------------|
| `libs/` | `@app/common-*`, `@app/database`, `@app/feature-*-shared` |
| `apps/` | Everything including `@app/feature-*-main` |

---

### RULE 6: NO HARDCODED STRINGS

```typescript
// FORBIDDEN
await ctx.reply('Welcome to the bot!');

// REQUIRED
await ctx.reply(ctx.t('bot.welcome'));
await ctx.reply(ctx.t('balance.current', { amount }));
```

**Locale path**: `libs/common/intl/locales/{en,ru}/*.json`

**Steps**: 1) Add to `en/*.json` 2) Add to `ru/*.json` 3) Use `ctx.t('key')`

---

### RULE 7: NO DUPLICATE FUNCTIONS

**BEFORE creating ANY function**:

1. `grep -r "functionName" libs/`
2. Check `@app/common-shared` utilities
3. If exists → REUSE, don't duplicate

```typescript
// FORBIDDEN
function formatBalance(amount: string): string {
  return new Decimal(amount).toFixed(2);
}

// REQUIRED
import { toDisplayString } from '@app/common-shared/util';
const formatted = toDisplayString(amount, 2);
```

---

## PROJECT STRUCTURE

```
/
├── apps/
│   ├── api/              # REST API → can import libs/*/main
│   ├── bot/              # Telegram bot → can import libs/*/main
│   └── migration/        # DB migrations
└── libs/
    ├── common/
    │   ├── intl/         # i18n & locales ← ALL user strings here
    │   ├── logger/       # Logger ← use instead of console.log
    │   ├── shared/       # Decimal utils, Result type
    │   └── ...
    ├── database/         # Entities & repositories
    └── feature/
        └── {module}/
            ├── main/     # Business logic (apps ONLY)
            └── shared/   # DTOs, types (libs can import)
```

---

## ESLINT - ENFORCED RULES

### Naming

| Element | Format | Example |
|---------|--------|---------|
| Variables/Functions | camelCase | `userName`, `getUser` |
| Classes/Interfaces | PascalCase | `UserEntity`, `CreateUserDto` |
| Enum Keys | StrictPascalCase | `Pending`, `Completed` |
| Enum Values | snake_case or UPPER | `"pending"`, `"USD"` |

### Enum Values

```typescript
// CORRECT
enum OrderStatus {
  Pending = 'pending',        // snake_case
  InProgress = 'in_progress',
}

enum Currency {
  Usd = 'USD',  // UPPER (2-5 chars)
  Btc = 'BTC',
}

// WRONG - Will fail lint
enum Status {
  Pending = 'Pending',  // Must be 'pending'
}
```

### Key Rules

| Rule | Meaning |
|------|---------|
| `no-console` | Use `@app/common-logger` |
| `eqeqeq` | Always `===` and `!==` |
| `curly` | Always use `{ }` braces |
| `no-await-in-loop` | Use `Promise.all()` |
| `no-param-reassign` | Don't modify params |
| `no-non-null-assertion` | No `!` operator |
| `explicit-member-accessibility` | No `public` keyword |

### Class Format

```typescript
class UserService {
  private readonly logger: Logger;
  // ↑ blank line ↓
  constructor(private userRepo: UserRepository) {}
  // ↑ blank line ↓
  async findById(id: string): Promise<User> {
    return this.userRepo.findOne({ id });
  }
}
```

---

## TYPE SAFETY

### Type Guard Pattern

```typescript
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data
  );
}

function processUser(data: unknown) {
  if (!isUser(data)) {
    throw new Error('Invalid user data');
  }
  // data is now User type
  return data.email;
}
```

---

## DECIMAL ARITHMETIC

```typescript
import {
  decimal,         // Create instance
  add,             // a + b
  subtract,        // a - b
  multiply,        // a * b
  divide,          // a / b
  sum,             // Array sum
  toDbString,      // DB storage
  toDisplayString, // UI display
  toNumber,        // Final output only
} from '@app/common-shared/util';

// Usage
const total = add(price, tax);
const discount = multiply(total, '0.1');
user.balance = toDbString(add(balance, amount), 8);

// toNumber ONLY for final API response
return { balance: toNumber(total) };
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

const result = await createPayment(dto);
if (result.err) {
  throw result.val;
}
const payment = result.val;
```

### Parallel Operations

```typescript
// CORRECT - Parallel
const [user, balance] = await Promise.all([
  this.userRepo.findById(userId),
  this.balanceRepo.findByUser(userId),
]);

// WRONG - Sequential
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

## FILE RULES

- **MUST** keep files under 500 lines
- **MUST** use proper naming: `*.service.ts`, `*.controller.ts`, `*.entity.ts`, `*.dto.ts`
- **NEVER** save files to root folder

---

## COMMANDS

```bash
# Package manager - pnpm ONLY
pnpm install

# After changes - ALL must pass
pnpm run build
pnpm run test
pnpm run lint

# Development
pnpm run dev:api
pnpm run dev:bot

# Database
pnpm run migration:run
pnpm run migration:status
```

---

## DATABASE

```typescript
// Monetary - ALWAYS decimal(20,8)
@Property({ type: 'decimal(20,8)' })
balance: string;

// Indexes for queries
@Index()
@Property()
userId: string;

// Transactions
await this.em.transactional(async (em) => {
  const user = await em.findOne(UserEntity, { id });
  user.balance = newBalance;
  await em.flush();
});
```

---

## ENVIRONMENT

```typescript
// FORBIDDEN
const apiKey = 'hardcoded-secret';

// REQUIRED
import { ConfigService } from '@nestjs/config';
const apiKey = this.config.get<string>('API_KEY');
```

---

## BEFORE COMMIT CHECKLIST

```
[ ] No `any` types in code
[ ] No `as` assertions (except `as const`)
[ ] All money uses Decimal.js functions
[ ] No switch/if-else-if chains
[ ] No @app/feature-*-main imports from libs/
[ ] All user strings in locale files
[ ] No duplicate functions created
[ ] pnpm run lint passes
[ ] pnpm run build passes
[ ] pnpm run test passes
```

---

## QUICK REFERENCE

### MUST - REQUIRED

- **MUST** use `unknown` + type guards for dynamic data
- **MUST** use `add()`, `subtract()`, `multiply()`, `divide()` for money
- **MUST** use `Record<K,V>` instead of switch/if-else
- **MUST** use `ctx.t('key')` for user-facing text
- **MUST** use `@app/common-logger` instead of console.log
- **MUST** use `ConfigService` for environment variables
- **MUST** use `Promise.all()` for parallel async operations
- **MUST** search codebase before creating new functions
- **MUST** run `pnpm run lint` before committing

### NEVER - FORBIDDEN

- **NEVER** use `any` type → use `unknown` with type guards
- **NEVER** use `as` assertions → use type guards
- **NEVER** use `+`,`-`,`*`,`/` for money → use Decimal.js
- **NEVER** use `switch`/`if-else-if` → use object lookup
- **NEVER** use `parseFloat` for money → use `decimal()`
- **NEVER** import `@app/feature-*-main` from libs/ → circular dependency
- **NEVER** hardcode strings → use locale files
- **NEVER** use `console.log` → use logger service
- **NEVER** duplicate functions → search and reuse
- **NEVER** skip error handling → use Result type
- **NEVER** commit commented code → delete it
- **NEVER** use magic numbers → define constants

---

## RESOURCES

| Resource | Path |
|----------|------|
| Locale Files | `libs/common/intl/locales/` |
| Shared Utils | `libs/common/shared/src/` |
| Entities | `libs/database/src/` |
| Logger | `@app/common-logger` |

---

<!-- nx configuration start-->
# Nx

- Run tasks via `nx run`, `nx run-many`, `nx affected`
- Use `nx_workspace` for architecture overview
- Use `nx_project_details` for project structure
<!-- nx configuration end-->
