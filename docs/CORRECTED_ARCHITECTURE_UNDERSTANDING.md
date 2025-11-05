# CORRECTED: Your Existing Architecture

## I Was Wrong! Here's What You Actually Have

### Your Current Entities

```
TrafficSource (Bot) → SELLS traffic
    ↓ belongs to
TrafficUser (Telegram users in bot)
    ↓ performs actions for
TrafficOrder
    ↓ points to
TrafficTarget (Channel/Group) → BUYS traffic
```

---

## The Real Model

### TrafficSource = Traffic SELLER (Bot Owner)
```typescript
TrafficSourceEntity {
  id: uuid;
  name: string;
  type: 'bot' | 'bot_with_token';
  botToken: string;
  botUsername: string;
  telegramId: string;
  managedBy: UserEntity;  // Bot owner (seller)

  trafficUsers: TrafficUserEntity[];  // Users in this bot
  orders: TrafficOrderEntity[];        // Orders this bot fulfills
}
```

**Example:** @johns_bot (owned by John, has 1000 users who do tasks)

---

### TrafficTarget = Traffic BUYER (Channel/Group Owner)
```typescript
TrafficTargetEntity {
  id: uuid;
  name: string;
  type: 'channel' | 'group' | 'bot';
  telegramId: string;
  username: string;
  pricePerMember: string;
  managedBy: UserEntity;  // Channel owner (buyer)

  orders: TrafficOrderEntity[];  // Orders for this target
}
```

**Example:** @alice_channel (owned by Alice, needs subscribers)

---

### TrafficUser = Individual User in Bot
```typescript
TrafficUserEntity {
  id: uuid;
  telegramId: string;
  username: string;
  firstName: string;
  totalEarnings: string;
  trafficSource: TrafficSourceEntity;  // Which bot they're in

  assignedOrders: TrafficOrderEntity[];  // Orders assigned to them
}
```

**Example:** John (telegramId: 123456) who is in @johns_bot

---

### TrafficOrder = Connection Between Seller and Buyer
```typescript
TrafficOrderEntity {
  orderId: string;
  type: 'join' | 'subscribe' | 'view' | 'react';
  status: 'pending' | 'active' | 'completed';

  targetCount: number;        // How many needed
  currentCount: number;       // How many done
  pricePerAction: string;

  creator: UserEntity;        // Who created order (buyer)
  trafficSource: TrafficSourceEntity;  // Bot that delivers traffic
  trafficTarget: TrafficTargetEntity;  // Channel that receives traffic
  assignedTrafficUser?: TrafficUserEntity;  // Specific user assigned
}
```

---

## How It Actually Works

### Scenario: Alice Needs Subscribers

```
1. Alice owns @alice_channel (TrafficTarget)
   ↓
2. Alice creates TrafficOrder:
   - trafficTarget: @alice_channel
   - trafficSource: @johns_bot
   - targetCount: 1000
   - pricePerAction: 0.50
   ↓
3. John's bot (@johns_bot - TrafficSource) shows task to its users
   ↓
4. TrafficUsers in @johns_bot see: "Subscribe to @alice_channel, earn $0.50"
   ↓
5. Users subscribe
   ↓
6. TrafficActions records each subscription
   ↓
7. Order.currentCount increments
   ↓
8. When currentCount === targetCount → Order completed
```

---

## So What is a Provider?

### Provider = External API Consumer (like SubGram or FlyerService)

**Provider OWNS multiple TrafficSources (bots)**

```
Provider: SubGram
    ↓ owns
TrafficSource: @subgram_bot_1 (has 5000 TrafficUsers)
TrafficSource: @subgram_bot_2 (has 3000 TrafficUsers)
TrafficSource: @subgram_bot_3 (has 10000 TrafficUsers)
    ↓ fulfill
TrafficOrders
    ↓ point to
TrafficTargets (channels needing subscribers)
```

---

## Updated Relationship

```
┌──────────────────────────────────────┐
│  Provider (SubGram - External API)   │
│  - API Key: prov_live_abc123         │
│  - Manages via REST API              │
└────────────┬─────────────────────────┘
             │ owns
             ▼
┌──────────────────────────────────────┐
│  TrafficSource (@subgram_bot_1)      │
│  - Bot that SELLS traffic            │
│  - Owned by Provider (via API)       │
│    OR User (via UI)                  │
└────────────┬─────────────────────────┘
             │ has
             ▼
┌──────────────────────────────────────┐
│  TrafficUser (Individual users)      │
│  - Telegram users in bot             │
│  - Perform actions for orders        │
└────────────┬─────────────────────────┘
             │ perform actions for
             ▼
┌──────────────────────────────────────┐
│  TrafficOrder                        │
│  - Connects Source and Target        │
│  - Created by Target owner (buyer)   │
└────────────┬─────────────────────────┘
             │ points to
             ▼
┌──────────────────────────────────────┐
│  TrafficTarget (@alice_channel)      │
│  - Channel/Group that BUYS traffic   │
│  - Owned by User (via UI)            │
└──────────────────────────────────────┘
```

