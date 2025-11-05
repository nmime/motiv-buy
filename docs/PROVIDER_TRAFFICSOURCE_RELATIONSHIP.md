# Provider ↔ TrafficSource Relationship

## Current Situation

### TrafficSourceEntity (Already Exists)
```typescript
TrafficSourceEntity {
  id: uuid;
  name: string;
  type: 'bot' | 'bot_with_token';
  botToken?: string;
  botUsername?: string;
  telegramId?: string;
  isActive: boolean;
  managedBy?: UserEntity;  // User who owns this bot
  orders: TrafficOrderEntity[];
}
```

**Purpose:** Represents a bot/channel that can deliver traffic

**Currently:** Managed by internal users via web UI

---

## New Concept: Provider

### ProviderApiKeyEntity (New)
```typescript
ProviderApiKeyEntity {
  id: uuid;
  apiKeyHash: string;
  providerId: string;      // 'subgram', 'flyerservice', 'custom_123'
  providerName: string;
  permissions: string[];
  isActive: boolean;
  createdBy: UserEntity;
}
```

**Purpose:** Represents an external API consumer who wants to fulfill traffic orders

**Examples:**
- SubGram (has 1000s of bots)
- FlyerService (has 1000s of bots)
- John Doe (custom integration, has 5 bots)

---

## The Relationship

### Model 1: Provider Owns TrafficSources ⭐ Recommended

**Concept:** Provider registers their bots as TrafficSources in our system

```
Provider (API consumer)
    ↓ has many
TrafficSource (bot in our system)
    ↓ delivers traffic for
TrafficOrder (advertiser's order)
```

**Example:**
```
Provider: SubGram (providerId: 'subgram')
    ├─ TrafficSource: @bot1 (managed via API)
    ├─ TrafficSource: @bot2 (managed via API)
    └─ TrafficSource: @bot3 (managed via API)

Provider: John's Custom Integration (providerId: 'custom_john_123')
    ├─ TrafficSource: @johns_bot (managed via API)
    └─ TrafficSource: @johns_channel (managed via API)

User: Alice (via web UI, no provider)
    ├─ TrafficSource: @alice_bot (managed via UI)
    └─ TrafficSource: @alice_channel (managed via UI)
```

---

## Database Schema Changes

### Option A: Add Provider FK to TrafficSource ⭐ Recommended

**Change:** Add optional provider relationship to TrafficSourceEntity

```typescript
@Entity({ tableName: 'traffic_sources' })
export class TrafficSourceEntity {
  // ... existing fields

  // NEW: Optional provider relationship
  @ManyToOne(() => ProviderApiKeyEntity, { nullable: true })
  provider?: Ref<ProviderApiKeyEntity>;

  // Existing: User who manages via UI
  @ManyToOne(() => UserEntity, { nullable: true })
  managedBy?: Ref<UserEntity>;
}
```

**Migration:**
```sql
ALTER TABLE traffic_sources
ADD COLUMN provider_id UUID NULL
REFERENCES provider_api_key(id) ON DELETE SET NULL;

CREATE INDEX ix__traffic_sources__provider_id ON traffic_sources(provider_id);
```

**Rules:**
- A TrafficSource can be owned by EITHER a User (UI) OR a Provider (API), not both
- If `provider` is set, `managedBy` should be null (managed via API)
- If `managedBy` is set, `provider` should be null (managed via UI)

---

### Option B: Junction Table (More Complex)

**Change:** Many-to-many relationship

```typescript
@Entity({ tableName: 'provider_traffic_sources' })
export class ProviderTrafficSourceEntity {
  @ManyToOne(() => ProviderApiKeyEntity)
  provider!: ProviderApiKeyEntity;

  @ManyToOne(() => TrafficSourceEntity)
  trafficSource!: TrafficSourceEntity;

  @Property()
  registeredAt!: Date;

  @Property({ default: true })
  isActive!: boolean;
}
```

**Use Case:** If a TrafficSource can be shared by multiple providers (unlikely)

---

## API Flow

### Provider Registers Bot

```typescript
POST /api/v1/provider/sources/register
Authorization: Bearer prov_live_abc123...

Request:
{
  "botToken": "123456:ABC-DEF...",
  "name": "My Traffic Bot",
  "description": "Bot for delivering traffic"
}

Response:
{
  "sourceId": "uuid",
  "name": "My Traffic Bot",
  "botUsername": "@my_traffic_bot",
  "telegramId": "123456",
  "isActive": true,
  "providerId": "subgram"
}
```

