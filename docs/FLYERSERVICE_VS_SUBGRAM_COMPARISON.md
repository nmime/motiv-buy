# FlyerService vs SubGram API Comparison

## Overview

Both FlyerService and SubGram are Telegram traffic providers, but they use different approaches for task distribution and completion.

---

## FlyerService API

### Authentication
- **Key-based:** Single key per bot
- Header or body parameter: `key`

### Endpoints

#### 1. GET Bot Info
```typescript
POST /get_me

Request:
{
  key: string;
}

Response:
{
  type: string;           // Key type
  keyNumber: number;      // Bot identifier in service
  botId: number;          // Telegram bot ID
  webhook: string | null; // Webhook URL
  status: boolean;        // Key active status
}
```

#### 2. Check Mandatory Subscription
```typescript
POST /check

Request:
{
  key: string;
  userId: number;
  languageCode?: string;
  message?: {
    rows?: number;              // Buttons per row
    text?: string;              // HTML text
    buttonBot?: string;         // Bot button text
    buttonChannel?: string;     // Channel button text
    buttonBoost?: string;       // Boost button text
    buttonUrl?: string;         // URL button text
    buttonFp?: string;          // FlyerPartners link button
  };
}

Response:
{
  skip: boolean;      // Can user skip mandatory subscriptions?
  error?: string;
  warning?: string;
  info?: string;
}
```

**Usage:** Similar to SubGram's `/get-sponsors` - check if user needs to subscribe before accessing content.

---

#### 3. Get Tasks (Main Endpoint)
```typescript
POST /get_tasks

Request:
{
  key: string;
  userId: number;
  languageCode?: string;
  limit?: number;          // Default: 5, Max: 10
}

Response:
{
  result: Task[] | null;
  error?: string;
}

Task:
{
  signature: string;        // Unique task identifier
  task: TaskType;          // Type of task
  resourceId?: number;     // Telegram resource ID
  price: number;           // Reward in rubles
  link?: string;           // Deprecated
  links: string[];         // Resource links
  photo?: string | null;   // Resource photo URL
  name?: string | null;    // Resource name
  isIosBan?: boolean;      // Banned on iOS
  status: string;          // Task status
}

TaskType:
  | 'start bot'
  | 'subscribe channel'
  | 'give boost'
  | 'follow link'
  | 'perform action'
  | 'view posts'
```

**Key Features:**
- **Tasks allocated for 1 hour** to specific user
- Limit 5-10 tasks per request
- Multiple task types (not just subscriptions)
- Task signature is unique identifier
- Can have multiple links per task

---

#### 4. Check Task Completion
```typescript
POST /check_task

Request:
{
  key: string;
  signature: string;    // Task identifier
}

Response:
{
  result: TaskStatus;
  error?: string;
}

TaskStatus:
  | null              // Task error
  | 'unavailable'     // Resource no longer relevant
  | 'incomplete'      // Task not completed
  | 'abort'           // Completed before but not now (unsubscribed)
  | 'waiting'         // Completed, awaiting payment (24h for channels)
  | 'complete'        // Completed and paid
```

**Payment Flow:**
- Channels: 24-hour waiting period before payment
- Other tasks: Immediate payment on completion
- 'abort' status for unsubscriptions

---

#### 5. Get Completed Tasks
```typescript
POST /get_completed_tasks

Request:
{
  key: string;
  userId: number;
}

Response:
{
  result: {
    completedTasks: CompletedTask[];
    countAllTasks: number;    // Total including pending
  } | null;
  error?: string;
}

CompletedTask:
{
  signature: string;
  task: TaskType;
  price: number;
  status: string;
}
```

---

## SubGram API

### Authentication
- **Three-tier:**
  - Secret Key (full access)
  - API Token (read-only)
  - Bot API Key (per-bot)

### Main Endpoints

#### 1. Get Sponsors (Main Endpoint)
```typescript
POST /get-sponsors

Request:
{
  user_id: number;
  chat_id: number;
  gender?: 'male' | 'female';
  age?: number;
}

Response:
{
  status: 'ok' | 'warning' | 'gender' | 'age' | 'register' | 'error';
  result?: {
    sponsors: [
      {
        link: string;
        title: string;
        status: 'subscribed' | 'unsubscribed' | 'notgetted';
      }
    ];
  };
}
```

**Key Differences:**
- No task allocation (dynamic each time)
- No limit parameter
- Returns subscription status per sponsor
- Can request demographics (gender, age)

---

#### 2. Check Subscriptions
```typescript
POST /get-user-subscriptions

Request:
{
  user_id: number;
}

Response:
{
  status: 'ok';
  result: {
    subscriptions: [
      {
        link: string;
        status: 'subscribed' | 'unsubscribed' | 'notgetted';
        subscribe_date?: string;
      }
    ];
  };
}
```

---

