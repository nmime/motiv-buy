# Traffic Provider API Integration Plan

## Overview

**Goal:** Build a public API that lets external traffic providers (SubGram, FlyerService, etc.) deliver traffic for our orders.

**Current Status:** 60% complete - we can create orders but can't execute them.

**What's Missing:** The actual traffic delivery system and provider integration layer.

---

## What We Have ✅

### Data Layer
- **Entities:** `TrafficOrderEntity`, `TrafficSourceEntity`, `TrafficTargetEntity`, `TrafficUserEntity`, `TrafficActionsEntity`
- **Repositories:** Full CRUD operations for all entities
- **Enums:** Order status, action types, source types, target types

### API Layer (Internal - for our clients)
- **Controllers:** 4 controllers, 18 REST endpoints
- **Endpoints:**
  - `/traffic/orders` - Order management (create, list, update, cancel)
  - `/traffic/sources/bots` - Bot registration and management
  - `/traffic/targets` - Target management
  - `/traffic/bot-token/validate` - Bot token validation

### Services
- `TrafficService` (920 lines) - Core business logic
- `BotTokenValidationService` (545 lines) - Token validation with Redis caching
- Authentication with JWT and bot tokens

### Telegram Bot
- Order creation flow (A1-A6)
- Bot menu system
- Session management

---

## What's Missing ❌

### Critical Gaps

1. **No Traffic Execution**
   - Orders created but never fulfilled
   - `TrafficActionsEntity` exists but unused
   - No progress tracking (`currentCount` never updates)

2. **No Provider API**
   - External providers can't fetch available orders
   - No endpoint to submit completed actions
   - No way for providers to register

3. **No Webhooks**
   - No real-time notifications
   - No webhook registration
   - No event delivery system

4. **Balance Not Connected**
   - Creating orders doesn't deduct balance
   - No payment processing
   - No refunds on cancellation

5. **Access Control Missing**
   - No ownership verification
   - Anyone can access any order/source
   - Security vulnerability

---

## SubGram API Insights

### What They Do Well

**Publisher Side (Traffic Sellers):**
- `POST /get-sponsors` - Get ads to show users (critical!)
- `POST /bots` - Register bots for selling traffic
- `POST /get-user-subscriptions` - Check subscription status

**Advertiser Side (Traffic Buyers):**
- `POST /orders` - Create/manage campaigns

**General:**
- `GET /filters` - Available targeting options
- `POST /get-balance` - Earnings and balance
- Webhooks for real-time updates

### Their Auth Model
- **Secret Key** - Full access (create orders, manage bots)
- **API Token** - Read-only (stats, balance)
- **Bot Key** - Per-bot operations

### Key Lesson
They separate **order creation** (advertiser) from **order fulfillment** (publisher). We have the first, need the second.

---

## Our Solution: Provider API

### Architecture

```
External Providers → Provider API → Traffic Execution Engine → Our Orders
                         ↓
                    Webhooks (notifications)
```

### Module Structure

Create new module: `libs/feature/traffic-provider/`

```
libs/feature/traffic-provider/
├── main/
│   ├── controller/
│   │   ├── provider-order.controller.ts
│   │   ├── provider-webhook.controller.ts
│   │   └── provider-analytics.controller.ts
│   ├── service/
│   │   ├── provider.service.ts
│   │   ├── order-matching.service.ts
│   │   ├── action-validator.service.ts
│   │   └── webhook.service.ts
│   └── guard/
│       └── provider-api-key.guard.ts
└── shared/
    ├── dto/
    │   ├── provider-order.dto.ts
    │   ├── provider-action.dto.ts
    │   └── provider-webhook.dto.ts
    └── exception/
```

---

## API Design (Our Conventions)

**Base Path:** `/api/v1/provider`

### Core Endpoints

