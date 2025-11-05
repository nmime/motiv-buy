# Traffic API Task Workflows

## Overview

This document describes the complete task/order workflows used by traffic provider APIs (SubGram, FlyerService) and how we should implement similar workflows in our system.

---

## SubGram Task Workflow

### Three Actors

1. **Advertiser** - Creates campaigns, buys traffic
2. **Publisher** - Owns bots, sells traffic
3. **User** - Performs actions (subscribes, views, joins)

---

### Complete Order Lifecycle

```
┌──────────────┐
│  Advertiser  │
│ Creates Order│
└──────┬───────┘
       │
       │ POST /orders (action: "create")
       │ {target, quantity, price, targeting}
       ▼
┌─────────────────┐
│   Moderation    │ ← Order sent for approval
└──────┬──────────┘
       │
       │ Approved
       ▼
┌─────────────────┐
│  Order Active   │
└──────┬──────────┘
       │
       │ Distributed to publishers
       │
       ▼
┌──────────────────────────────────────┐
│           Publisher Bots              │
│  (Multiple bots showing to users)    │
└──────┬───────────────────────────────┘
       │
       │ User interacts with bot
       │
       ▼
┌─────────────────┐
│  Bot Requests   │
│  Sponsors       │
└──────┬──────────┘
       │
       │ POST /get-sponsors
       │ {user_id, chat_id, gender?, age?}
       ▼
┌─────────────────┐
│ SubGram Returns │
│ Sponsor List    │
└──────┬──────────┘
       │
       │ status: "ok" | "warning" | "gender" | "age"
       │
       ▼
┌─────────────────┐
│  Bot Shows      │
│  Sponsors       │
└──────┬──────────┘
       │
       │ User clicks
       ▼
┌─────────────────┐
│ User Subscribes │
│  to Channel     │
└──────┬──────────┘
       │
       │ Subscription confirmed
       │
       ▼
┌─────────────────┐
│  Webhook Fired  │ → POST <webhook_url>
└──────┬──────────┘   {user_id, status: "subscribed"}
       │
       │
       ▼
┌─────────────────┐
│ Order Progress  │
│  Updated        │
└──────┬──────────┘
       │
       │ When complete
       ▼
┌─────────────────┐
│ Order Completed │
│ Revenue Settled │
└─────────────────┘
```

---

## SubGram Workflow Details

### 1. Advertiser Creates Order

**Endpoint:** `POST /orders`

**Request:**
```json
{
  "action": "create",
  "link": "https://t.me/channel_name",
  "count": 1000,
  "count_per_day": 100,
  "price": 0.50,
  "targeting": {
    "gender": "male",
    "age_from": 18,
    "age_to": 35,
    "country": "US",
    "language": "en"
  }
}
```

**What Happens:**
- System validates the order
- Sends to moderation queue
- Deducts budget from advertiser balance
- Returns order ID

**Response:**
```json
{
  "status": "ok",
  "result": {
    "order_id": 12345,
    "status": "moderation"
  }
}
```

---

### 2. Order Enters Moderation

**Process:**
- SubGram team reviews order
- Checks if target channel is valid
- Verifies compliance with policies
- Approves or rejects

**Duration:** Usually a few hours

---

### 3. Order Becomes Active

**What Happens:**
- Order status changes to "active"
- System starts distributing to publisher bots
- Order appears in publisher's available sponsors list

**Publisher Notification:**
- Webhook fired (if configured)
- New order available for their bots

---

### 4. Publisher Bot Shows Sponsors

**Endpoint:** `POST /get-sponsors`

**When Called:**
- User clicks button in bot
- User tries to access locked content
- Bot forces mandatory subscription

**Request:**
```json
{
  "user_id": 123456789,
  "chat_id": 123456789,
  "gender": "male",
  "age": 25
}
```

**Response Scenarios:**