**What Happens:**
1. Validate bot token with Telegram API
2. Check bot not already registered
3. Create TrafficSourceEntity with `provider = current provider`
4. Return source details

---

### Provider Gets Their Sources

```typescript
GET /api/v1/provider/sources
Authorization: Bearer prov_live_abc123...

Response:
{
  "sources": [
    {
      "sourceId": "uuid-1",
      "name": "My Traffic Bot 1",
      "botUsername": "@bot1",
      "isActive": true
    },
    {
      "sourceId": "uuid-2",
      "name": "My Traffic Bot 2",
      "botUsername": "@bot2",
      "isActive": true
    }
  ]
}
```

**Query:**
```typescript
await trafficSourceRepository.find({
  provider: currentProvider.id,
  isActive: true
});
```

---

## Order Matching Logic

### How Orders Get Assigned to Provider's Sources

**Current Flow:**
```
1. Advertiser creates TrafficOrder
   ↓
2. Order sits in database with status 'active'
   ↓
3. ??? How does it get to providers? ???
```

**New Flow with Providers:**

#### Option 1: Provider Pulls Orders (SubGram Model)

```typescript
GET /api/v1/provider/orders/available
Authorization: Bearer prov_live_abc123...

// System finds orders matching provider's capabilities
// Based on:
// - Provider's registered TrafficSources
// - TrafficSource types (bot, channel)
// - Order requirements (targeting, type)
// - Provider capacity

Response: { orders: [...] }
```

**Logic:**
```typescript
async getAvailableOrders(providerId: string) {
  // 1. Get provider's sources
  const sources = await trafficSourceRepository.find({
    provider: providerId,
    isActive: true
  });

  // 2. Get orders that match source types
  const orders = await trafficOrderRepository.find({
    status: 'active',
    type: { $in: sources.map(s => s.type) },
    currentCount: { $lt: targetCount }
  });

  // 3. Filter by targeting, capacity, etc.
  return filterOrdersByCapability(orders, sources);
}
```

#### Option 2: System Assigns Orders to Providers (Push Model)

```typescript
// When order created, assign to best provider
async function assignOrderToProvider(order: TrafficOrderEntity) {
  // Find providers with matching sources
  const providers = await findProvidersWithCapability(order);

  // Select best provider (load balancing, performance, etc.)
  const selectedProvider = selectBestProvider(providers);

  // Notify provider via webhook
  await webhookService.fire(selectedProvider.id, 'order.created', {
    orderId: order.id,
    ...orderDetails
  });
}
```

---

## Access Control

### Provider Can Only Access Their Own Sources

```typescript
@UseGuards(ProviderApiKeyGuard)
async getSource(
  @CurrentProvider() provider: ProviderAuth,
  @Param('sourceId') sourceId: string
) {
  const source = await trafficSourceRepository.findOne({
    id: sourceId,
    provider: provider.id  // CRITICAL: Filter by provider
  });

  if (!source) {
    throw new NotFoundException('Source not found');
  }

  return Ok(source);
}
```

### User Can Only Access Their Own Sources (UI)

```typescript
@UseGuards(JwtAuthGuard)
async getSource(
  @CurrentUser() user: User,
  @Param('sourceId') sourceId: string
) {
  const source = await trafficSourceRepository.findOne({
    id: sourceId,
    managedBy: user.id  // CRITICAL: Filter by user
  });

  if (!source) {
    throw new NotFoundException('Source not found');
  }

  return Ok(source);
}
```

---

## Updated TrafficSourceEntity

