# Traffic Source API - Connect Bots to Platform

## What We're Actually Building

**NOT:** API for SubGram/FlyerService to integrate with us
**YES:** API for bot owners (TrafficSources) to connect their bots to our platform

**We ARE SubGram!** We're the marketplace platform.

---

## The Real Flow

### Scenario: John Has a Bot

```
1. John owns @johns_bot (has 1000 users)
   ↓
2. John registers his bot with OUR platform via API
   ↓
3. Alice creates order: "Need 1000 subscribers for @alice_channel"
   ↓
4. John's bot calls OUR API: "What orders are available?"
   ↓
5. OUR API returns: "Subscribe to @alice_channel, earn $0.50"
   ↓
6. John's bot shows this to his users
   ↓
7. Users subscribe
   ↓
8. John's bot calls OUR API: "User 123 subscribed"
   ↓
9. WE verify and pay John
```

---

## API for Bot Owners (TrafficSources)

### Base: `/api/v1/source`

**Auth:** Bot Token (existing `BotTokenValidationService`)

---

### 1. Get Available Orders (Like SubGram's `/get-sponsors`)

```typescript
POST /api/v1/source/orders/available
Authorization: Bot <BOT_TOKEN>

Request:
{
  "userId": 123456789,           // Telegram user ID
  "chatId": 123456789,
  "languageCode"?: "en",
  "gender"?: "male",
  "age"?: 25
}

Response:
{
  "orders": [
    {
      "orderId": "ORD-123",
      "action": "subscribe",       // subscribe, join, view
      "target": {
        "type": "channel",
        "username": "@alice_channel",
        "link": "https://t.me/alice_channel",
        "name": "Alice's Channel"
      },
      "reward": "0.50",            // What user earns
      "requirements": {
        "minAge"?: 18,
        "gender"?: "male",
        "countries"?: ["US", "UK"]
      }
    },
    {
      "orderId": "ORD-456",
      "action": "join",
      "target": {
        "type": "group",
        "username": "@bob_group",
        "link": "https://t.me/bob_group"
      },
      "reward": "0.30"
    }
  ]
}
```

**Logic:**
```typescript
async getAvailableOrders(botToken: string, userId: number) {
  // 1. Validate bot token
  const source = await validateBotToken(botToken);

  // 2. Find active orders for this source
  const orders = await trafficOrderRepository.find({
    trafficSource: source.id,
    status: 'active',
    currentCount: { $lt: targetCount }
  });

  // 3. Check if user already completed
  const completedOrderIds = await getCompletedOrders(userId);

  // 4. Filter out completed
  const available = orders.filter(o => !completedOrderIds.includes(o.id));

  // 5. Map to DTO
  return available.map(mapToOrderDto);
}
```

---

### 2. Check User Subscription Status (Like SubGram's `/get-user-subscriptions`)

```typescript
POST /api/v1/source/orders/check
Authorization: Bot <BOT_TOKEN>

Request:
{
  "userId": 123456789,
  "orderId": "ORD-123"
}

Response:
{
  "status": "subscribed" | "not_subscribed" | "pending" | "verified",
  "canProceed": true | false,
  "message"?: "Please subscribe to continue"
}
```

---

### 3. Submit Completed Action (New - Report Completion)

```typescript
POST /api/v1/source/orders/:orderId/complete
Authorization: Bot <BOT_TOKEN>

Request:
{
  "userId": 123456789,
  "username"?: "john_doe",
  "actionType": "subscribe",
  "completedAt": "2025-11-05T10:00:00Z",
  "proof"?: {
    "screenshotUrl"?: "https://..."
  }
}

Response:
{
  "success": true,
  "actionId": "ACT-789",
  "status": "verified" | "pending",
  "reward": "0.50",
  "userEarnings": "15.50"    // Total user earnings
}
```

