# Traffic & Balance System Architecture

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER & BALANCE SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐
                            │   UserEntity │
                            │──────────────│
                            │ id           │
                            │ telegramId   │
                            │ username     │
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
         ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
         │ UserBalance     │ │UserBalanceHistory│ │ TrafficSource    │
         │─────────────────│ │─────────────────│ │──────────────────│
         │ balance         │ │ type            │ │ managedBy (User) │
         │ lockedBalance   │ │ amount          │ │ botToken/apiKey  │
         │ currency        │ │ balanceBefore   │ │ isActive         │
         └─────────────────┘ │ balanceAfter    │ └──────────────────┘
                             │ referenceId     │
                             └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRAFFIC ORDER SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────┐              ┌────────────────┐
    │ TrafficSource  │              │ TrafficTarget  │
    │────────────────│              │────────────────│
    │ (Bot Owner)    │              │ (Channel Owner)│
    │ SELLS traffic  │              │ BUYS traffic   │
    └────────┬───────┘              └────────┬───────┘
             │                               │
             │         ┌────────────────┐    │
             └────────▶│ TrafficOrder   │◀───┘
                       │────────────────│
                       │ orderId        │
                       │ type           │
                       │ status         │
                       │ targetCount    │
                       │ currentCount   │
                       │ pricePerAction │
                       │ totalBudget    │
                       │ spentAmount    │
                       │ creator (User) │
                       └────────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
         │TrafficActions│ │ TrafficUser  │ │TrafficOrderBalance│
         │──────────────│ │──────────────│ │──────────────────│
         │ actionId     │ │ telegramId   │ │ lockedAmount     │
         │ type         │ │ username     │ │ spentAmount      │
         │ status       │ │ totalEarnings│ │ availableAmount  │
         │ reward       │ │ trafficSource│ │ refundedAmount   │
         │ completedAt  │ └──────────────┘ │ isSettled        │
         └──────────────┘                  └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                            ACTOR DIAGRAM                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐                                      ┌─────────────┐
    │   BUYER     │                                      │   SELLER    │
    │ (Channel    │                                      │ (Bot Owner) │
    │  Owner)     │                                      │             │
    │             │                                      │             │
    │ Has:        │                                      │ Has:        │
    │ - UserEntity│                                      │ - UserEntity│
    │ - UserBalance│                                     │ - UserBalance│
    │ - TrafficTarget                                    │ - TrafficSource│
    └──────┬──────┘                                      └──────┬──────┘
           │                                                    │
           │ creates                                 manages    │
           ▼                                                    ▼
    ┌─────────────┐                                      ┌─────────────┐
    │TrafficOrder │◀─────────── connects ──────────────▶│TrafficSource│
    └─────────────┘                                      └──────┬──────┘
           │                                                    │
           │ has                                         has    │
           ▼                                                    ▼
    ┌─────────────────┐                               ┌────────────────┐
    │TrafficOrderBalance                              │ TrafficUser    │
    │ (Locked Funds)  │                               │ (Bot Subscribers)
    └─────────────────┘                               └────────────────┘
           │                                                    │
           └────────── pays for completed tasks ───────────────┘
                       (TrafficActions)


## GUARANTEED PAYMENT FLOW - MONEY MOVEMENT

### Stage 1: Order Creation (Lock Funds)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                        STAGE 1: LOCK FUNDS                               │
└──────────────────────────────────────────────────────────────────────────┘

    BUYER (Channel Owner)
    │
    │ UserBalance: 1000 STARS
    │
    │ ┌─────────────────────────────┐
    │ │ Creates TrafficOrder        │
    │ │ - targetCount: 100          │
    │ │ - pricePerAction: 5 STARS   │
    │ │ - totalBudget: 500 STARS    │
    │ └─────────────────────────────┘
    │
    │ STEP 1: Deduct from UserBalance
    ▼
    UserBalance
    ┌────────────────────────────┐
    │ balance: 1000 → 500 STARS  │ ❌ DEDUCT
    │ lockedBalance: 0 STARS     │
    └────────────────────────────┘
    │
    │ STEP 2: Lock in TrafficOrderBalance
    ▼
    TrafficOrderBalance (NEW)
    ┌─────────────────────────────┐
    │ lockedAmount: 500 STARS     │ ✅ LOCK
    │ availableAmount: 500 STARS  │
    │ spentAmount: 0 STARS        │
    │ refundedAmount: 0 STARS     │
    │ isSettled: false            │
    └─────────────────────────────┘
    │
    │ STEP 3: Record transaction
    ▼
    UserBalanceHistory
    ┌──────────────────────────────────┐
    │ type: Withdrawal               │
    │ amount: -500 STARS               │
    │ balanceBefore: 1000 STARS        │
    │ balanceAfter: 500 STARS          │
    │ referenceId: ORDER-123           │
    │ description: "Order funds lock"  │
    └──────────────────────────────────┘

