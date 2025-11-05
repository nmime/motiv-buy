# Traffic Provider Implementation - Quick Schema

## Two Models at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     SubGram Model                            │
│              (Dynamic Pull - Simpler)                        │
└─────────────────────────────────────────────────────────────┘

Provider → GET /orders/available → Get orders now
Provider → POST /orders/:id/actions → Submit completion
System → Verify immediately → Pay immediately

Timeline: 4.5 weeks
Complexity: ⭐⭐ (Low)


┌─────────────────────────────────────────────────────────────┐
│                   FlyerService Model                         │
│            (Task Allocation - Advanced)                      │
└─────────────────────────────────────────────────────────────┘

Provider → POST /tasks/allocate → Get 5-10 tasks (locked 1h)
User → Completes task
Provider → POST /tasks/check → Get status
System → Wait 24h → Verify still active → Pay

Timeline: +2-3 weeks (after SubGram)
Complexity: ⭐⭐⭐⭐ (High)
```

---

## Database Schema

### Common Entities (Already Have)

```typescript
TrafficOrderEntity {
  orderId: string;
  type: 'channel_subscribers' | 'post_views' | 'group_members';
  targetCount: number;
  currentCount: number;
  pricePerAction: string;        // Decimal
  totalBudget: string;
  spentAmount: string;
  status: 'active' | 'paused' | 'completed';
  creator: User;
}

TrafficActionsEntity {
  actionId: string;
  type: 'subscribe' | 'view' | 'join';
  status: 'pending' | 'completed' | 'rejected';
  reward: string;                 // Decimal
  trafficOrder: TrafficOrderEntity;
}
```

---

### SubGram Model - New Entities

#### ProviderApiKeyEntity
```typescript
{
  id: uuid;
  apiKeyHash: string;             // bcrypt
  providerId: string;
  providerName: string;
  permissions: string[];          // ['orders:read', 'actions:submit']
  isActive: boolean;
  createdBy: User;
  lastUsedAt: Date;
}
```

#### ProviderWebhookEntity
```typescript
{
  id: uuid;
  providerId: string;
  url: string;
  events: string[];               // ['order.created', 'action.completed']
  secret: string;                 // For HMAC signature
  isActive: boolean;
}
```

**Total New Tables: 2**

---

### FlyerService Model - Additional Entities

#### TaskAllocationEntity
```typescript
{
  id: uuid;
  taskId: string;                 // Unique signature
  orderId: string;
  userId: number;                 // Telegram user ID
  providerId: string;
  type: TaskType;
  status: TaskStatus;
  reward: string;
  allocatedAt: Date;
  expiresAt: Date;                // allocatedAt + 1 hour
  completedAt?: Date;
  verifiedAt?: Date;
  paidAt?: Date;
}
```

#### TaskVerificationQueueEntity
```typescript
{
  id: uuid;
  taskId: string;
  userId: number;
  resourceId: string;             // Telegram channel/bot ID
  scheduledFor: Date;             // 24 hours after completion
  status: 'scheduled' | 'verified' | 'failed';
  attempts: number;
}
```

**Total New Tables: 4 (SubGram 2 + FlyerService 2)**

---

## API Endpoints

### SubGram Model

```
Base: /api/v1/provider

Auth: Authorization: Bearer <PROVIDER_API_KEY>
```

| Method | Endpoint | Purpose | Request | Response |
|--------|----------|---------|---------|----------|
| GET | `/orders/available` | Get orders to fulfill | Query: type?, status? | `{orders: Order[]}` |
| POST | `/orders/:id/actions` | Submit completed actions | `{actions: Action[]}` | `{accepted: number, rejected: number}` |
| POST | `/webhooks` | Register webhook | `{url, events, secret}` | `{webhookId, isActive}` |
| GET | `/balance` | Get earnings | - | `{balance, totalEarnings, completedActions}` |
| GET | `/filters` | Get targeting options (public) | - | `{genders, ageRanges, countries}` |

**Total: 5 endpoints**

---

### FlyerService Model

```
Base: /api/v1/provider