#### 1. Get Available Orders
```typescript
GET /api/v1/provider/orders/available
Authorization: Bearer <PROVIDER_API_KEY>

Response:
{
  orders: [
    {
      orderId: string;
      type: 'channel_subscribers' | 'post_views' | 'group_members';
      target: {
        telegramId: string;
        username: string;
        type: 'channel' | 'group' | 'bot';
      };
      requirements: {
        totalCount: number;
        currentCount: number;
        remainingCount: number;
        dailyLimit: number;
        targeting: {
          gender?: 'male' | 'female';
          ageMin?: number;
          ageMax?: number;
          countries?: string[];
          languages?: string[];
        };
      };
      pricing: {
        pricePerAction: string; // Decimal
        totalBudget: string;
        spentAmount: string;
      };
      status: 'active' | 'paused';
    }
  ];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

#### 2. Submit Completed Actions
```typescript
POST /api/v1/provider/orders/:orderId/actions
Authorization: Bearer <PROVIDER_API_KEY>

Request:
{
  actions: [
    {
      userId: number; // Telegram user ID
      username?: string;
      actionType: 'subscribe' | 'view' | 'join';
      completedAt: string; // ISO timestamp
      proof?: {
        screenshotUrl?: string;
      };
    }
  ];
}

Response:
{
  accepted: number;
  rejected: number;
  actions: [
    {
      actionId: string;
      userId: number;
      status: 'accepted' | 'rejected';
      reason?: string;
      reward: string; // Decimal
    }
  ];
  orderProgress: {
    currentCount: number;
    remainingCount: number;
    completionPercentage: number;
  };
}
```

#### 3. Register Webhook
```typescript
POST /api/v1/provider/webhooks
Authorization: Bearer <PROVIDER_API_KEY>

Request:
{
  url: string;
  events: ['order.created', 'order.updated', 'order.completed', 'order.cancelled'];
  secret: string; // For HMAC signature
}

Response:
{
  webhookId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}
```

#### 4. Get Provider Balance
```typescript
GET /api/v1/provider/balance
Authorization: Bearer <PROVIDER_API_KEY>

Response:
{
  balance: string; // Decimal
  totalEarnings: string;
  pendingEarnings: string;
  completedActions: number;
  activeOrders: number;
}
```

#### 5. Get Targeting Filters (Public)
```typescript
GET /api/v1/provider/filters

Response:
{
  genders: ['male', 'female'];
  ageRanges: [
    { label: '18-24', min: 18, max: 24 },
    { label: '25-34', min: 25, max: 34 }
  ];
  countries: [
    { code: 'US', name: 'United States' }
  ];
  languages: [
    { code: 'en', name: 'English' }
  ];
  trafficTypes: [
    {
      type: 'channel_subscribers';
      displayName: 'Channel Subscribers';
      basePrice: string; // Decimal
    }
  ];
}
```

---

## Webhook Events

### Order Created
```typescript
POST <provider_webhook_url>
X-Signature: sha256=<hmac>

{
  event: 'order.created';
  timestamp: string;
  data: {
    orderId: string;
    type: string;
    target: {...};
    requirements: {...};
    pricing: {...};
  };
}
```

### Action Completed (Reverse - we send to order creator)
```typescript
POST <customer_webhook_url>
X-Signature: sha256=<hmac>

{
  event: 'action.completed';
  timestamp: string;
  data: {
    orderId: string;
    actionId: string;
    userId: number;
    actionType: string;
    status: 'verified';
    completedAt: string;
  };
}
```

---

## Database Changes

### New Entities

#### ProviderApiKeyEntity
```typescript
{
  id: string;
  apiKeyHash: string; // bcrypt hash
  providerId: string;
  providerName: string;
  permissions: string[]; // ['orders:read', 'orders:write', 'actions:submit']
  isActive: boolean;
  createdBy: User;
  createdAt: Date;
  lastUsedAt?: Date;
}
```

#### ProviderWebhookEntity
```typescript
{
  id: string;
  providerId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}