#### 3. Create Order (Advertiser Side)
```typescript
POST /orders

Request:
{
  action: 'create' | 'update' | 'info';
  link: string;
  count: number;
  count_per_day: number;
  price: number;
  targeting?: {
    gender?: string;
    age_from?: number;
    age_to?: number;
    country?: string;
    language?: string;
  };
}

Response:
{
  status: 'ok';
  result: {
    order_id: number;
    status: string;
  };
}
```

---

## Key Differences

| Feature | FlyerService | SubGram |
|---------|--------------|---------|
| **Task Allocation** | Pre-allocated for 1 hour | Dynamic each request |
| **Task Limit** | 5-10 per request | Unlimited |
| **Task Types** | 6 types (bot, channel, boost, link, action, posts) | Mainly subscriptions |
| **Payment Timing** | 24h wait for channels | Real-time |
| **Status Granularity** | 6 states (null, unavailable, incomplete, abort, waiting, complete) | 3 states (subscribed, unsubscribed, notgetted) |
| **User Assignment** | Tasks locked to user for 1h | No locking |
| **Authentication** | Single key | Three-tier (secret, API, bot) |
| **Targeting** | Not visible in API | Demographics-based |
| **Verification** | `check_task` with signature | `get-user-subscriptions` |
| **Mandatory Check** | `/check` | `/get-sponsors` with status |

---

## Workflow Comparison

### FlyerService Workflow

```
1. User interacts with bot
   ↓
2. Bot calls POST /check
   ↓ {key, userId}

3. If skip=false, show mandatory subscriptions
   ↓ User completes them

4. Bot calls POST /get_tasks
   ↓ {key, userId, limit: 5}

5. FlyerService returns 5 tasks
   ↓ Tasks allocated for 1 hour

6. Bot shows tasks to user
   ↓ User picks one

7. User completes task (subscribes/starts bot/etc)
   ↓

8. Bot calls POST /check_task
   ↓ {key, signature}

9. FlyerService verifies completion
   ↓ Result: 'incomplete' | 'waiting' | 'complete'

10. If 'waiting' (channel):
    ↓ Wait 24 hours

11. Payment processed
    ↓ Status becomes 'complete'
```

### SubGram Workflow

```
1. User interacts with bot
   ↓
2. Bot calls POST /get-sponsors
   ↓ {user_id, chat_id, gender?, age?}

3. SubGram returns sponsors dynamically
   ↓ Based on targeting, user demographics

4. Bot shows sponsors
   ↓ User sees subscription requirements

5. User subscribes to channels
   ↓

6. User returns to bot
   ↓ Clicks "I subscribed"

7. Bot calls POST /get-user-subscriptions
   ↓ {user_id}

8. SubGram verifies subscriptions
   ↓ Returns status per sponsor

9. If all subscribed:
   ↓ Grant access

10. Webhook fired
    ↓ POST <webhook_url>

11. Payment processed immediately
```

---

## Task Types Comparison

### FlyerService (6 Types)

1. **'start bot'**
   - User must start a Telegram bot
   - Verification: Check if user sent /start

2. **'subscribe channel'**
   - User must subscribe to channel
   - 24-hour payment delay
   - Can abort if unsubscribes

3. **'give boost'**
   - User must boost channel/group
   - Telegram Premium feature

4. **'follow link'**
   - User must open URL
   - Verification unclear

5. **'perform action'**
   - Custom action
   - Details not specified

6. **'view posts'**
   - User must view channel posts
   - Verification mechanism unclear

### SubGram (Mainly 1 Type)

1. **Channel Subscription**
   - User subscribes to channels/groups
   - Real-time verification
   - Webhook notifications
   - Immediate payment

---

## Payment Models

### FlyerService
- **Channel subscriptions:** 24-hour waiting period
- **Other tasks:** Immediate
- **Price:** Fixed per task in rubles
- **Status tracking:** 'waiting' → 'complete'

### SubGram
- **All actions:** Immediate payment
- **Price:** Per subscriber, configurable
- **Revenue split:** Between platform and publisher
- **Tracking:** Real-time via webhooks

---

## API Design Patterns

### FlyerService
- **POST-only API**
- **Key in request body**
- **Task signatures for tracking**
- **Pre-allocation model**
- **Limited batch size (5-10)**

### SubGram
- **POST for operations, GET for data**
- **Auth header**
- **Multiple auth levels**
- **Dynamic allocation**
- **Unlimited batch**

---

## What This Means for Our System

### 1. Support Both Models

**FlyerService Model (Task Allocation):**
```typescript
GET /api/v1/provider/tasks/allocate
Authorization: Bearer <API_KEY>

Request Query:
?userId=123456789&limit=10

Response:
{
  tasks: [
    {
      taskId: string;          // Our signature
      orderId: string;         // Order this task belongs to
      type: 'subscribe_channel' | 'start_bot' | 'view_post';
      target: {
        telegramId: string;
        username: string;
        link: string;
      };
      reward: string;          // Decimal
      expiresAt: string;       // 1 hour from now
      status: 'allocated';
    }
  ];
  expiresAt: string;           // When allocation expires
}
```