Auth: Authorization: Bearer <PROVIDER_API_KEY>
```

| Method | Endpoint | Purpose | Request | Response |
|--------|----------|---------|---------|----------|
| POST | `/tasks/allocate` | Allocate tasks to user | `{userId, limit}` | `{tasks: Task[], expiresAt}` |
| POST | `/tasks/check` | Check task status | `{taskId}` | `{status: TaskStatus}` |
| POST | `/tasks/complete` | Mark task complete | `{taskId, proof?}` | `{status, reward}` |
| GET | `/tasks/user/:userId` | Get user's allocated tasks | - | `{tasks: Task[]}` |
| GET | `/tasks/completed` | Get completed tasks history | Query: userId? | `{tasks: CompletedTask[]}` |

**Total: 5 endpoints (+ 5 from SubGram = 10 endpoints if both models)**

---

## Service Structure

### SubGram Model Services

```typescript
libs/feature/traffic-provider/
├── main/
│   ├── service/
│   │   ├── provider.service.ts         // Main service
│   │   ├── order-matching.service.ts   // Match orders to providers
│   │   ├── action-validator.service.ts // Verify actions
│   │   └── webhook.service.ts          // Webhook delivery
│   ├── controller/
│   │   ├── provider-order.controller.ts
│   │   ├── provider-webhook.controller.ts
│   │   └── provider-analytics.controller.ts
│   └── guard/
│       └── provider-api-key.guard.ts   // Auth guard
└── shared/
    ├── dto/
    │   ├── provider-order.dto.ts
    │   ├── provider-action.dto.ts
    │   └── provider-webhook.dto.ts
    └── exception/
        └── provider.exceptions.ts
```

**Core Services: 4**

---

### FlyerService Model Services

```typescript
// Additional services
libs/feature/traffic-provider/main/service/
├── task-allocation.service.ts          // Allocate tasks
├── task-expiration.service.ts          // Handle expired allocations
├── task-verification-queue.service.ts  // 24h verification
└── task-scheduler.service.ts           // Cron jobs for verification
```

**Additional Services: 4**

---

## Implementation Workflows

### SubGram Model Workflow

```
┌─────────────┐
│  Provider   │
└──────┬──────┘
       │
       │ GET /orders/available
       ▼
┌──────────────────────────────┐
│  OrderMatchingService        │
│  - Filter by provider caps   │
│  - Return matching orders    │
└──────┬───────────────────────┘
       │
       ▼
┌─────────────┐
│   Orders    │ [Order, Order, Order]
└──────┬──────┘
       │
       │ Provider shows to users
       │
       ▼
┌─────────────┐
│    User     │ Completes action (subscribes)
└──────┬──────┘
       │
       │ POST /orders/:id/actions
       ▼
┌──────────────────────────────┐
│  ActionValidatorService      │
│  - Verify user eligible      │
│  - Check not duplicate       │
│  - Verify completion         │
└──────┬───────────────────────┘
       │
       ▼ If valid
┌──────────────────────────────┐
│  Update Progress             │
│  - currentCount++            │
│  - Update spentAmount        │
│  - Credit provider balance   │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  WebhookService              │
│  - Send to advertiser        │
│  - Fire action.completed     │
└──────────────────────────────┘
```

**Steps: 6**
**Real-time: Yes**

---

### FlyerService Model Workflow

```
┌─────────────┐
│  Provider   │
└──────┬──────┘
       │
       │ POST /tasks/allocate {userId, limit: 5}
       ▼
┌──────────────────────────────┐
│  TaskAllocationService       │
│  - Find available orders     │
│  - Create 5 task allocations │
│  - Set expiresAt = now + 1h  │
│  - Lock to user              │
└──────┬───────────────────────┘
       │
       ▼
┌─────────────┐
│   Tasks     │ [Task1, Task2, Task3, Task4, Task5]
└──────┬──────┘
       │
       │ Provider shows to user
       │
       ▼
┌─────────────┐
│    User     │ Completes Task1 (subscribes)
└──────┬──────┘
       │
       │ POST /tasks/check {taskId}
       ▼
┌──────────────────────────────┐
│  ActionValidatorService      │
│  - Verify completion         │
│  - Return status             │
└──────┬───────────────────────┘
       │
       ▼ If completed
┌──────────────────────────────┐
│  Update Task Status          │
│  - status = 'waiting'        │
│  - completedAt = now         │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  TaskVerificationQueue       │
│  - Schedule verification     │
│  - scheduledFor = now + 24h  │
└──────┬───────────────────────┘
       │
       │ Wait 24 hours (cron job)
       ▼