```

#### WebhookDeliveryLogEntity
```typescript
{
  id: string;
  webhook: ProviderWebhookEntity;
  eventType: string;
  payload: object;
  responseStatus?: number;
  responseBody?: string;
  attemptCount: number;
  deliveredAt?: Date;
  failedAt?: Date;
}
```

---

## Implementation Plan

### Phase 0: Core Provider API (2 weeks) 🔴 Critical

**Goal:** Enable basic provider integration

**Tasks:**
1. Create `libs/feature/traffic-provider` module
2. Implement provider API key system
   - Entity, repository, service
   - `ProviderApiKeyGuard` for authentication
3. Build core endpoints:
   - `GET /provider/orders/available`
   - `POST /provider/orders/:id/actions`
   - `POST /provider/webhooks`
   - `GET /provider/filters`
4. Create `OrderMatchingService` - match orders to providers
5. Create `ActionValidatorService` - validate and accept actions
6. Connect to balance service:
   - Deduct balance on order creation
   - Credit provider on action completion
   - Update `order.spentAmount`

**Deliverables:**
- 4 working API endpoints
- API key auth system
- Balance integration
- Action submission working

---

### Phase 1: Webhook System (1 week) 🔴 Critical

**Goal:** Real-time notifications

**Tasks:**
1. Create `WebhookService`
   - Register webhooks
   - HMAC signature generation/validation
   - Delivery with retry logic
2. Use NATS message queue for async delivery
3. Webhook delivery logging
4. Retry mechanism (3 attempts, exponential backoff)

**Deliverables:**
- Webhook registration API
- Event delivery system
- Delivery logs

---

### Phase 2: Order Execution Engine (1.5 weeks) 🔴 Critical

**Goal:** Actual traffic delivery

**Tasks:**
1. Create `OrderExecutionService`
   - Assign orders to providers
   - Track progress
   - Update `currentCount` on action completion
   - Mark orders complete when `currentCount >= totalCount`
2. Action scheduling
3. Provider performance tracking
4. Auto-pause orders when budget exhausted

**Deliverables:**
- End-to-end order fulfillment
- Progress tracking
- Auto-completion

---

### Phase 3: Access Control (1 week) 🟡 High

**Goal:** Security and ownership

**Tasks:**
1. Create ownership guards:
   - `TrafficOrderOwnershipGuard`
   - `TrafficSourceOwnershipGuard`
2. Fix repository methods to filter by user:
   - `findByCreator()` - add userId filter
   - `validateSourceAccess()` - real ownership check
3. API key permissions:
   - `orders:read`, `orders:write`, `actions:submit`, `webhooks:manage`
4. Rate limiting per API key (Redis)

**Deliverables:**
- Ownership enforcement
- Permission system
- Rate limiting

---

### Phase 4: Bot Ownership Verification (1 week) 🟡 High

**Goal:** Real bot token validation

**Tasks:**
1. Integrate with `@app/feature-bot-shared`
2. Update `BotTokenValidationService.validateWithBotShared()`
3. Verify bot ownership via Telegram API
4. Dynamic permission checking

**Deliverables:**
- Real bot validation
- Ownership verification

---

### Phase 5: Analytics & Reporting (1 week) 🟢 Medium

**Goal:** Real statistics

**Tasks:**
1. Create `TrafficAnalyticsService`
2. Implement real calculations:
   - Provider earnings
   - Completion rates
   - Order performance
3. Build analytics endpoints:
   - `GET /provider/balance`
   - `GET /provider/statistics`

**Deliverables:**
- Real analytics
- Provider dashboard data

---

### Phase 6: Provider Adapters (2 weeks) 🟢 Medium

**Goal:** Integrate SubGram/FlyerService

**Tasks:**
1. Create provider adapter interface:
```typescript
interface TrafficProviderAdapter {
  submitOrder(order: TrafficOrderEntity): Promise<Result<string, Error>>;
  cancelOrder(orderId: string): Promise<Result<void, Error>>;
  validateWebhookSignature(payload: unknown, signature: string): boolean;
}
```
2. Implement `SubgramProviderAdapter`
3. Implement `FlyerServiceProviderAdapter` (after getting docs)
4. Create `ProviderRegistryService`

**Deliverables:**
- SubGram integration
- FlyerService integration
- Provider abstraction layer

---

## Timeline

| Phase | Priority | Duration | Dependencies |
|-------|----------|----------|--------------|
| Phase 0: Core API | 🔴 Critical | 2 weeks | None |
| Phase 1: Webhooks | 🔴 Critical | 1 week | Phase 0 |
| Phase 2: Execution | 🔴 Critical | 1.5 weeks | Phase 0 |
| Phase 3: Security | 🟡 High | 1 week | Phase 0 |
| Phase 4: Bot Verification | 🟡 High | 1 week | Phase 3 |
| Phase 5: Analytics | 🟢 Medium | 1 week | Phase 2 |
| Phase 6: Adapters | 🟢 Medium | 2 weeks | Phase 1, 2 |

**Total:** ~8-9 weeks

**MVP:** Phases 0-2 = 4.5 weeks

---

## Security

### API Key Format
```typescript
// Format: prov_live_<32_random_chars>
const apiKey = `prov_live_${generateRandomString(32)}`;
```

### Storage
- Hash keys with bcrypt before storing
- Never store plaintext
- Track last usage

### Webhook Signatures
```typescript
// Generate signature
const signature = crypto
  .createHmac('sha256', webhook.secret)
  .update(JSON.stringify(payload))
  .digest('hex');