```typescript
import { ProviderApiKeyEntity } from './ProviderApiKey.entity';

@Entity({ tableName: 'traffic_sources' })
export class TrafficSourceEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'varchar', length: 20 })
  @Enum(() => TrafficSourceType)
  type!: TrafficSourceType;

  @Property({ type: 'text', nullable: true })
  botToken?: string;

  @Property({ type: 'varchar', length: 32, nullable: true })
  @Index()
  botUsername?: string;

  @Property({ type: 'bigint', nullable: true })
  @Index()
  telegramId?: string;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  // NEW: Provider relationship (if managed via API)
  @ManyToOne(() => ProviderApiKeyEntity, { nullable: true })
  @Index()
  provider?: Ref<ProviderApiKeyEntity>;

  // Existing: User relationship (if managed via UI)
  @ManyToOne(() => UserEntity, { nullable: true })
  @Index()
  managedBy?: Ref<UserEntity>;

  // Validation: Cannot have both provider and managedBy
  @Property({ persist: false })
  get isApiManaged(): boolean {
    return !!this.provider;
  }

  @Property({ persist: false })
  get isUiManaged(): boolean {
    return !!this.managedBy;
  }

  // ... rest of fields
}
```

---

## Migration Plan

### Step 1: Add Provider Column

```sql
-- Add provider_id column
ALTER TABLE traffic_sources
ADD COLUMN provider_id UUID NULL
REFERENCES provider_api_key(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX ix__traffic_sources__provider_id
ON traffic_sources(provider_id);

-- Add check constraint (optional)
ALTER TABLE traffic_sources
ADD CONSTRAINT chk__traffic_sources__managed_by_xor_provider
CHECK (
  (managed_by_id IS NOT NULL AND provider_id IS NULL) OR
  (managed_by_id IS NULL AND provider_id IS NOT NULL) OR
  (managed_by_id IS NULL AND provider_id IS NULL)
);
```

### Step 2: Update Existing Data

```sql
-- Existing sources managed by users stay as is
-- provider_id will be NULL (managed via UI)

-- New API-registered sources will have provider_id set
-- and managed_by_id will be NULL
```

---

## New Endpoints Needed

### Source Registration (Provider API)

```typescript
POST /api/v1/provider/sources
Authorization: Bearer <PROVIDER_API_KEY>

// Register new bot
Body: {
  botToken: string;
  name: string;
  description?: string;
}

Response: { sourceId, botUsername, telegramId, ... }
```

### List Provider's Sources

```typescript
GET /api/v1/provider/sources
Authorization: Bearer <PROVIDER_API_KEY>

Response: { sources: [...] }
```

### Update Source

```typescript
PATCH /api/v1/provider/sources/:sourceId
Authorization: Bearer <PROVIDER_API_KEY>

Body: { name?, description?, isActive? }
```

### Delete Source

```typescript
DELETE /api/v1/provider/sources/:sourceId
Authorization: Bearer <PROVIDER_API_KEY>
```

---

## Summary

### Relationship

```
ProviderApiKeyEntity (External API consumer)
    ↓ owns (optional)
TrafficSourceEntity (Bot/channel in system)
    ↓ delivers traffic for
TrafficOrderEntity (Advertiser's order)
```

### Key Points

1. **Provider** = External API consumer (SubGram, FlyerService, custom)
2. **TrafficSource** = Bot/channel that delivers traffic
3. **Relationship:** Provider can register and manage TrafficSources via API
4. **Two Paths:**
   - **UI Path:** User creates source via web UI → `managedBy` = User
   - **API Path:** Provider registers source via API → `provider` = Provider
5. **Mutual Exclusion:** A source is EITHER UI-managed OR API-managed, not both

### Database Changes

**Add to TrafficSourceEntity:**
```typescript
@ManyToOne(() => ProviderApiKeyEntity, { nullable: true })
provider?: Ref<ProviderApiKeyEntity>;
```

**Migration:**
```sql
ALTER TABLE traffic_sources
ADD COLUMN provider_id UUID NULL
REFERENCES provider_api_key(id);

CREATE INDEX ix__traffic_sources__provider_id
ON traffic_sources(provider_id);
```

### New API Endpoints

- `POST /provider/sources` - Register bot
- `GET /provider/sources` - List provider's bots
- `PATCH /provider/sources/:id` - Update bot
- `DELETE /provider/sources/:id` - Delete bot

**Total New Endpoints: 4** (in addition to the 5 we already planned)

---

## Implementation Order

1. ✅ Create ProviderApiKeyEntity (already planned)
2. ✅ Create provider auth system (already planned)
3. ⏳ Add `provider` field to TrafficSourceEntity
4. ⏳ Create migration
5. ⏳ Add source registration endpoints
6. ⏳ Update order matching logic to consider provider's sources
7. ⏳ Add access control checks

**This clarifies how providers fit into the existing system!**