┌──────────────────────────────┐
│  TaskSchedulerService        │
│  - Check still subscribed    │
│  - If yes: pay               │
│  - If no: status = 'abort'   │
└──────┬───────────────────────┘
       │
       ▼ If verified
┌──────────────────────────────┐
│  Process Payment             │
│  - status = 'complete'       │
│  - paidAt = now              │
│  - Credit provider           │
│  - Update order progress     │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  WebhookService              │
│  - Send to advertiser        │
└──────────────────────────────┘
```

**Steps: 9**
**Real-time: No (24h delay)**

---

## DTOs Comparison

### SubGram Model DTOs

```typescript
// GET /orders/available
interface GetOrdersResponseDto {
  orders: ProviderOrderDto[];
  pagination: PaginationDto;
}

interface ProviderOrderDto {
  orderId: string;
  type: string;
  target: TargetDto;
  requirements: RequirementsDto;
  pricing: PricingDto;
  status: string;
}

// POST /orders/:id/actions
interface SubmitActionsDto {
  actions: ActionSubmissionDto[];
}

interface ActionSubmissionDto {
  userId: number;
  actionType: string;
  completedAt: string;
  proof?: ProofDto;
}

interface SubmitActionsResponseDto {
  accepted: number;
  rejected: number;
  actions: ActionResultDto[];
  orderProgress: ProgressDto;
}
```

**DTOs: ~8**

---

### FlyerService Model DTOs

```typescript
// POST /tasks/allocate
interface AllocateTasksDto {
  userId: number;
  limit: number;
}

interface AllocateTasksResponseDto {
  tasks: AllocatedTaskDto[];
  expiresAt: string;
}

interface AllocatedTaskDto {
  taskId: string;
  orderId: string;
  type: TaskType;
  target: TargetDto;
  reward: string;
  expiresAt: string;
  status: 'allocated';
}

// POST /tasks/check
interface CheckTaskDto {
  taskId: string;
}

interface CheckTaskResponseDto {
  status: TaskStatus;
  completedAt?: string;
  paidAt?: string;
}

enum TaskStatus {
  Allocated = 'allocated',
  Incomplete = 'incomplete',
  Waiting = 'waiting',
  Complete = 'complete',
  Abort = 'abort',
  Unavailable = 'unavailable',
  Expired = 'expired',
}
```

**DTOs: ~10**

---

## Code Comparison

### SubGram: Submit Action

```typescript
// provider-order.controller.ts
@Post('orders/:orderId/actions')
@UseGuards(ProviderApiKeyGuard)
async submitActions(
  @Param('orderId') orderId: string,
  @Body() dto: SubmitActionsDto,
  @CurrentProvider() provider: Provider,
) {
  const result = await this.actionValidator.validateAndAccept(
    orderId,
    dto.actions,
    provider.id,
  );

  // Immediate payment
  await this.balanceService.creditProvider(
    provider.id,
    result.totalReward,
  );

  // Update progress
  await this.orderService.updateProgress(
    orderId,
    result.acceptedCount,
  );

  // Fire webhook
  await this.webhookService.fireEvent('action.completed', {
    orderId,
    actions: result.accepted,
  });

  return Ok(result);
}
```

**Complexity: Low**

---

### FlyerService: Allocate Tasks

```typescript
// task-allocation.controller.ts
@Post('tasks/allocate')
@UseGuards(ProviderApiKeyGuard)
async allocateTasks(
  @Body() dto: AllocateTasksDto,
  @CurrentProvider() provider: Provider,
) {
  // Find available orders
  const orders = await this.orderMatching.findAvailable(provider.id);

  // Create allocations
  const tasks = await this.taskAllocation.allocate({
    userId: dto.userId,
    providerId: provider.id,
    orders,
    limit: dto.limit,
    expiresIn: 3600, // 1 hour
  });

  // Schedule expiration cleanup
  await this.taskExpiration.scheduleCleanup(tasks, 3600);

  return Ok({
    tasks,
    expiresAt: addHours(new Date(), 1),
  });
}