// Verify (timing-safe comparison)
crypto.timingSafeEqual(
  Buffer.from(receivedSignature),
  Buffer.from(expectedSignature)
);
```

### Rate Limits
- 1000 req/min for `/orders/available`
- 10000 req/min for `/orders/:id/actions`
- 100 req/min for analytics

---

## Testing

### Unit Tests
```
libs/feature/traffic-provider/main/test/
├── service/
│   ├── provider.service.spec.ts
│   ├── order-matching.service.spec.ts
│   ├── action-validator.service.spec.ts
│   └── webhook.service.spec.ts
└── guard/
    └── provider-api-key.guard.spec.ts
```

### Integration Tests
- Order creation → provider fetch → action submit → completion
- Webhook delivery and retry
- Balance deduction and crediting
- API key authentication

### E2E Tests
```typescript
describe('Provider API E2E', () => {
  it('should allow provider to fetch available orders');
  it('should accept valid action submissions');
  it('should update order progress correctly');
  it('should deliver webhooks on order updates');
  it('should enforce rate limits');
  it('should reject invalid API keys');
});
```

**Target Coverage:** >80%

---

## Next Steps

### This Week
1. ✅ Review this plan
2. ⏳ Get FlyerService API docs
3. ⏳ Decide on MVP vs full implementation
4. ⏳ Create Phase 0 tasks in project tracker

### Next Week
1. Create `libs/feature/traffic-provider` module
2. Implement provider API key system
3. Build first endpoint: `GET /provider/orders/available`
4. Connect balance service to order creation

---

## Success Metrics

| Metric | Target |
|--------|--------|
| API response time (p95) | <200ms |
| Webhook delivery success | >99% |
| Action validation accuracy | >99.5% |
| Test coverage | >80% |
| Active providers (Month 1) | 3+ |
| Orders fulfilled/day | 100+ |

---

## Risks

| Risk | Mitigation |
|------|------------|
| API abuse | Rate limiting, API key revocation, monitoring |
| Webhook failures | Retry logic, dead letter queue |
| Balance errors | Decimal.js, comprehensive testing, audit logs |
| Fraudulent actions | Validation service, proof verification, ML detection |
| Provider downtime | Multiple provider support, fallback mechanisms |

---

## Key Decisions

### 1. Keep Our Naming Conventions
- **API:** camelCase for all fields (our standard)
- **Enums:** lowercase_snake_case (ESLint enforced)
- **Endpoints:** RESTful patterns (`/provider/orders/available`)

### 2. New Module for Provider API
- Separate from existing traffic feature
- Clear boundary between client API and provider API
- Easier to maintain and test

### 3. Balance Integration is Critical
- Must connect before launch
- Use Decimal.js for all calculations
- Implement refunds for cancelled orders

### 4. Start with MVP (Phases 0-2)
- 4.5 weeks to working system
- Can launch with basic functionality
- Add features incrementally

---

## Questions to Answer

1. **FlyerService API** - Need documentation
2. **Provider onboarding** - Manual approval or self-service?
3. **Pricing model** - How do we price provider services?
4. **Dispute resolution** - How to handle rejected actions?
5. **Minimum order size** - Should we enforce minimums?

---

## Resources

- **Current traffic implementation:** `libs/feature/traffic/`
- **SubGram API docs:** https://api.subgram.org/api-docs
- **Balance service:** `libs/feature/balance/`
- **Bot service:** `libs/feature/bot/`