**Logic:**
```typescript
async submitCompletion(botToken: string, orderId: string, dto: CompleteActionDto) {
  // 1. Validate bot owns this order
  const order = await validateBotOrderAccess(botToken, orderId);

  // 2. Check user hasn't already completed
  const exists = await trafficActionsRepository.findOne({
    trafficOrder: orderId,
    userId: dto.userId
  });

  if (exists) {
    throw new DuplicateActionException();
  }

  // 3. Verify action (optional: check via Telegram API)
  const verified = await verifySubscription(dto.userId, order.trafficTarget);

  // 4. Create action record
  const action = await trafficActionsRepository.create({
    trafficOrder: order,
    userId: dto.userId,
    type: dto.actionType,
    status: verified ? 'completed' : 'pending',
    reward: order.pricePerAction
  });

  // 5. Update order progress
  await trafficOrderRepository.nativeUpdate(
    { id: orderId },
    {
      currentCount: order.currentCount + 1,
      spentAmount: add(order.spentAmount, order.pricePerAction)
    }
  );

  // 6. Credit user earnings
  const trafficUser = await getOrCreateTrafficUser(dto.userId, order.trafficSource);
  await trafficUserRepository.nativeUpdate(
    { id: trafficUser.id },
    { totalEarnings: add(trafficUser.totalEarnings, order.pricePerAction) }
  );

  // 7. Return success
  return {
    success: true,
    actionId: action.id,
    status: action.status,
    reward: order.pricePerAction,
    userEarnings: add(trafficUser.totalEarnings, order.pricePerAction)
  };
}
```

---

### 4. Get User Stats

```typescript
GET /api/v1/source/users/:userId/stats
Authorization: Bot <BOT_TOKEN>

Response:
{
  "userId": 123456789,
  "totalEarnings": "15.50",
  "totalActions": 31,
  "completionRate": "95.5",
  "rank": 15,                    // Among all users
  "availableOrders": 5
}
```

---

### 5. Bot Registration (One-time Setup)

```typescript
POST /api/v1/source/register
Authorization: Bot <BOT_TOKEN>

Request:
{
  "name": "John's Traffic Bot",
  "description"?: "Bot for task completion",
  "categories"?: ["crypto", "tech"]
}

Response:
{
  "sourceId": "uuid",
  "botUsername": "@johns_bot",
  "telegramId": "123456",
  "status": "active",
  "apiEndpoint": "https://api.yourplatform.com/v1/source"
}
```

**Logic:**
```typescript
async registerBot(botToken: string, dto: RegisterBotDto) {
  // 1. Validate bot token with Telegram
  const botInfo = await telegram.getMe(botToken);

  // 2. Check not already registered
  const existing = await trafficSourceRepository.findByBotToken(botToken);
  if (existing) {
    throw new BotAlreadyRegisteredException();
  }

  // 3. Create TrafficSource
  const source = await trafficSourceRepository.create({
    name: dto.name,
    type: 'bot_with_token',
    botToken: botToken,
    botUsername: botInfo.username,
    telegramId: botInfo.id.toString(),
    isActive: true,
    managedBy: null  // Managed via API
  });

  return mapToSourceDto(source);
}
```

---

## API Endpoints Summary

| Method | Endpoint | Purpose | SubGram Equivalent |
|--------|----------|---------|-------------------|
| POST | `/source/register` | Register bot | `/bots` (action: add) |
| POST | `/source/orders/available` | Get orders for user | `/get-sponsors` |
| POST | `/source/orders/check` | Check subscription status | `/get-user-subscriptions` |
| POST | `/source/orders/:id/complete` | Report completed action | (New - they use webhooks) |
| GET | `/source/users/:id/stats` | Get user earnings/stats | `/get-balance` (partial) |
| GET | `/source/stats` | Get bot statistics | `/statistic` |

---

## DTOs

### GetOrdersRequestDto
```typescript
export class GetOrdersRequestDto {
  @ApiProperty()
  @IsNumber()
  userId!: number;

  @ApiProperty()
  @IsNumber()
  chatId!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  age?: number;
}
```