@Post('tasks/check')
@UseGuards(ProviderApiKeyGuard)
async checkTask(@Body() dto: CheckTaskDto) {
  const task = await this.taskAllocation.findByTaskId(dto.taskId);

  if (!task) {
    return Ok({ status: 'unavailable' });
  }

  if (task.status === 'waiting') {
    // Still in 24h verification period
    return Ok({
      status: 'waiting',
      completedAt: task.completedAt,
    });
  }

  if (task.status === 'complete') {
    return Ok({
      status: 'complete',
      paidAt: task.paidAt,
    });
  }

  // Check if expired
  if (isAfter(new Date(), task.expiresAt)) {
    await this.taskAllocation.markExpired(task.id);
    return Ok({ status: 'expired' });
  }

  return Ok({ status: task.status });
}
```

**Complexity: High**

---

## Cron Jobs

### SubGram Model

**No cron jobs needed** ✅

All processing is real-time.

---

### FlyerService Model

#### Task Expiration Cleanup
```typescript
@Cron('*/15 * * * *') // Every 15 minutes
async cleanupExpiredTasks() {
  const expired = await this.taskAllocation.findExpired();

  for (const task of expired) {
    await this.taskAllocation.markExpired(task.id);
    // Release back to available pool
  }
}
```

#### Task Verification (24h delay)
```typescript
@Cron('*/30 * * * *') // Every 30 minutes
async processVerificationQueue() {
  const pending = await this.verificationQueue.findDue();

  for (const item of pending) {
    const isStillValid = await this.verifyTaskStillActive(
      item.userId,
      item.resourceId,
    );

    if (isStillValid) {
      // Pay provider
      await this.processPayment(item.taskId);
    } else {
      // Mark as aborted
      await this.taskAllocation.markAborted(item.taskId);
    }
  }
}
```

**Cron Jobs: 2**

---

## Testing Strategy

### SubGram Model Tests

```typescript
// Integration test
describe('Provider Order Submission', () => {
  it('should accept valid action and pay immediately', async () => {
    const order = await createTestOrder();
    const action = { userId: 123, actionType: 'subscribe' };

    const result = await request(app)
      .post(`/provider/orders/${order.id}/actions`)
      .set('Authorization', `Bearer ${providerKey}`)
      .send({ actions: [action] });

    expect(result.body.accepted).toBe(1);
    expect(result.body.rejected).toBe(0);

    // Check balance credited immediately
    const balance = await getProviderBalance();
    expect(balance.totalEarnings).toBe('0.50');
  });
});
```

**Test Complexity: Low**

---

### FlyerService Model Tests

```typescript
// Integration test
describe('Task Allocation and Verification', () => {
  it('should allocate tasks and verify after 24h', async () => {
    // Allocate tasks
    const allocated = await request(app)
      .post('/provider/tasks/allocate')
      .set('Authorization', `Bearer ${providerKey}`)
      .send({ userId: 123, limit: 5 });

    expect(allocated.body.tasks).toHaveLength(5);

    // Mark one as complete
    const taskId = allocated.body.tasks[0].taskId;
    await completeTask(taskId);

    // Check status (should be 'waiting')
    let status = await checkTaskStatus(taskId);
    expect(status.status).toBe('waiting');

    // Fast-forward 24 hours (in test)
    await advanceTime(86400);
    await runVerificationCron();

    // Check status (should be 'complete')
    status = await checkTaskStatus(taskId);
    expect(status.status).toBe('complete');

    // Check balance credited after 24h
    const balance = await getProviderBalance();
    expect(balance.totalEarnings).toBe('0.50');
  });

  it('should abort if user unsubscribes', async () => {
    // ... allocate and complete task

    // User unsubscribes before 24h
    await unsubscribeUser(userId, channelId);

    // Fast-forward 24h
    await advanceTime(86400);
    await runVerificationCron();

    // Status should be 'abort'
    const status = await checkTaskStatus(taskId);
    expect(status.status).toBe('abort');

    // No payment
    const balance = await getProviderBalance();
    expect(balance.totalEarnings).toBe('0.00');
  });
});
```

**Test Complexity: High**

---

## Timeline Comparison

### SubGram Model: 4.5 weeks

```
Week 1: Database + API Keys
  ├─ Create provider entities
  ├─ Implement API key auth
  └─ Test auth guard