**A) User Needs to Subscribe:**
```json
{
  "status": "warning",
  "result": {
    "sponsors": [
      {
        "link": "https://t.me/sponsor_channel_1",
        "title": "Sponsor Channel 1",
        "status": "unsubscribed"
      },
      {
        "link": "https://t.me/sponsor_channel_2",
        "title": "Sponsor Channel 2",
        "status": "notgetted"
      }
    ]
  }
}
```

**B) User Already Subscribed:**
```json
{
  "status": "ok",
  "message": "User has access"
}
```

**C) Need Demographics:**
```json
{
  "status": "gender",
  "message": "Please select your gender"
}
```

---

### 5. User Subscribes

**Process:**
1. User clicks sponsor link
2. Telegram opens channel
3. User hits "Subscribe" button
4. Telegram confirms subscription

**User Returns to Bot:**
- Clicks "I subscribed" button
- Bot calls `/get-user-subscriptions` to verify

---

### 6. Subscription Verification

**Endpoint:** `POST /get-user-subscriptions`

**Request:**
```json
{
  "user_id": 123456789
}
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "subscriptions": [
      {
        "link": "https://t.me/sponsor_channel_1",
        "status": "subscribed",
        "subscribe_date": "2025-11-05T10:30:00Z"
      }
    ]
  }
}
```

---

### 7. Webhook Notification

**When:** Immediately after subscription confirmed

**Endpoint:** `POST <advertiser_webhook_url>`

**Payload:**
```json
{
  "webhook_id": "WH123",
  "user_id": 123456789,
  "bot_id": 456,
  "link": "https://t.me/sponsor_channel_1",
  "status": "subscribed",
  "subscribe_date": "2025-11-05T10:30:00Z"
}
```

**Headers:**
```
Api-Key: <bot_api_key>
```

---

### 8. Order Progress Tracking

**Endpoint:** `GET /statistic`

**Request:**
```json
{
  "action": "order",
  "order_id": 12345
}
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "order_id": 12345,
    "total_count": 1000,
    "current_count": 250,
    "remaining_count": 750,
    "spent_amount": 125.00,
    "status": "active"
  }
}
```

---

### 9. Order Completion

**When:** `current_count >= total_count`

**What Happens:**
- Order status changes to "completed"
- No longer shown to publishers
- Final webhook sent
- Revenue settled

**Final Webhook:**
```json
{
  "event": "order.completed",
  "order_id": 12345,
  "total_subscribers": 1000,
  "total_cost": 500.00,
  "completion_date": "2025-11-15T18:00:00Z"
}
```

---

### 10. Revenue Settlement

**Publisher Side:**
- Earns commission per subscriber delivered
- Balance updated in real-time
- Can withdraw via `/get-balance`

**Advertiser Side:**
- Charged only for confirmed subscriptions
- Unspent budget returned if order cancelled
- Can track spending via statistics

---

## FlyerService Task Workflow

**Status:** ❌ Documentation unavailable (requires JavaScript)

**What We Know:**
- Similar industry (Telegram traffic)
- Likely similar workflow to SubGram
- REST API with JSON

**What We Need:**
- Request OpenAPI/Swagger spec
- Contact FlyerService support
- Or test with actual API access

---

## Key Workflow Patterns

### Pattern 1: Two-Sided Marketplace

**Buy Side (Advertisers):**
1. Create order
2. Wait for moderation
3. Track progress
4. Receive webhooks
5. Pay for results

**Sell Side (Publishers):**
1. Register bot
2. Get available orders (pull)
3. Show to users
4. Report subscriptions
5. Earn revenue

### Pattern 2: Pull Model (SubGram)

Publishers **pull** orders:
- Bot calls `/get-sponsors` when user interacts
- SubGram decides which sponsors to show
- Based on targeting, user demographics, bot settings

**Advantage:** SubGram controls distribution

### Pattern 3: Push Model (Alternative)

Platform **pushes** orders:
- Webhook sent when new order available
- Publisher decides whether to accept
- Reports back when actions completed

**Advantage:** Publisher has more control

### Pattern 4: Verification Flow

**Claim → Verify → Reward**