### OrderDto
```typescript
export class OrderDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty()
  @IsEnum(['subscribe', 'join', 'view', 'react'])
  action!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => TargetDto)
  target!: TargetDto;

  @ApiProperty()
  @IsString()
  reward!: string;  // Decimal

  @ApiProperty({ required: false })
  @IsOptional()
  requirements?: RequirementsDto;
}

export class TargetDto {
  @ApiProperty()
  @IsEnum(['channel', 'group', 'bot'])
  type!: 'channel' | 'group' | 'bot';

  @ApiProperty()
  @IsString()
  username!: string;

  @ApiProperty()
  @IsString()
  link!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;
}
```

### CompleteActionDto
```typescript
export class CompleteActionDto {
  @ApiProperty()
  @IsNumber()
  userId!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty()
  @IsEnum(['subscribe', 'join', 'view', 'react'])
  actionType!: string;

  @ApiProperty()
  @IsString()
  completedAt!: string;  // ISO timestamp

  @ApiProperty({ required: false })
  @IsOptional()
  proof?: {
    screenshotUrl?: string;
  };
}
```

---

## Controller Example

```typescript
@ApiTags('Traffic Source - Bot API')
@Controller('api/v1/source')
@UseGuards(BotTokenValidationGuard)
export class SourceOrderController {
  constructor(
    private readonly sourceOrderService: SourceOrderService,
  ) {}

  @Post('orders/available')
  @ApiOperation({ summary: 'Get available orders for user' })
  @ApiResponse({ status: 200, type: GetOrdersResponseDto })
  async getAvailableOrders(
    @CurrentBotAuth() bot: BotAuth,
    @Body() dto: GetOrdersRequestDto,
  ) {
    const result = await this.sourceOrderService.getAvailableOrders(
      bot.sourceId,
      dto.userId,
      dto
    );

    return Ok(result);
  }

  @Post('orders/:orderId/complete')
  @ApiOperation({ summary: 'Submit completed action' })
  @ApiResponse({ status: 200, type: CompleteActionResponseDto })
  async completeAction(
    @CurrentBotAuth() bot: BotAuth,
    @Param('orderId') orderId: string,
    @Body() dto: CompleteActionDto,
  ) {
    const result = await this.sourceOrderService.submitCompletion(
      bot.sourceId,
      orderId,
      dto
    );

    return Ok(result);
  }

  @Post('orders/check')
  @ApiOperation({ summary: 'Check user subscription status' })
  async checkStatus(
    @CurrentBotAuth() bot: BotAuth,
    @Body() dto: CheckStatusDto,
  ) {
    const result = await this.sourceOrderService.checkStatus(
      bot.sourceId,
      dto.userId,
      dto.orderId
    );

    return Ok(result);
  }
}
```

---

## Existing Auth Can Be Reused!

You already have `BotTokenValidationService` and `BotTokenValidationGuard`!

Just use them for this API:

```typescript
@UseGuards(BotTokenValidationGuard)
@ApiBotAuth()  // Custom decorator for bot auth
export class SourceOrderController {
  // ... endpoints
}
```

---

## Summary

**What We're Building:**

1. **API for bot owners** to connect their bots
2. **NOT** integrating with SubGram/FlyerService
3. **WE** are the platform (like SubGram)

**Core Endpoints:**
- `POST /source/orders/available` - Bot gets orders for user
- `POST /source/orders/:id/complete` - Bot reports completion
- `POST /source/orders/check` - Check user status

**Uses Existing:**
- ✅ TrafficSource entity
- ✅ TrafficOrder entity
- ✅ TrafficUser entity
- ✅ TrafficActions entity
- ✅ BotTokenValidationGuard

**What's New:**
- 3-4 new endpoints
- DTOs for bot API
- Service to handle bot requests
- Order matching logic

**Timeline:** 2-3 weeks (much simpler than I thought before!)

Is this what you meant?