Week 2: Core Endpoints
  ├─ GET /orders/available
  ├─ POST /orders/:id/actions
  └─ Action validation service

Week 3: Balance Integration
  ├─ Connect balance service
  ├─ Payment processing
  └─ Progress tracking

Week 4: Webhooks
  ├─ Webhook registration
  ├─ Event delivery
  └─ Retry logic

Week 5: Testing + Polish
  ├─ Integration tests
  ├─ E2E tests
  └─ Bug fixes
```

---

### FlyerService Model: +2.5 weeks

```
Week 6: Task Allocation
  ├─ TaskAllocationEntity
  ├─ Allocation service
  └─ Expiration tracking

Week 7: Verification Queue
  ├─ Verification queue entity
  ├─ Scheduler service
  └─ Cron jobs

Week 8: Testing + Integration
  ├─ Complex test scenarios
  ├─ Time-based tests
  └─ Integration with SubGram model
```

---

## Complexity Matrix

| Aspect | SubGram | FlyerService |
|--------|---------|--------------|
| **Database** | ⭐⭐ (2 tables) | ⭐⭐⭐⭐ (4 tables) |
| **Services** | ⭐⭐ (4 services) | ⭐⭐⭐⭐ (8 services) |
| **Endpoints** | ⭐⭐ (5 endpoints) | ⭐⭐⭐⭐ (10 endpoints) |
| **State Management** | ⭐ (Simple) | ⭐⭐⭐⭐⭐ (Complex) |
| **Cron Jobs** | ⭐ (None) | ⭐⭐⭐⭐ (2 jobs) |
| **Testing** | ⭐⭐ (Straightforward) | ⭐⭐⭐⭐⭐ (Time-based) |
| **Fraud Prevention** | ⭐⭐ (Basic) | ⭐⭐⭐⭐⭐ (Advanced) |

---

## Recommendation

### Start with SubGram ✅

**Reasons:**
- 📅 **4.5 weeks** (vs 7 weeks total)
- 🎯 **Simpler** (less state, no cron jobs)
- 💰 **Real-time payment** (better UX)
- ✅ **Proven** (SubGram is successful)

### Then Add FlyerService

**Benefits:**
- 🛡️ Better fraud prevention
- 🎨 Better UX (task allocation)
- 📊 More task types
- 🔒 More granular status

---

## Quick Start Code

### SubGram Model - Minimal Implementation

```typescript
// 1. Create module
nest g module traffic-provider --project=traffic-provider

// 2. Create entities
ProviderApiKeyEntity
ProviderWebhookEntity

// 3. Create services
ProviderService
OrderMatchingService
ActionValidatorService
WebhookService

// 4. Create controller
ProviderOrderController {
  GET /orders/available
  POST /orders/:id/actions
}

// 5. Connect balance
await balanceService.creditProvider(providerId, reward);

// 6. Fire webhook
await webhookService.fire('action.completed', data);
```

**Lines of Code: ~1500**

---

### FlyerService Model - Additional Implementation

```typescript
// 1. Add entities
TaskAllocationEntity
TaskVerificationQueueEntity

// 2. Add services
TaskAllocationService
TaskExpirationService
TaskVerificationQueueService
TaskSchedulerService

// 3. Add controller
TaskController {
  POST /tasks/allocate
  POST /tasks/check
  POST /tasks/complete
}

// 4. Add cron jobs
@Cron('*/15 * * * *')
cleanupExpiredTasks()

@Cron('*/30 * * * *')
processVerificationQueue()
```

**Lines of Code: +1000**

---

## Summary

| | SubGram | FlyerService |
|---|---------|--------------|
| **Model** | Dynamic pull | Task allocation |
| **Complexity** | ⭐⭐ Low | ⭐⭐⭐⭐ High |
| **Timeline** | 4.5 weeks | +2.5 weeks |
| **Tables** | 2 | 4 |
| **Services** | 4 | 8 |
| **Endpoints** | 5 | 10 |
| **Cron Jobs** | 0 | 2 |
| **Real-time** | Yes | No (24h delay) |
| **Fraud Prevention** | Basic | Advanced |
| **Recommended Start** | ✅ Yes | After SubGram |

**Decision: Start with SubGram, add FlyerService features later.**
