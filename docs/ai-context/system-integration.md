# System Integration Documentation

This document describes cross-component integration patterns and system-wide architectural decisions for Motiv-Buy.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Component Integration Map](#component-integration-map)
- [Core Integration Flows](#core-integration-flows)
- [Data Flow Patterns](#data-flow-patterns)
- [Service Dependencies](#service-dependencies)
- [Error Handling Across Boundaries](#error-handling-across-boundaries)
- [Testing Integration Points](#testing-integration-points)

---

## Architecture Overview

Motiv-Buy follows a **modular monorepo architecture** with clear separation between:

- **Apps** (`apps/`): Entry points that compose features
- **Features** (`libs/feature/`): Domain-specific business logic
- **Common** (`libs/common/`): Cross-cutting concerns

### Module Structure

```
libs/feature/{module}/
├── main/     # Business logic (import ONLY in apps/)
└── shared/   # DTOs, types, interfaces (import anywhere)
```

**Critical Rule**: Never import `*-main` modules from other `libs/` - only from `apps/`.

---

## Component Integration Map

### High-Level Component Graph

```
                      ┌─────────────────────┐
                      │     apps/bot        │ (Telegram Bot)
                      └──────────┬──────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐       ┌───────▼───────┐      ┌───────▼───────┐
   │   Balance   │       │    Traffic    │      │   Payment     │
   │   Module    │       │    Module     │      │    Module     │
   └──────┬──────┘       └───────┬───────┘      └───────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │      Database       │
                      │     (MikroORM)      │
                      └─────────────────────┘
```

### Cross-Feature Dependencies

| Feature | Depends On | Purpose |
|---------|------------|---------|
| `traffic` | `balance`, `user` | Order creation locks funds |
| `payment` | `balance`, `user` | Deposits/withdrawals update balance |
| `bot` | All features | User interface orchestration |
| `statistic` | `traffic`, `payment`, `user` | Analytics aggregation |

---

## Core Integration Flows

### 1. Order Creation Flow

User creates a traffic order through the Telegram bot:

```
┌─────────────────┐
│ User sends cmd  │
└────────┬────────┘
         │
┌────────▼────────┐
│ OrderAction     │  (bot handler)
│ Handler         │
└────────┬────────┘
         │
┌────────▼────────────────────────────────────┐
│ UserBalanceOperationService.lockBalanceWithEm()  │
│ - Finds user balance in any currency            │
│ - Converts USD amount to currency amount        │
│ - Moves funds: balance → lockedBalance          │
└────────┬────────────────────────────────────┘
         │
┌────────▼────────┐
│ TrafficOrder    │  (creates order entity)
│ Mapper.create() │
└────────┬────────┘
         │
┌────────▼────────────────────────────────────┐
│ Junction Tables Created:                       │
│ - TrafficOrderSourceEntity (source allocation) │
│ - TrafficOrderTargetEntity (target assignment) │
└────────┬────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────┐
│ TrafficOrderBalanceEntity                      │
│ - Links order to locked currency/amount        │
│ - Tracks spending & refunds                    │
└─────────────────────────────────────────────┘
```

**Key Files**:
- `libs/feature/balance/shared/src/service/user-balance-operation.service.ts`
- `libs/feature/traffic/main/src/mapper/traffic-order.mapper.ts`

### 2. Payment Processing Flow

User initiates a deposit or withdrawal:

```
┌─────────────────┐
│ User requests   │
│ withdrawal      │
└────────┬────────┘
         │
┌────────▼────────┐
│ PaymentService  │
│ .transfer()     │
└────────┬────────┘
         │
┌────────▼────────────────────────────────────────┐
│ TRANSACTION START (Pessimistic Lock)              │
│                                                   │
│ 1. em.findOne(UserBalanceEntity, {lockMode:       │
│    PESSIMISTIC_WRITE})                            │
│                                                   │
│ 2. Verify: balance >= withdrawal amount           │
│                                                   │
│ 3. Deduct balance BEFORE provider call            │
└────────┬────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────┐
│ ProviderRoutingService.selectProvider()           │
│ → CryptoBotProvider / YooKassaProvider            │
└────────┬────────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
 SUCCESS   FAILURE
    │         │
    │    ┌────▼────────────────────────────────┐
    │    │ ROLLBACK: Restore deducted balance    │
    │    │ (Automatic via transaction rollback)  │
    │    └───────────────────────────────────────┘
    │
┌───▼────────────────────────────────────────────┐
│ Create PaymentTransactionEntity                  │
│ TRANSACTION COMMIT                               │
└──────────────────────────────────────────────────┘
```

**Key Files**:
- `libs/feature/payment/shared/src/service/payment.service.ts`
- `libs/feature/payment/shared/src/service/provider-routing.service.ts`
- `libs/feature/payment/shared/src/provider/crypto-bot.provider.ts`

### 3. Moderation Callback Flow

Admin approves/declines traffic sources or orders:

```
┌───────────────────┐
│ Admin clicks      │
│ inline button     │
│ (mod:a:src:123)   │
└─────────┬─────────┘
          │
┌─────────▼─────────┐
│ ModerationCallback│  (parses shortened callback)
│ Handler           │
└─────────┬─────────┘
          │
┌─────────▼────────────────────────────────────┐
│ Lookup via Record<string, Handler>:           │
│   entityTypeMap: { src → TrafficSource, ... } │
│   actionMap: { a → approve, d → decline }     │
└─────────┬────────────────────────────────────┘
          │
┌─────────▼─────────┐
│ ModerationService │  (approve/decline logic)
└─────────┬─────────┘
          │
┌─────────▼───────────────────────────────────┐
│ TelegramModerationNotifier                   │
│ - Updates inline keyboard                    │
│ - Notifies source/order owner                │
└──────────────────────────────────────────────┘
```

**Key Files**:
- `apps/bot/src/handler/moderation-callback.handler.ts`
- `libs/feature/traffic/main/src/service/moderation.service.ts`
- `libs/feature/bot/shared/src/service/telegram-moderation.notifier.ts`

---

## Data Flow Patterns

### Multi-Currency Balance System

Users can hold balances in multiple currencies. All operations are normalized to USD:

```
User Balance Query:
┌─────────────────┐
│   User (ID)     │
└────────┬────────┘
         │
    ┌────▼─────────────────────────────┐
    │ UserBalanceEntity (per currency) │
    │ - balance: decimal(20,8)         │
    │ - lockedBalance: decimal(20,8)   │
    │ - currency: FK→CurrencyEntity    │
    └────┬──────────────────────────────┘
         │
    ┌────▼──────────────────┐
    │ CurrencyEntity        │
    │ - code (USD, USDT)    │
    │ - rateToUsd (1.0)     │
    └───────────────────────┘

Balance Summary Calculation:
  totalUsd = Σ(balance × rateToUsd) for all currencies
```

**Key Service**: `UserBalanceOperationService.getBalanceSummary()`

### Traffic Order Category Matching

Orders are matched to sources based on category requirements:

```
┌──────────────────────────┐
│ TrafficOrderEntity       │
│ - requirements: {        │
│     categories: ['crypto']│
│     minRating: 4.0       │
│   }                      │
└─────────────┬────────────┘
              │
    ┌─────────▼─────────────────────────────────────┐
    │ Matching Algorithm (TrafficOrderMapper):       │
    │ 1. Filter sources by type compatibility        │
    │ 2. Filter by category intersection             │
    │ 3. Allocate counts proportionally              │
    └─────────┬─────────────────────────────────────┘
              │
    ┌─────────▼──────────────────────────────────┐
    │ TrafficOrderSourceEntity (junction)        │
    │ - allocatedCount                            │
    │ - allocatedBudget                           │
    │ - pricePerAction                            │
    └─────────────────────────────────────────────┘
```

---

## Service Dependencies

### Balance Module Integration

```typescript
// Any service that needs balance operations:
import { UserBalanceOperationService } from '@app/feature-balance-shared';

@Injectable()
export class OrderService {
  constructor(
    private readonly balanceOps: UserBalanceOperationService,
  ) {}

  async createOrder(userId: string, usdAmount: string) {
    // Lock funds before creating order
    const locked = await this.balanceOps.lockBalance(userId, CurrencyCode.Usd, usdAmount);
    if (!locked) {
      throw new Error('Insufficient balance');
    }
    // ... create order
  }
}
```

### Payment Module Integration

```typescript
// Payment is accessed via shared exports
import { PaymentService, CryptoBotProvider } from '@app/feature-payment-shared';

// For webhook handling:
import { WebhookUpdateDto } from '@app/feature-payment-shared';
```

### Bot Handler Integration

```typescript
// Bot handlers compose services
import { MessageService } from '@app/feature-bot-main';
import { UserBalanceOperationService } from '@app/feature-balance-shared';

@Injectable()
export class BalanceActionHandler {
  constructor(
    private readonly balanceOps: UserBalanceOperationService,
    private readonly messageService: MessageService,
  ) {}

  async handleBalance(ctx: BotContext) {
    const summary = await this.balanceOps.getBalanceSummary(ctx.user.id, CurrencyCode.Usd);
    await this.messageService.sendMessage(ctx, ctx.t('balance.display', summary));
  }
}
```

---

## Error Handling Across Boundaries

### Result Type Pattern

Cross-service calls use the `Result` type for explicit error handling:

```typescript
import { Result, Ok, Err, toError } from '@app/common-shared';

async function createPayment(dto: CreatePaymentDto): Promise<Result<Payment, Error>> {
  try {
    const payment = await this.paymentRepo.create(dto);
    return Ok(payment);
  } catch (error) {
    return Err(toError(error));
  }
}

// Caller handles result
const result = await createPayment(dto);
if (result.err) {
  this.logger.error('Payment failed', { error: result.val.message });
  return;
}
const payment = result.val;
```

### Transaction Rollback Pattern

Financial operations use database transactions with automatic rollback:

```typescript
async function withdrawFunds(userId: string, amount: string) {
  const em = this.orm.em.fork();

  await em.transactional(async (em) => {
    // Lock row to prevent concurrent modifications
    const balance = await em.findOne(UserBalanceEntity,
      { user: userId },
      { lockMode: LockMode.PESSIMISTIC_WRITE }
    );

    // Deduct balance
    balance.balance = subtract(balance.balance, amount);

    // Call external provider (may throw)
    await this.provider.transfer(amount);

    // If provider throws, transaction rolls back automatically
  });
}
```

---

## Testing Integration Points

### Critical Race Condition Tests

The payment system includes comprehensive race condition tests:

```typescript
// libs/feature/payment/main/src/service/__tests__/payment-race-conditions.spec.ts

describe('PaymentService - Race Condition Tests', () => {
  it('should prevent double-withdrawal via pessimistic locking', async () => {
    // Simulates concurrent withdrawal attempts
  });

  it('should rollback balance on provider failure', async () => {
    // Verifies automatic rollback when provider rejects
  });

  it('should prevent double-crediting on duplicate webhooks', async () => {
    // Tests idempotency of webhook processing
  });
});
```

### Integration Test Setup

For testing cross-module integration:

```typescript
// Setup with all required mocks
const module = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    {
      provide: MikroORM,
      useValue: mockOrm,
    },
    {
      provide: UserBalanceOperationService,
      useValue: mockBalanceOps,
    },
    // ... other dependencies
  ],
}).compile();
```

---

## Quick Reference

### Import Paths

| What | Import From |
|------|-------------|
| Balance operations | `@app/feature-balance-shared` |
| Payment services | `@app/feature-payment-shared` |
| Traffic types | `@app/feature-traffic-shared` |
| Entities & repositories | `@app/database` |
| Result type, decimals | `@app/common-shared` |
| i18n | `@app/common-intl` |
| Logger | `@app/common-logger` |

### Key Services

| Service | Purpose | Module |
|---------|---------|--------|
| `UserBalanceOperationService` | Lock/unlock/query balance | `balance-shared` |
| `PaymentService` | Process deposits/withdrawals | `payment-shared` |
| `TrafficOrderMapper` | Create/manage orders | `traffic-main` |
| `ModerationService` | Approve/decline entities | `traffic-main` |
| `MessageService` | Send bot messages | `bot-main` |

### Database Patterns

| Pattern | Usage |
|---------|-------|
| Pessimistic locking | `LockMode.PESSIMISTIC_WRITE` for financial ops |
| Decimal precision | `decimal(20,8)` for all monetary values |
| Junction tables | `TrafficOrderSourceEntity`, `TrafficOrderTargetEntity` |
| Soft references | Foreign keys with cascade rules |

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Code standards and development guidelines
- [project-structure.md](./project-structure.md) - Full project structure
- [DEPLOY.md](../DEPLOY.md) - Deployment guide
- [payment-webhook-implementation.md](../payment-webhook-implementation.md) - Webhook details