---

## Database Changes Needed

### Add Provider FK to TrafficSource

```typescript
@Entity({ tableName: 'traffic_sources' })
export class TrafficSourceEntity {
  // ... existing fields

  // NEW: Optional provider (if managed via API)
  @ManyToOne(() => ProviderApiKeyEntity, { nullable: true })
  provider?: Ref<ProviderApiKeyEntity>;

  // Existing: User (if managed via UI)
  @ManyToOne(() => UserEntity, { nullable: true })
  managedBy?: Ref<UserEntity>;

  // Rule: EITHER provider OR managedBy, not both
}
```

**Migration:**
```sql
ALTER TABLE traffic_sources
ADD COLUMN provider_id UUID NULL
REFERENCES provider_api_key(id);

CREATE INDEX ix__traffic_sources__provider_id
ON traffic_sources(provider_id);
```

---

## How Provider API Works with Your Entities

### 1. Provider Registers Bot (TrafficSource)

```typescript
POST /api/v1/provider/sources
Authorization: Bearer prov_live_subgram_abc123

Body: {
  "botToken": "123456:ABC-DEF...",
  "name": "SubGram Bot #1"
}

→ Creates TrafficSourceEntity
→ Sets provider = SubGram
→ managedBy = null (not UI-managed)
```

### 2. Provider Gets Available Orders

```typescript
GET /api/v1/provider/orders/available

// Returns orders where:
// - trafficSource in (provider's sources)
// - status = 'active'
// - currentCount < targetCount

Response: {
  "orders": [
    {
      "orderId": "ORD-123",
      "trafficSource": {
        "id": "uuid",
        "botUsername": "@subgram_bot_1"
      },
      "trafficTarget": {
        "id": "uuid",
        "username": "@alice_channel",
        "type": "channel"
      },
      "targetCount": 1000,
      "currentCount": 250,
      "pricePerAction": "0.50"
    }
  ]
}
```

### 3. Provider's Bot Shows Task to Users

```
SubGram's @subgram_bot_1:
  ↓ shows to
TrafficUsers in that bot:
  "Subscribe to @alice_channel, earn $0.50"
```

### 4. Provider Submits Completed Actions

```typescript
POST /api/v1/provider/orders/ORD-123/actions

Body: {
  "actions": [
    {
      "userId": 123456789,  // Telegram user ID
      "actionType": "subscribe",
      "completedAt": "2025-11-05T10:00:00Z"
    }
  ]
}

→ Creates TrafficActionsEntity
→ Updates order.currentCount++
→ Credits provider's balance
```

---

## Two Paths to Manage TrafficSources

### Path 1: UI (Existing)
```
User (John) logs in via web
    ↓
Creates TrafficSource (@johns_bot)
    ↓
TrafficSource.managedBy = John
TrafficSource.provider = null
```

### Path 2: API (New)
```
Provider (SubGram) authenticates with API key
    ↓
POST /provider/sources {botToken}
    ↓
TrafficSource.provider = SubGram
TrafficSource.managedBy = null
```

---

## What Changes?

### Database
- Add `provider_id` to `traffic_sources` table
- Add `ProviderApiKeyEntity` table
- Add `ProviderWebhookEntity` table

### API Endpoints (New)
1. `POST /provider/sources` - Register bot
2. `GET /provider/orders/available` - Get orders for provider's bots
3. `POST /provider/orders/:id/actions` - Submit completed actions
4. `POST /provider/webhooks` - Register webhook
5. `GET /provider/balance` - Get provider earnings

### Logic Changes
- Order matching: Filter by provider's sources
- Access control: Provider can only access their sources
- Balance: Credit provider on action completion

---

## What Stays the Same?

### Everything for End Users (UI)
- Users still create TrafficTargets (channels needing traffic)
- Users still create TrafficOrders
- Existing UI functionality unchanged

### Internal System
- TrafficUser entity unchanged
- TrafficOrder entity mostly unchanged (just better utilized)
- TrafficActions entity unchanged
- All existing repositories work as-is

---

## Summary

**I was completely wrong before!** You already have:

✅ **TrafficSource** = Bot that SELLS traffic (not just any source)
✅ **TrafficTarget** = Channel that BUYS traffic
✅ **TrafficOrder** = Connection between them
✅ **TrafficUser** = Individual users in bots who do tasks

**What's NEW:**
- **Provider** = External API consumer who owns multiple TrafficSources
- Provider can register/manage TrafficSources via API
- Provider can fetch orders and submit completions via API

**What CHANGES:**
- Add `provider_id` to TrafficSource
- Add provider API endpoints
- Connect existing entities via API

**Your architecture was already correct!** We just need to:
1. Add Provider entity
2. Link Provider to TrafficSource
3. Build Provider API to interact with existing entities

This makes WAY more sense now!