**SubGram Model (Dynamic Fetch):**
```typescript
GET /api/v1/provider/orders/available
Authorization: Bearer <API_KEY>

Response:
{
  orders: [
    {
      orderId: string;
      type: string;
      target: {...};
      requirements: {...};
      pricing: {...};
    }
  ];
  // No allocation, fetch dynamically each time
}
```

### 2. Task Status Management

**Combine both approaches:**

```typescript
enum TaskStatus {
  Allocated = 'allocated',      // FlyerService: assigned to user
  Incomplete = 'incomplete',    // FlyerService: not done
  Waiting = 'waiting',          // FlyerService: done, awaiting payment
  Complete = 'complete',        // Both: done and paid
  Abort = 'abort',              // FlyerService: unsubscribed
  Unavailable = 'unavailable',  // FlyerService: order cancelled
  Expired = 'expired',          // Our: allocation expired
}
```

### 3. Task Types to Support

**Priority 1 (MVP):**
- Channel subscription
- Group join
- Bot start

**Priority 2:**
- Channel boost
- Post view

**Priority 3:**
- Follow link
- Custom action

### 4. Payment Timing

**Options:**

**A) Immediate (SubGram style):**
- Verify and pay instantly
- Simpler implementation
- Risk of unsubscribes

**B) Delayed (FlyerService style):**
- 24-hour waiting period for channels
- Verify subscription still active
- More complex, safer

**Our Recommendation:** Start with immediate, add delayed as optional feature.

---

## Implementation Recommendations

### 1. Unified Provider API

```typescript
// Support both models with different endpoints

// FlyerService-style (allocation)
POST /api/v1/provider/tasks/allocate
POST /api/v1/provider/tasks/check

// SubGram-style (dynamic)
GET /api/v1/provider/orders/available
POST /api/v1/provider/orders/:orderId/actions

// Universal
POST /api/v1/provider/webhooks
GET /api/v1/provider/balance
```

### 2. Task Allocation Table

New entity: `TaskAllocationEntity`

```typescript
{
  id: string;
  taskId: string;           // Unique signature
  orderId: string;
  userId: number;           // Telegram user ID
  providerId: string;
  type: TaskType;
  status: TaskStatus;
  reward: string;           // Decimal
  allocatedAt: Date;
  expiresAt: Date;          // allocatedAt + 1 hour
  completedAt?: Date;
  paidAt?: Date;
}
```

### 3. Flexible Configuration

Let providers choose:
- Allocation model (pre-allocate vs dynamic)
- Payment timing (immediate vs delayed)
- Task types (which types they support)
- Batch size (5-10 for allocation, unlimited for dynamic)

### 4. Verification System

```typescript
interface TaskVerifier {
  // FlyerService-style
  verifyBySignature(signature: string): Promise<TaskStatus>;

  // SubGram-style
  verifyUserSubscriptions(userId: number): Promise<Subscription[]>;

  // Universal
  verifyTaskCompletion(taskId: string, userId: number): Promise<boolean>;
}
```

---

## Updated Implementation Plan

### Phase 0: Core Provider API (3 weeks)

**Week 1:**
- Create task allocation system
- Implement `POST /provider/tasks/allocate`
- Implement `POST /provider/tasks/check`

**Week 2:**
- Implement `GET /provider/orders/available` (SubGram style)
- Implement `POST /provider/orders/:id/actions`

**Week 3:**
- Task verification service
- Balance integration
- Status management

### Phase 1: Webhooks (1 week)
- Same as before

### Phase 2: Execution Engine (1.5 weeks)
- Support both allocation and dynamic models
- Task expiration handling
- Payment timing options

---

## Decision Matrix

| Question | FlyerService | SubGram | Our Choice |
|----------|--------------|---------|------------|
| **Task allocation?** | Yes, 1 hour | No | Support both |
| **Batch limit?** | 5-10 | Unlimited | Configurable |
| **Payment delay?** | 24h for channels | Immediate | Start immediate, add delayed |
| **Task types?** | 6 types | 1 type | Start with 3, expand |
| **Verification?** | Signature-based | User-based | Both methods |
| **Status states?** | 6 states | 3 states | 8 states (combined) |

---

## Next Steps

1. ✅ **Understand both APIs**
2. ⏳ **Decide which model to prioritize**
   - Start with SubGram (simpler)?
   - Or support both from day 1?
3. ⏳ **Update database schema**
   - Add `TaskAllocationEntity`
   - Update `TrafficActionsEntity` for new statuses
4. ⏳ **Build MVP**
   - Implement chosen model first
   - Add second model later

---

## Recommendation

**Start with SubGram model:**
- Simpler (no allocation tracking)
- Immediate payment (less state management)
- Proven for subscriptions
- Can add FlyerService features later

**Then add FlyerService features:**
- Task allocation (better UX)
- Multiple task types
- Delayed payment option
- More status granularity

**Timeline:**
- SubGram model: 2-3 weeks
- FlyerService features: +2 weeks
- **Total MVP:** 4-5 weeks
