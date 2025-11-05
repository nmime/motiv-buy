# Traffic Provider API Integration Plan

## Executive Summary

This document provides a comprehensive analysis and integration plan for creating a public API that allows external traffic providers (SubGram, FlyerService, and others) to integrate with our platform. Currently, our system has infrastructure for traffic order management but lacks the critical **traffic delivery** and **provider integration** layer.

**Current State:** 60-70% complete with strong foundation (data models, REST API, bot token validation)
**Missing:** Traffic execution system, provider integration API, webhook handlers, balance integration

---

## Table of Contents

1. [API Comparison & Analysis](#api-comparison--analysis)
2. [Current Implementation Status](#current-implementation-status)
3. [Gap Analysis](#gap-analysis)
4. [Integration Architecture](#integration-architecture)
5. [Public API Design](#public-api-design)
6. [Implementation Plan](#implementation-plan)
7. [Security & Authentication](#security--authentication)
8. [Testing Strategy](#testing-strategy)

---

## 1. API Comparison & Analysis

### 1.1 SubGram API Structure

SubGram provides a comprehensive API with three main categories:

#### **Publisher API (Traffic Sellers - Bot Owners)**

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /get-sponsors` | Request sponsor list for users; handles mandatory subscription blocks | Bot API Key |
| `POST /bots` | Manage bots (add, update, retrieve info) with actions: `add`, `update`, `info` | Secret Key |
| `POST /get-user-subscriptions` | Check user subscription status across resources | Bot API Key |

#### **Advertiser API (Traffic Buyers - Campaign Managers)**

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /orders` | Create and manage advertising campaigns with actions: `create`, `update`, `info` | Secret Key |

#### **General Methods (All Users)**

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /get-balance` | Retrieve account balance and bot revenue summary | API Token |
| `GET /filters` | Public endpoint returning available targeting filters | None |
| `GET /statistic` | Analytics for ads or bot performance with `action` parameter | API Token |
| `POST /toggle-exclusion` | Manage exclusion lists for bots or sponsors | Secret Key |
| **Webhooks** | Real-time subscription event notifications via POST to custom endpoints | Api-Key Header |

#### **Authentication Model**

SubGram uses **three distinct authentication types**:

1. **Secret Key** - Full management access (order creation, bot configuration)
2. **API Token** - Read-only access (balance, statistics)
3. **Bot API Key** - Per-bot operations (sponsor requests, subscription checks)

**Our Assessment:** This multi-tier auth model provides excellent security and flexibility. We should adopt a similar approach.

#### **Request/Response Format**

```json
{
  "status": "ok|error|warning|gender|age|register",
  "code": 200,
  "message": "Description",
  "result": { }
}
```

**Key Features:**
- Demographic-based targeting (gender, age, country, language)
- Subscription tracking with statuses: `subscribed`, `unsubscribed`, `notgetted`
- Pricing coefficients for advanced targeting
- Schedule controls (daily time windows, excluded days)
- Webhook system for real-time events
- Exclusion lists for content filtering

---

### 1.2 FlyerService API

**Status:** Unable to access documentation (requires JavaScript rendering)

**Recommendation:**
- Request OpenAPI/Swagger specification file directly
- Contact FlyerService support for API documentation
- Alternatively, reverse-engineer from client implementation if available

**Assumed Similarities** (based on industry standards):
- REST API with JSON
- Bot token validation
- Order/campaign management
- Webhook notifications
- Targeting parameters

---

### 1.3 Naming Convention Comparison

#### **SubGram Conventions:**

| Component | Pattern | Examples |
|-----------|---------|----------|
| Endpoints | `/action-noun` or `/get-noun` | `/get-sponsors`, `/get-balance`, `/toggle-exclusion` |
| Actions | String literals in body | `action: "add"`, `action: "create"`, `action: "update"` |
| Status | Lowercase strings | `"ok"`, `"error"`, `"warning"` |
| Fields | snake_case | `user_id`, `chat_id`, `bot_id`, `max_sponsors` |

#### **Our Conventions (from CLAUDE.md):**

| Component | Pattern | Examples |
|-----------|---------|----------|
| Endpoints | `/resource/action` | `/traffic/orders`, `/traffic/sources/bots` |
| Enums | PascalCase | `TrafficOrderStatus`, `TrafficSourceType`, `BotStatus` |
| Enum Values | lowercase_snake_case (enforced by ESLint) | `pending`, `in_progress`, `completed` |
| DTOs | `[Domain][Operation]Dto` | `CreateTrafficOrderDto`, `BotResponseDto` |
| Services | `[Domain]Service` | `TrafficService`, `BotTokenValidationService` |
| Fields | camelCase | `userId`, `chatId`, `botId`, `maxSponsors` |

**Compatibility Strategy:**

1. **External API (Provider-facing):** Use snake_case to match industry standards (SubGram, Telegram Bot API)
2. **Internal API (Client-facing):** Keep camelCase for consistency with our existing codebase
3. **Transformation Layer:** Create DTOs that transform between conventions
4. **Database:** Continue using camelCase entity fields, transform at serialization

---

## 2. Current Implementation Status

### 2.1 What We Have ✅

#### **Data Layer (Complete)**

- **Entities:**
  - `TrafficOrderEntity` - Order management with status tracking
  - `TrafficSourceEntity` - Bot/traffic provider registration
  - `TrafficTargetEntity` - Channels/groups receiving traffic
  - `TrafficUserEntity` - Users performing traffic actions
  - `TrafficActionsEntity` - Individual action tracking
  - Junction tables for many-to-many relationships

- **Repositories:**
  - `TrafficOrderRepository` - 15+ methods for order CRUD and analytics
  - `TrafficSourceRepository` - 8+ methods for source management
  - `TrafficTargetRepository` - 11+ methods for target management

#### **API Layer (Complete)**

- **Controllers:**
  - `TrafficController` - Bot token validation and permissions (4 endpoints)
  - `TrafficSourceController` - Bot registration and management (7 endpoints)
  - `TrafficOrderController` - Order creation and management (5 endpoints)
  - `TrafficTargetController` - Target management (2 endpoints)

- **Total:** 18 REST endpoints for internal use

#### **Service Layer (Partial)**

- `TrafficService` (920 lines) - Core business logic for:
  - Bot validation and registration
  - Order creation and management
  - Available traffic listing
  - Settings management

- `BotTokenValidationService` (545 lines) - Comprehensive token validation:
  - Redis caching (5-minute expiry)
  - Rate limiting (100 requests/minute per IP)
  - Token format validation
  - Permissions management

#### **Authentication & Security**

- JWT-based user authentication
- Bot token validation system with decorators
- Custom exceptions for error handling
- Rate limiting infrastructure

#### **Bot Integration**

- Telegram bot implementation (Grammy framework)
- Order creation flow (A1-A6 steps)
- Bot menu system
- Session state management

---

### 2.2 What's Missing ❌

#### **Critical Gaps:**

1. **Traffic Delivery System**
   - No mechanism to assign orders to traffic users
   - No action scheduling or execution
   - `TrafficActionsEntity` exists but unused
   - `currentCount` field never updated
   - No progress tracking

2. **Provider Integration API**
   - No public API for external providers to integrate
   - Missing `/get-orders` endpoint for providers to fetch available orders
   - No `/submit-action` endpoint for providers to report completions
   - No provider authentication/API key system

3. **Webhook System**
   - No webhook handlers for traffic completion events
   - No webhook registration endpoints
   - No webhook signature verification
   - No retry mechanism for failed webhooks

4. **Balance Integration**
   - Order creation doesn't deduct balance
   - No payment processing on order creation
   - `spentAmount` field never updated
   - No refund logic for cancelled orders
   - Missing integration with `@app/feature-balance-main`

5. **Bot-Shared Integration**
   - `BotTokenValidationService.validateWithBotShared()` is placeholder
   - No real Telegram Bot API calls
   - Permission system is static, not dynamic
   - No actual bot ownership verification

6. **Ownership & Access Control**
   - `findSourcesByManager()` returns all sources (not filtered by user)
   - `validateSourceAccess()` doesn't check actual ownership
   - `managedBy` field in entities not properly utilized
   - Missing entity-level permission checks

7. **Analytics & Reporting**
   - Statistics methods return hardcoded values
   - No real earnings calculations
   - No completion rate tracking
   - Missing dashboard/analytics endpoints

8. **Repository Mismatch**
   - Declared interfaces in `main/src/repository/` don't match implementations
   - Methods like `updateStatus()` in interface not in repository

9. **Testing**
   - Very limited test coverage
   - No integration tests
   - Only bot-token validation has test file

---

## 3. Gap Analysis

### 3.1 SubGram vs Our Implementation

| Feature | SubGram | Our System | Gap |
|---------|---------|------------|-----|
| **Traffic Buying** | ✅ `/orders` (create, update, info) | ✅ Full REST API | ⚠️ No balance deduction |
| **Traffic Selling (Bot Registration)** | ✅ `/bots` (add, update, info) | ✅ Bot registration API | ❌ No traffic delivery |
| **Sponsor/Order Matching** | ✅ `/get-sponsors` | ❌ Missing | **CRITICAL GAP** |
| **User Action Tracking** | ✅ `/get-user-subscriptions` | ❌ Missing | **CRITICAL GAP** |
| **Balance Management** | ✅ `/get-balance` | ✅ Balance feature exists | ❌ Not integrated |
| **Targeting Filters** | ✅ `/filters` (public) | ❌ Missing | Needed for UI |
| **Analytics** | ✅ `/statistic` | ⚠️ Hardcoded values | Needs implementation |
| **Webhooks** | ✅ Real-time events | ❌ Missing | **CRITICAL GAP** |
| **Exclusion Lists** | ✅ `/toggle-exclusion` | ❌ Missing | Nice-to-have |
| **Multi-tier Auth** | ✅ Secret Key, API Token, Bot Key | ⚠️ Only JWT + Bot Token | Needs API key system |

### 3.2 Priority Matrix

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Provider Integration API | 🔴 Critical | High | **P0** |
| Webhook System | 🔴 Critical | Medium | **P0** |
| Traffic Delivery System | 🔴 Critical | High | **P0** |
| Balance Integration | 🔴 Critical | Low | **P0** |
| Bot-Shared Integration | 🟡 High | Medium | **P1** |
| Ownership/Access Control | 🟡 High | Low | **P1** |
| Analytics & Reporting | 🟢 Medium | Medium | **P2** |
| Targeting Filters API | 🟢 Medium | Low | **P2** |
| Exclusion Lists | 🔵 Low | Low | **P3** |

---

## 4. Integration Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Providers                        │
│                  (SubGram, FlyerService, Others)                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ REST API (snake_case)
                               │ + Webhook Callbacks
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                   Provider Integration Layer                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Provider API    │  │  Webhook Handler │  │  Auth/API Key │ │
│  │  Controller      │  │  Service         │  │  Validation   │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ Internal DTO Transformation
                               │ (snake_case → camelCase)
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      Core Traffic System                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Traffic Service │  │  Order Matching  │  │  Action       │ │
│  │  (Existing)      │  │  Engine (NEW)    │  │  Scheduler    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     Integration Services                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Balance Service │  │  Bot-Shared      │  │  Payment      │ │
│  │  Integration     │  │  Integration     │  │  Integration  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                          Data Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Traffic Entities│  │  Repositories    │  │  PostgreSQL   │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  REST API        │  │  Telegram Bot    │  │  Web UI       │ │
│  │  (camelCase)     │  │  (Grammy)        │  │  (Future)     │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Provider Abstraction Layer

To support multiple providers (SubGram, FlyerService, custom integrations), we need an abstraction layer:

```typescript
// libs/feature/traffic/main/src/provider/traffic-provider.interface.ts

export interface TrafficProviderConfig {
  providerId: string;
  providerName: string;
  apiKey: string;
  webhookUrl: string;
  isActive: boolean;
  supportedActions: TrafficActionType[];
}

export interface TrafficProviderAdapter {
  /**
   * Submit an order to the provider
   */
  submitOrder(order: TrafficOrderEntity): Promise<Result<string, Error>>;

  /**
   * Cancel an order with the provider
   */
  cancelOrder(orderId: string): Promise<Result<void, Error>>;

  /**
   * Get order status from provider
   */
  getOrderStatus(orderId: string): Promise<Result<ProviderOrderStatus, Error>>;

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: unknown, signature: string): boolean;

  /**
   * Parse webhook payload into standardized format
   */
  parseWebhookPayload(payload: unknown): Result<TrafficActionEvent, Error>;
}
```

**Implementations:**
- `SubgramProviderAdapter` - SubGram API integration
- `FlyerServiceProviderAdapter` - FlyerService API integration
- `CustomProviderAdapter` - For direct bot integrations

---

## 5. Public API Design

### 5.1 Provider-Facing Endpoints

#### **Authentication**

All provider endpoints require API key authentication:

```
Authorization: Bearer <PROVIDER_API_KEY>
```

#### **Endpoint Specification**

**Base Path:** `/api/v1/provider`

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/orders/available` | Get orders available for the provider | API Key |
| `POST` | `/orders/:orderId/actions` | Submit completed action | API Key |
| `GET` | `/orders/:orderId/status` | Get order status and progress | API Key |
| `POST` | `/webhooks/register` | Register webhook URL | API Key |
| `GET` | `/webhooks` | Get registered webhooks | API Key |
| `DELETE` | `/webhooks/:webhookId` | Delete webhook | API Key |
| `GET` | `/filters` | Get available targeting filters (public) | None |
| `GET` | `/balance` | Get provider earnings and balance | API Key |
| `GET` | `/statistics` | Get performance statistics | API Key |

---

### 5.2 Detailed Endpoint Specifications

#### **GET /api/v1/provider/orders/available**

Get list of orders that match the provider's capabilities.

**Request:**
```http
GET /api/v1/provider/orders/available?type=channel_subscribers&status=active
Authorization: Bearer <PROVIDER_API_KEY>
```

**Query Parameters:**
- `type` (optional): Filter by traffic type (`channel_subscribers`, `post_views`, etc.)
- `status` (optional): Filter by status (`active`, `pending`)
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "status": "ok",
  "code": 200,
  "result": {
    "orders": [
      {
        "order_id": "ORD-123456",
        "type": "channel_subscribers",
        "target": {
          "telegram_id": "@channel_name",
          "username": "channel_name",
          "type": "channel"
        },
        "requirements": {
          "total_count": 1000,
          "current_count": 250,
          "remaining_count": 750,
          "per_day_limit": 100,
          "targeting": {
            "gender": ["male", "female"],
            "age_min": 18,
            "age_max": 35,
            "countries": ["US", "UK", "CA"],
            "languages": ["en"]
          }
        },
        "pricing": {
          "price_per_action": "0.50",
          "total_budget": "500.00",
          "spent_amount": "125.00"
        },
        "schedule": {
          "start_date": "2025-11-05T00:00:00Z",
          "end_date": "2025-11-15T23:59:59Z",
          "daily_start_hour": 9,
          "daily_end_hour": 21
        },
        "status": "active"
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

---

#### **POST /api/v1/provider/orders/:orderId/actions**

Submit completed traffic actions for an order.

**Request:**
```http
POST /api/v1/provider/orders/ORD-123456/actions
Authorization: Bearer <PROVIDER_API_KEY>
Content-Type: application/json

{
  "actions": [
    {
      "user_id": 123456789,
      "username": "john_doe",
      "action_type": "subscribe",
      "completed_at": "2025-11-05T10:30:00Z",
      "proof": {
        "screenshot_url": "https://...",
        "additional_data": {}
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "ok",
  "code": 200,
  "result": {
    "accepted": 1,
    "rejected": 0,
    "actions": [
      {
        "action_id": "ACT-789012",
        "user_id": 123456789,
        "status": "accepted",
        "reward": "0.50"
      }
    ],
    "order_progress": {
      "current_count": 251,
      "remaining_count": 749,
      "completion_percentage": 25.1
    }
  }
}
```

---

#### **POST /api/v1/provider/webhooks/register**

Register a webhook URL to receive real-time updates.

**Request:**
```http
POST /api/v1/provider/webhooks/register
Authorization: Bearer <PROVIDER_API_KEY>
Content-Type: application/json

{
  "url": "https://provider.example.com/webhooks/traffic",
  "events": ["order.created", "order.updated", "order.completed", "order.cancelled"],
  "secret": "webhook_signing_secret"
}
```

**Response:**
```json
{
  "status": "ok",
  "code": 200,
  "result": {
    "webhook_id": "WH-456789",
    "url": "https://provider.example.com/webhooks/traffic",
    "events": ["order.created", "order.updated", "order.completed", "order.cancelled"],
    "created_at": "2025-11-05T10:00:00Z",
    "is_active": true
  }
}
```

---

#### **GET /api/v1/provider/filters**

Get available targeting filters (public endpoint, no auth required).

**Request:**
```http
GET /api/v1/provider/filters
```

**Response:**
```json
{
  "status": "ok",
  "code": 200,
  "result": {
    "genders": ["male", "female"],
    "age_ranges": [
      {"label": "18-24", "min": 18, "max": 24},
      {"label": "25-34", "min": 25, "max": 34},
      {"label": "35-44", "min": 35, "max": 44}
    ],
    "countries": [
      {"code": "US", "name": "United States"},
      {"code": "UK", "name": "United Kingdom"}
    ],
    "languages": [
      {"code": "en", "name": "English"},
      {"code": "ru", "name": "Russian"}
    ],
    "traffic_types": [
      {
        "type": "channel_subscribers",
        "display_name": "Channel Subscribers",
        "base_price": "0.50"
      }
    ]
  }
}
```

---

### 5.3 Webhook Payload Format

When an order is created/updated, providers receive webhooks:

**Order Created Event:**
```json
{
  "event": "order.created",
  "timestamp": "2025-11-05T10:00:00Z",
  "signature": "sha256=...",
  "data": {
    "order_id": "ORD-123456",
    "type": "channel_subscribers",
    "target": {
      "telegram_id": "@channel_name",
      "username": "channel_name"
    },
    "requirements": {
      "total_count": 1000,
      "per_day_limit": 100
    },
    "pricing": {
      "price_per_action": "0.50"
    }
  }
}
```

**Action Completed Event** (reverse webhook - we send to order creator):
```json
{
  "event": "action.completed",
  "timestamp": "2025-11-05T10:30:00Z",
  "data": {
    "order_id": "ORD-123456",
    "action_id": "ACT-789012",
    "user_id": 123456789,
    "action_type": "subscribe",
    "status": "verified",
    "completed_at": "2025-11-05T10:30:00Z"
  }
}
```

---

## 6. Implementation Plan

### 6.1 Phase 0: Foundation (P0 - Critical) - 2 weeks

**Goal:** Enable basic provider integration and traffic delivery

#### **Tasks:**

1. **Create Provider API Module** (`libs/feature/traffic-provider`)
   - `main/` - Controllers, services, provider adapters
   - `shared/` - DTOs for provider API (snake_case)
   - Module structure:
     ```
     libs/feature/traffic-provider/
     ├── main/
     │   ├── src/
     │   │   ├── controller/
     │   │   │   ├── provider-order.controller.ts
     │   │   │   ├── provider-webhook.controller.ts
     │   │   │   └── provider-analytics.controller.ts
     │   │   ├── service/
     │   │   │   ├── provider.service.ts
     │   │   │   ├── webhook.service.ts
     │   │   │   └── action-validator.service.ts
     │   │   ├── adapter/
     │   │   │   ├── traffic-provider.interface.ts
     │   │   │   ├── subgram-provider.adapter.ts
     │   │   │   └── flyerservice-provider.adapter.ts
     │   │   └── guard/
     │   │       └── provider-api-key.guard.ts
     │   └── test/
     └── shared/
         └── src/
             ├── dto/
             │   ├── provider-order.dto.ts (snake_case)
             │   ├── provider-action.dto.ts (snake_case)
             │   └── provider-webhook.dto.ts (snake_case)
             └── exception/
     ```

2. **Provider API Key System**
   - New entity: `ProviderApiKeyEntity`
   - Fields: `apiKey`, `providerId`, `providerName`, `permissions`, `isActive`, `createdBy`, `lastUsedAt`
   - Repository: `ProviderApiKeyRepository`
   - Service: `ProviderApiKeyService` (generate, validate, revoke)
   - Guard: `ProviderApiKeyGuard`

3. **Implement Core Provider Endpoints**
   - `GET /api/v1/provider/orders/available`
   - `POST /api/v1/provider/orders/:orderId/actions`
   - `GET /api/v1/provider/orders/:orderId/status`
   - `GET /api/v1/provider/filters` (public)

4. **Webhook Infrastructure**
   - New entity: `WebhookEntity` (url, events, secret, providerId, isActive)
   - Service: `WebhookService` (register, validate signature, send webhooks)
   - Controller: `ProviderWebhookController`
   - Queue: NATS message queue for async webhook delivery
   - Retry logic: Exponential backoff (3 retries)

5. **Balance Integration**
   - Update `TrafficService.createTrafficOrder()`:
     ```typescript
     // Before creating order
     const totalCost = multiply(pricePerAction, targetCount);
     const balanceResult = await this.balanceService.deductBalance(userId, totalCost);
     if (balanceResult.err) {
       throw new InsufficientBalanceException();
     }
     ```
   - Update `TrafficService` to track `spentAmount` on action completion
   - Add refund logic in `cancelTrafficOrder()`

6. **Action Submission & Validation**
   - Service: `ActionValidatorService`
   - Validate user eligibility (not already subscribed)
   - Verify action completion (optional: check via Telegram API)
   - Update order progress (`currentCount`)
   - Create `TrafficActionsEntity` record
   - Credit provider's balance

**Deliverables:**
- Provider API module with 4 core endpoints
- API key authentication system
- Webhook registration and delivery
- Balance deduction on order creation
- Action submission and validation

**Testing:**
- Unit tests for all services
- Integration tests for API endpoints
- Webhook delivery tests with mock providers

---

### 6.2 Phase 1: Provider Adapters (P0 - Critical) - 2 weeks

**Goal:** Implement SubGram and FlyerService integration

#### **Tasks:**

1. **SubGram Provider Adapter**
   - Implement `SubgramProviderAdapter` class
   - Map our orders to SubGram's `/orders` API format
   - Handle webhook payload from SubGram
   - Signature verification using SubGram's method

2. **FlyerService Provider Adapter**
   - Research FlyerService API (obtain documentation)
   - Implement `FlyerServiceProviderAdapter` class
   - Map our orders to FlyerService format
   - Handle webhook payload

3. **Provider Registry**
   - Service: `ProviderRegistryService`
   - Register available providers
   - Route orders to appropriate provider based on capabilities
   - Load balancing between providers

4. **Order Matching Engine**
   - Service: `OrderMatchingService`
   - Algorithm to match orders with available providers
   - Consider: provider capabilities, pricing, capacity, performance history
   - Support multiple providers per order

**Deliverables:**
- SubGram adapter with full integration
- FlyerService adapter
- Provider registry and routing system
- Order matching engine

---

### 6.3 Phase 2: Bot-Shared Integration (P1 - High) - 1 week

**Goal:** Real bot token validation and ownership verification

#### **Tasks:**

1. **Integrate with Bot-Shared Feature**
   - Update `BotTokenValidationService.validateWithBotShared()`
   - Use real Telegram Bot API calls via bot-shared
   - Implement `@app/feature-bot-shared` integration

2. **Dynamic Permission System**
   - Fetch bot permissions from Telegram API
   - Validate bot ownership (user must be bot creator)
   - Cache results in Redis

3. **Bot Ownership Verification**
   - Before creating `TrafficSourceEntity`, verify user owns bot
   - Check via Telegram Bot API `/getMe` and compare creator

**Deliverables:**
- Real bot token validation
- Ownership verification
- Dynamic permission system

---

### 6.4 Phase 3: Access Control & Security (P1 - High) - 1 week

**Goal:** Implement proper ownership and access control

#### **Tasks:**

1. **Entity-Level Access Control**
   - Update `TrafficOrderRepository.findByCreator()` to filter by user
   - Implement `validateSourceAccess()` to check ownership
   - Guard: `TrafficOrderOwnershipGuard`
   - Guard: `TrafficSourceOwnershipGuard`

2. **API Key Permissions**
   - Define permission scopes: `orders:read`, `orders:write`, `actions:submit`, `webhooks:manage`
   - Enforce permissions in guards
   - Rate limiting per API key

3. **Webhook Security**
   - HMAC-SHA256 signature verification
   - Request timestamp validation (prevent replay attacks)
   - IP whitelist (optional)

**Deliverables:**
- Ownership guards on all endpoints
- API key permission system
- Enhanced webhook security

---

### 6.5 Phase 4: Analytics & Reporting (P2 - Medium) - 1 week

**Goal:** Real statistics and performance tracking

#### **Tasks:**

1. **Statistics Service**
   - Service: `TrafficAnalyticsService`
   - Calculate real earnings for providers
   - Track completion rates
   - Monitor order performance

2. **Provider Analytics API**
   - `GET /api/v1/provider/balance` - Real earnings and balance
   - `GET /api/v1/provider/statistics` - Performance metrics
   - Daily/weekly/monthly aggregations

3. **Dashboard Data**
   - Aggregate data for admin dashboard
   - Real-time metrics via Redis

**Deliverables:**
- Real analytics and statistics
- Provider balance and earnings tracking
- Performance monitoring

---

### 6.6 Phase 5: Advanced Features (P2-P3) - 2 weeks

**Goal:** Exclusion lists, advanced targeting, optimization

#### **Tasks:**

1. **Exclusion Lists**
   - Entity: `ExclusionListEntity`
   - API: `POST /api/v1/provider/exclusions`
   - Filter orders based on excluded topics/categories

2. **Advanced Targeting**
   - Implement all SubGram targeting parameters
   - Pricing coefficients for advanced targeting
   - Schedule controls (daily time windows)

3. **Performance Optimization**
   - Database query optimization
   - Caching strategy (Redis)
   - Load testing and tuning

**Deliverables:**
- Exclusion list functionality
- Full targeting parameter support
- Optimized performance

---

## 7. Security & Authentication

### 7.1 Multi-Tier Authentication

| Auth Type | Use Case | Header | Permissions |
|-----------|----------|--------|-------------|
| **JWT Bearer Token** | Client API (users) | `Authorization: Bearer <JWT>` | Full user permissions |
| **Provider API Key** | Provider API | `Authorization: Bearer <API_KEY>` | Provider-specific permissions |
| **Bot Token** | Bot operations | `Auth: <BOT_TOKEN>` | Bot-specific permissions |
| **Webhook Secret** | Webhook verification | `X-Signature: <HMAC>` | Signature validation |

### 7.2 API Key Management

**Generation:**
```typescript
// Format: prov_live_<random_32_chars>
const apiKey = `prov_live_${generateRandomString(32)}`;
```

**Storage:**
- Hash API keys in database (bcrypt)
- Store only hash, never plaintext
- Include metadata: created_at, last_used_at, permissions

**Validation:**
```typescript
async validateApiKey(apiKey: string): Promise<Result<Provider, Error>> {
  const hash = await bcrypt.hash(apiKey, SALT_ROUNDS);
  const provider = await this.providerRepository.findByApiKeyHash(hash);
  if (!provider || !provider.isActive) {
    return Err(new InvalidApiKeyError());
  }
  await this.providerRepository.updateLastUsed(provider.id);
  return Ok(provider);
}
```

### 7.3 Webhook Signature Verification

**Algorithm:** HMAC-SHA256

**Signature Generation (our side):**
```typescript
const signature = crypto
  .createHmac('sha256', webhook.secret)
  .update(JSON.stringify(payload))
  .digest('hex');

headers['X-Signature'] = `sha256=${signature}`;
```

**Signature Verification (provider side):**
```typescript
validateWebhookSignature(payload: unknown, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', this.config.webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`)
  );
}
```

### 7.4 Rate Limiting

**Per API Key:**
- 1000 requests per minute for `/orders/available`
- 10000 requests per minute for `/orders/:id/actions`
- 100 requests per minute for analytics endpoints

**Implementation:** Redis with sliding window algorithm

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Coverage Target:** >80%

**Test Files:**
```
libs/feature/traffic-provider/main/test/
├── service/
│   ├── provider.service.spec.ts
│   ├── webhook.service.spec.ts
│   └── action-validator.service.spec.ts
├── adapter/
│   ├── subgram-provider.adapter.spec.ts
│   └── flyerservice-provider.adapter.spec.ts
└── guard/
    └── provider-api-key.guard.spec.ts
```

### 8.2 Integration Tests

**Test Scenarios:**
1. Complete order flow: Create → Match → Submit Actions → Complete
2. Webhook delivery and retry logic
3. Balance deduction and refund
4. API key authentication and permissions
5. Signature verification

### 8.3 E2E Tests

**Test Suite:**
```typescript
describe('Provider API E2E', () => {
  it('should allow provider to fetch available orders');
  it('should accept valid action submissions');
  it('should reject invalid actions');
  it('should update order progress correctly');
  it('should deliver webhooks on order updates');
  it('should retry failed webhook deliveries');
  it('should enforce rate limits');
});
```

### 8.4 Load Testing

**Tool:** k6 or Artillery

**Scenarios:**
- 100 concurrent providers fetching orders
- 1000 action submissions per second
- Webhook delivery under load

---

## 9. Migration & Deployment

### 9.1 Database Migrations

**New Tables:**
```sql
-- Provider API keys
CREATE TABLE provider_api_key (
  id UUID PRIMARY KEY,
  api_key_hash VARCHAR(255) NOT NULL UNIQUE,
  provider_id VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  INDEX idx_provider_api_key_hash (api_key_hash),
  INDEX idx_provider_id (provider_id)
);

-- Webhooks
CREATE TABLE webhook (
  id UUID PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_triggered_at TIMESTAMP,
  INDEX idx_provider_webhooks (provider_id, is_active)
);

-- Webhook delivery logs
CREATE TABLE webhook_delivery_log (
  id UUID PRIMARY KEY,
  webhook_id UUID REFERENCES webhook(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  attempt_count INT DEFAULT 0,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  INDEX idx_webhook_deliveries (webhook_id, delivered_at)
);
```

### 9.2 Feature Flags

Use environment variables to enable/disable features:

```env
TRAFFIC_PROVIDER_API_ENABLED=true
TRAFFIC_WEBHOOK_ENABLED=true
TRAFFIC_SUBGRAM_ENABLED=true
TRAFFIC_FLYERSERVICE_ENABLED=false
```

### 9.3 Rollout Plan

**Stage 1: Internal Testing (1 week)**
- Deploy to staging environment
- Test with mock providers
- Performance testing

**Stage 2: Beta (2 weeks)**
- Invite 2-3 trusted providers
- Monitor metrics and errors
- Gather feedback

**Stage 3: General Availability**
- Open to all providers
- Documentation published
- Support channels ready

---

## 10. Documentation Requirements

### 10.1 Provider API Documentation

**Tool:** OpenAPI/Swagger (already integrated)

**Sections:**
1. Getting Started
2. Authentication
3. API Endpoints (full reference)
4. Webhooks
5. Error Codes
6. Rate Limits
7. SDKs (optional: JS, Python, Go)

### 10.2 Integration Guides

**Guides:**
- SubGram Integration Guide
- FlyerService Integration Guide
- Custom Provider Integration Guide

---

## 11. Success Metrics

### 11.1 Technical Metrics

| Metric | Target |
|--------|--------|
| API Response Time (p95) | <200ms |
| Webhook Delivery Success Rate | >99% |
| Action Validation Accuracy | >99.5% |
| API Uptime | >99.9% |
| Test Coverage | >80% |

### 11.2 Business Metrics

| Metric | Target |
|--------|--------|
| Active Providers | 5+ in first month |
| Orders Fulfilled per Day | 100+ |
| Average Order Completion Time | <7 days |
| Provider Revenue | Track and report |

---

## 12. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Provider API abuse** | High | Medium | Rate limiting, API key revocation, monitoring |
| **Webhook delivery failures** | High | Medium | Retry logic, dead letter queue, monitoring |
| **Balance calculation errors** | Critical | Low | Decimal.js, comprehensive testing, audit logs |
| **Bot token validation bypass** | High | Low | Multi-layer validation, bot-shared integration |
| **Fraudulent action submissions** | High | Medium | Action validator, proof verification, ML detection |
| **Database performance degradation** | High | Medium | Query optimization, indexes, connection pooling |
| **Third-party API downtime** (SubGram, FlyerService) | Medium | Medium | Multiple provider support, fallback mechanisms |

---

## 13. Next Steps

### 13.1 Immediate Actions (This Week)

1. ✅ **Review this document** with team
2. ⏳ **Prioritize phases** based on business needs
3. ⏳ **Obtain FlyerService API documentation**
4. ⏳ **Create Phase 0 epic** in project management tool
5. ⏳ **Set up staging environment** for testing

### 13.2 Phase 0 Kickoff (Next Week)

1. Create `libs/feature/traffic-provider` module structure
2. Implement provider API key system
3. Build core 4 endpoints
4. Set up webhook infrastructure
5. Integrate with balance service

---

## 14. Appendices

### Appendix A: Current File Structure

See [Current Implementation Status](#current-implementation-status)

### Appendix B: API Naming Convention Examples

**External API (snake_case):**
```json
{
  "order_id": "ORD-123",
  "user_id": 12345,
  "price_per_action": "0.50"
}
```

**Internal API (camelCase):**
```json
{
  "orderId": "ORD-123",
  "userId": 12345,
  "pricePerAction": "0.50"
}
```

**Transformation:**
```typescript
// libs/feature/traffic-provider/shared/src/mapper/order.mapper.ts

export function toProviderOrderDto(order: TrafficOrderEntity): ProviderOrderDto {
  return {
    order_id: order.orderId,
    user_id: order.creator.userId,
    price_per_action: order.pricePerAction,
    // ... rest of mapping (camelCase → snake_case)
  };
}

export function fromProviderActionDto(dto: ProviderActionDto): CreateActionDto {
  return {
    userId: dto.user_id,
    actionType: dto.action_type,
    completedAt: dto.completed_at,
    // ... rest of mapping (snake_case → camelCase)
  };
}
```

### Appendix C: Example Provider Configuration

```typescript
// config/providers.config.ts

export const PROVIDER_CONFIGS: TrafficProviderConfig[] = [
  {
    providerId: 'subgram',
    providerName: 'SubGram',
    apiKey: process.env.SUBGRAM_API_KEY,
    webhookUrl: process.env.SUBGRAM_WEBHOOK_URL,
    isActive: true,
    supportedActions: [
      TrafficActionType.ChannelSubscribe,
      TrafficActionType.GroupJoin,
      TrafficActionType.PostView,
    ],
  },
  {
    providerId: 'flyerservice',
    providerName: 'FlyerService',
    apiKey: process.env.FLYERSERVICE_API_KEY,
    webhookUrl: process.env.FLYERSERVICE_WEBHOOK_URL,
    isActive: false, // Enable after integration
    supportedActions: [
      TrafficActionType.ChannelSubscribe,
    ],
  },
];
```

---

## Conclusion

This integration plan provides a comprehensive roadmap for building a production-ready traffic provider API. The phased approach ensures critical features are implemented first while maintaining code quality and security standards.

**Estimated Timeline:**
- **Phase 0 (Critical):** 2 weeks
- **Phase 1 (Critical):** 2 weeks
- **Phase 2 (High):** 1 week
- **Phase 3 (High):** 1 week
- **Phase 4 (Medium):** 1 week
- **Phase 5 (Low):** 2 weeks

**Total:** ~9 weeks for complete implementation

**Key Success Factors:**
1. Maintain strict type safety (no `any`, no `as`)
2. Use Decimal.js for all financial calculations
3. Comprehensive testing at every phase
4. Proper module separation (main/shared)
5. Security-first approach (authentication, validation, rate limiting)
6. Extensive documentation for providers

By following this plan, we'll create a robust, scalable traffic provider integration system that supports multiple providers and enables our platform to compete with SubGram and FlyerService.