RESULT:
✅ Buyer has 500 STARS remaining (free to use)
✅ Order has 500 STARS locked (guaranteed payment)
✅ Seller will get paid from locked funds
```

### Stage 2: Task Completion (Pay from Locked Funds)
```
┌──────────────────────────────────────────────────────────────────────────┐
│              STAGE 2: TASK COMPLETION (Pay Seller)                       │
└──────────────────────────────────────────────────────────────────────────┘

    BOT USER (in seller's bot)
    │
    │ ┌────────────────────────────┐
    │ │ Completes task:            │
    │ │ - Subscribes to channel    │
    │ │ - Sends proof              │
    │ └────────────────────────────┘
    │
    │ STEP 1: Validate task completion
    ▼
    POST /source/tasks/complete
    {
      "apiKey": "seller-api-key",
      "taskId": "ORDER-123-USER-456",
      "userId": 456,
      "proof": "screenshot.jpg"
    }
    │
    │ STEP 2: Lock reserve (pessimistic)
    ▼
    em.lock(reserve, 'pessimistic_write')  🔒
    │
    │ STEP 3: Validate funds
    ▼
    TrafficOrderBalance
    ┌─────────────────────────────┐
    │ lockedAmount: 500 STARS     │
    │ availableAmount: 500 STARS  │ ✅ CHECK >= 5 STARS
    │ spentAmount: 0 STARS        │
    └─────────────────────────────┘
    │
    │ STEP 4: Deduct from locked balance
    ▼
    TrafficOrderBalance
    ┌─────────────────────────────┐
    │ availableAmount: 500 → 495  │ ❌ DEDUCT
    │ spentAmount: 0 → 5 STARS    │ ✅ INCREMENT
    └─────────────────────────────┘
    │
    │ STEP 5: Credit seller
    ▼
    SELLER UserBalance
    ┌────────────────────────────┐
    │ balance: 0 → 5 STARS       │ ✅ CREDIT
    └────────────────────────────┘
    │
    │ STEP 6: Record transactions
    ▼
    UserBalanceHistory (Seller)
    ┌──────────────────────────────────────┐
    │ type: Reward                         │
    │ amount: +5 STARS                     │
    │ balanceBefore: 0 STARS               │
    │ balanceAfter: 5 STARS                │
    │ referenceId: ORDER-123               │
    │ description: "Traffic order payment" │
    └──────────────────────────────────────┘
    │
    │ STEP 7: Update order progress
    ▼
    TrafficOrder
    ┌────────────────────────────┐
    │ currentCount: 0 → 1        │
    │ spentAmount: 0 → 5 STARS   │
    │ status: Active             │
    └────────────────────────────┘
    │
    │ STEP 8: Track user earnings
    ▼
    TrafficUser
    ┌─────────────────────────────────┐
    │ totalEarnings: 0 → 5 STARS      │
    │ totalOrdersParticipated: 0 → 1  │
    └─────────────────────────────────┘

RESULT AFTER 100 COMPLETED TASKS:
✅ Seller earned: 500 STARS (100 tasks × 5 STARS)
✅ Locked balance depleted: 0 STARS remaining
✅ Order completed: 100/100 tasks
✅ All transactions audited in UserBalanceHistory
```

### Stage 3: Order Settlement (Refund Remaining)
```
┌──────────────────────────────────────────────────────────────────────────┐
│           STAGE 3: ORDER SETTLEMENT (Refund or Complete)                 │
└──────────────────────────────────────────────────────────────────────────┘

SCENARIO A: Order Completed (All Tasks Done)
────────────────────────────────────────────

    TrafficOrder
    │ currentCount: 100
    │ targetCount: 100
    │ status: Completed ✅
    │
    ▼
    TrafficOrderBalance
    ┌─────────────────────────────┐
    │ lockedAmount: 500 STARS     │
    │ spentAmount: 500 STARS      │
    │ availableAmount: 0 STARS    │ ✅ All spent
    │ refundedAmount: 0 STARS     │
    │ isSettled: false → true     │
    └─────────────────────────────┘

    NO REFUND NEEDED
    ✅ All funds were used
    ✅ Mark as settled


SCENARIO B: Order Cancelled (Partial Completion)
──────────────────────────────────────────────────

    TrafficOrder
    │ currentCount: 50
    │ targetCount: 100
    │ status: Cancelled ❌
    │
    ▼
    TrafficOrderBalance
    ┌─────────────────────────────┐
    │ lockedAmount: 500 STARS     │
    │ spentAmount: 250 STARS      │ (50 × 5)
    │ availableAmount: 250 STARS  │ ⚠️ REMAINING
    │ refundedAmount: 0 STARS     │
    │ isSettled: false            │
    └─────────────────────────────┘
    │
    │ STEP 1: Calculate refund
    │ refundAmount = availableAmount = 250 STARS
    │
    │ STEP 2: Update reserve
    ▼
    TrafficOrderBalance
    ┌─────────────────────────────┐
    │ availableAmount: 250 → 0    │ ❌ CLEAR
    │ refundedAmount: 0 → 250     │ ✅ RECORD
    │ isSettled: false → true     │
    │ settledAt: 2024-01-15       │
    └─────────────────────────────┘
    │
    │ STEP 3: Credit buyer
    ▼
    BUYER UserBalance
    ┌────────────────────────────┐
    │ balance: 500 → 750 STARS   │ ✅ REFUND
    └────────────────────────────┘
    │
    │ STEP 4: Record refund
    ▼
    UserBalanceHistory (Buyer)
    ┌──────────────────────────────────────┐
    │ type: Deposit                        │
    │ amount: +250 STARS                   │
    │ balanceBefore: 500 STARS             │
    │ balanceAfter: 750 STARS              │
    │ referenceId: ORDER-123               │
    │ description: "Order refund"          │
    └──────────────────────────────────────┘

RESULT:
✅ Buyer got 250 STARS back (unused funds)
✅ Seller received 250 STARS (50 completed tasks)
✅ Order settled and closed
✅ No funds lost or stuck
```


## Balance Fields Explained

### UserBalance
| Field | Description | Example |
|-------|-------------|---------|
| `balance` | Available balance (free to use/withdraw) | 500 STARS |
| `lockedBalance` | Currently locked in UserBalance (not related to orders) | 0 STARS |
| `currency` | Currency type (STARS, TON, USDT, etc.) | CurrencyCode.STARS |

### TrafficOrderBalance
| Field | Description | When Updated |
|-------|-------------|--------------|
| `lockedAmount` | Total budget locked for order | Order creation (never changes) |
| `spentAmount` | Total paid to sellers for completed tasks | After each task completion |
| `availableAmount` | Remaining funds for future tasks | After each task completion |
| `refundedAmount` | Amount returned to buyer | Order cancellation/completion |
| `isSettled` | Whether all funds distributed or refunded | Order settlement |

**Formula:**
```
lockedAmount = spentAmount + availableAmount + refundedAmount
```

**Example:**
- Order created: `lockedAmount = 500`, `availableAmount = 500`, `spentAmount = 0`
- After 50 tasks: `spentAmount = 250`, `availableAmount = 250`
- After cancel: `refundedAmount = 250`, `availableAmount = 0`, `isSettled = true`
- Check: `500 = 250 + 0 + 250` ✅


## Technical Guarantees

### 🔒 Concurrency Safety
```typescript
// Pessimistic locking prevents race conditions
await this.em.lock(reserve, 'pessimistic_write');

// Multiple users completing tasks simultaneously → All handled atomically
// No double-spending or balance corruption possible
```

### 🔄 Atomicity
```typescript
await this.em.transactional(async () => {
  // All operations succeed or all fail
  await this.deductFromLocked(reserve);
  await this.creditBalance(seller);
  await this.updateOrder(order);
  // If ANY step fails, ALL rolled back
});
```

### ✅ Balance Validation
```typescript
if (reserve.availableAmount < reward) {
  throw new BadRequestException('Insufficient locked balance');
}
// Order cannot pay more than locked funds
```

### 📊 Audit Trail
```typescript
// Every transaction logged
UserBalanceHistory {
  type: TransactionType.Reward,
  amount: '+5 STARS',
  balanceBefore: '0',
  balanceAfter: '5',
  referenceId: 'ORDER-123',  // Links to TrafficOrder
  timestamp: '2024-01-15T10:30:00Z'
}
```

### 🔁 Idempotency
```typescript
// Duplicate task completion prevented
const existingAction = await this.findOne({
  trafficOrder: order.id,
  userId: dto.userId
});

if (existingAction?.status === 'completed') {
  return { success: false, error: 'Already completed' };
}
```


## API Flow (Real Implementation)

### Complete Task Request
```http
POST /source/tasks/complete
Content-Type: application/json

{
  "apiKey": "sk_live_abc123...",
  "taskId": "ORDER-123-USER-456",
  "userId": 456,
  "username": "john_doe",
  "proof": "https://t.me/channel/123",
  "completedAt": "2024-01-15T10:30:00Z"
}
```

### Response
```json
{
  "success": true,
  "actionId": "ACT-1705318200000-456",
  "status": "verified",
  "reward": 5.0,
  "totalEarnings": 50.0
}
```

### What Happens Internally
1. ✅ Validate API key → Find TrafficSource
2. ✅ Parse taskId → Get orderId + userId
3. ✅ Find TrafficOrder → Check status (active)
4. ✅ Check duplicate → Prevent double completion
5. ✅ **Lock reserve** → `em.lock(reserve, 'pessimistic_write')`
6. ✅ **Validate funds** → `reserve.availableAmount >= reward`
7. ✅ **Deduct locked** → `reserve.availableAmount -= reward`
8. ✅ **Credit seller** → `seller.balance += reward`
9. ✅ **Log transactions** → UserBalanceHistory records
10. ✅ **Update order** → `order.currentCount++`
11. ✅ **Track user** → `trafficUser.totalEarnings += reward`
12. ✅ **Commit transaction** → All or nothing


## Database Tables Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Platform users (buyers, sellers) | id, telegramId, username |
| `user_balances` | User's available balances | user_id, currency_id, balance |
| `user_balance_history` | Transaction audit log | type, amount, balanceBefore, balanceAfter |
| `traffic_sources` | Bot owners selling traffic | managedBy, botToken, isActive |
| `traffic_targets` | Channels buying traffic | targetUrl, name, username |
| `traffic_orders` | Orders connecting buyer↔seller | orderId, totalBudget, status |
| `traffic_order_balances` | 🔒 **Locked funds for orders** | lockedAmount, spentAmount, availableAmount |
| `traffic_actions` | Completed tasks | actionId, reward, status |
| `traffic_users` | Bot subscribers (task doers) | telegramId, totalEarnings |


## State Machine

### TrafficOrder Status Flow
```
Pending → Active → InProgress → Completed
                                    ↓
Pending → Active → InProgress → Cancelled
                                    ↓
                                 Failed
```

### TrafficOrderBalance Settlement
```
Created (isSettled: false)
    ↓
Tasks Completed (spentAmount increases)
    ↓
Order Done/Cancelled
    ↓
Settlement (refund remaining if any)
    ↓
Settled (isSettled: true)
```


## Security Considerations

✅ **API Key Authentication** - Only valid sources can submit completions
✅ **Pessimistic Locking** - Prevents concurrent modification conflicts
✅ **Balance Validation** - Cannot overspend locked funds
✅ **Transaction Atomicity** - All-or-nothing updates
✅ **Audit Logging** - Every balance change recorded
✅ **Idempotency** - Duplicate submissions rejected
✅ **State Validation** - Orders must be active to accept completions
✅ **Telegram Validation** - Bot tokens verified with real Telegram API (via BotFactoryService)


## Next Implementation Steps

1. ⏳ **Order Creation** - Implement `lockFunds()` when TrafficOrder created
2. ⏳ **Order Settlement** - Implement `settleBalance()` when order completes/cancels
3. ⏳ **Scheduled Jobs** - Auto-settle old orders, cleanup unsettled balances
4. ⏳ **Admin Dashboard** - Monitor locked balances, unsettled orders
5. ⏳ **API Key Management** - Add dedicated `apiKey` field to TrafficSource
6. ⏳ **Database Migration** - Create `traffic_order_balances` table