1. User claims action (clicks link)
2. System verifies completion (checks subscription)
3. Reward issued (progress updated, payment credited)

**Critical:** Prevents fraud

---

## Our Implementation Strategy

### What We Should Build

**Based on SubGram's proven model:**

1. **Two APIs:**
   - **Client API** (advertisers create orders) ✅ We have this
   - **Provider API** (publishers fulfill orders) ❌ We need this

2. **Pull Model:**
   - Providers call `GET /provider/orders/available`
   - We return matching orders
   - Provider shows to users
   - Provider submits `POST /provider/orders/:id/actions`

3. **Verification:**
   - Validate action before accepting
   - Check user hasn't already subscribed
   - Optionally verify via Telegram API
   - Update progress only after verification

4. **Webhooks:**
   - Notify advertisers of progress
   - Notify publishers of new orders
   - Bidirectional communication

5. **Revenue Settlement:**
   - Deduct from advertiser on order creation
   - Credit provider on verified action
   - Track in real-time

---

## Workflow Comparison

| Stage | SubGram | Our System | Status |
|-------|---------|------------|--------|
| Order Creation | `POST /orders` | `POST /traffic/orders` | ✅ Have |
| Moderation | Manual review | Auto or manual? | ❌ Need |
| Order Distribution | `/get-sponsors` (pull) | `GET /provider/orders/available` | ❌ Need |
| Action Submission | Webhook + verification | `POST /provider/orders/:id/actions` | ❌ Need |
| Progress Tracking | `/statistic` | Real-time updates | ⚠️ Partial |
| Webhooks | Bidirectional | Bidirectional | ❌ Need |
| Revenue | Real-time settlement | Balance integration | ❌ Need |

---

## Critical Endpoints We Need

### For Providers (External)

1. `GET /api/v1/provider/orders/available`
   - Get orders matching provider's capabilities
   - Filter by targeting, type, budget
   - Pull model

2. `POST /api/v1/provider/orders/:orderId/actions`
   - Submit completed actions
   - Include user ID, proof, timestamp
   - Verify and update progress

3. `POST /api/v1/provider/webhooks`
   - Register webhook URL
   - Receive new order notifications

4. `GET /api/v1/provider/balance`
   - Check earnings
   - Track completed actions

### For Advertisers (Internal - already have)

1. `POST /traffic/orders` ✅
2. `GET /traffic/orders` ✅
3. `PATCH /traffic/orders/:id` ✅
4. `DELETE /traffic/orders/:id` ✅

---

## Next Steps

### 1. Verify FlyerService API

**Options:**
- Request API documentation directly
- Sign up for API access and test
- Use SubGram model as primary reference

### 2. Build Provider API

**Priority endpoints:**
- `GET /provider/orders/available`
- `POST /provider/orders/:id/actions`

### 3. Implement Verification

**Action validator:**
- Check user eligibility
- Verify completion
- Prevent duplicate submissions
- Update order progress

### 4. Connect Balance

**Critical:**
- Deduct on order creation
- Credit on action completion
- Handle refunds on cancellation

### 5. Add Webhooks

**Event types:**
- `order.created`
- `order.updated`
- `action.completed`
- `order.completed`

---

## Questions to Decide

1. **Moderation:** Auto-approve or manual review?
2. **Verification:** Trust providers or verify via Telegram API?
3. **Distribution:** Pull model (like SubGram) or push model?
4. **Pricing:** Fixed or dynamic pricing per action?
5. **Minimums:** Enforce minimum order sizes?

---

## Summary

**SubGram's Workflow = Proven Model**

**Key Insights:**
1. Separate buy-side and sell-side APIs
2. Pull model for order distribution
3. Verification before crediting
4. Real-time webhooks for updates
5. Balance settlement on every action

**Our Path Forward:**
- Build provider API (pull model)
- Implement action verification
- Connect balance service
- Add webhook system
- Support multiple providers (SubGram, FlyerService, custom)

**Timeline:** 4.5 weeks for MVP (Phases 0-2)
