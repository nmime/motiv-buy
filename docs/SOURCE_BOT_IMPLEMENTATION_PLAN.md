# Traffic Source Bot API - Implementation Plan

## Quick Schema for SubGram-like API

**Goal:** Build API for bot owners to connect their bots (like SubGram/FlyerService do)

---

## Entities (0 new - use existing!)

### Use Existing Entities
```typescript
✅ TrafficSourceEntity     // Bot registration
✅ TrafficOrderEntity      // Orders
✅ TrafficUserEntity       // Users in bot
✅ TrafficActionsEntity    // Completed actions
✅ TrafficTargetEntity     // Targets (channels)
```

**No new entities needed!**

---

## DTOs (5 files, ~12 classes)

### 1. source-order.dto.ts

```typescript
// Request
export class GetOrdersRequestDto {
  @IsString()
  key!: string;  // Bot token

  @IsNumber()
  userId!: number;

  @IsNumber()
  chatId!: number;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';

  @IsOptional()
  @IsNumber()
  age?: number;
}

// Response
export class SourceOrderDto {
  @IsString()
  orderId!: string;

  @IsEnum(['subscribe', 'join', 'view', 'react'])
  action!: string;

  @ValidateNested()
  @Type(() => SourceTargetDto)
  target!: SourceTargetDto;

  @IsString()
  reward!: string;  // Decimal

  @IsOptional()
  requirements?: {
    minAge?: number;
    maxAge?: number;
    gender?: string;
    countries?: string[];
  };
}

export class SourceTargetDto {
  @IsEnum(['channel', 'group', 'bot'])
  type!: string;

  @IsString()
  username!: string;

  @IsString()
  link!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class GetOrdersResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceOrderDto)
  orders!: SourceOrderDto[];

  @IsOptional()
  @IsString()
  message?: string;
}
```

---

### 2. source-action.dto.ts

```typescript
export class CompleteActionRequestDto {
  @IsString()
  key!: string;

  @IsNumber()
  userId!: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsEnum(['subscribe', 'join', 'view', 'react'])
  actionType!: string;

  @IsString()
  completedAt!: string;  // ISO timestamp

  @IsOptional()
  proof?: {
    screenshotUrl?: string;
  };
}

export class CompleteActionResponseDto {
  @IsBoolean()
  success!: boolean;

  @IsOptional()
  @IsString()
  actionId?: string;

  @IsOptional()
  @IsString()
  status?: 'verified' | 'pending' | 'rejected';

  @IsOptional()
  @IsString()
  reward?: string;

  @IsOptional()
  @IsString()
  userEarnings?: string;

  @IsOptional()
  @IsString()
  error?: string;
}
```

---

### 3. source-check.dto.ts

```typescript
export class CheckStatusRequestDto {
  @IsString()
  key!: string;

  @IsNumber()
  userId!: number;

  @IsString()
  orderId!: string;
}

export class CheckStatusResponseDto {
  @IsEnum(['subscribed', 'not_subscribed', 'pending', 'verified'])
  status!: string;

  @IsBoolean()
  canProceed!: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}
```

---

### 4. source-register.dto.ts

```typescript
export class RegisterBotRequestDto {
  @IsString()
  key!: string;  // Bot token

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  categories?: string[];
}

export class RegisterBotResponseDto {
  @IsString()
  sourceId!: string;

  @IsString()
  botUsername!: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsEnum(['active', 'pending_review'])
  status!: string;

  @IsOptional()
  @IsString()
  error?: string;
}
```

---

### 5. source-stats.dto.ts

```typescript
export class GetUserStatsResponseDto {
  @IsNumber()
  userId!: number;

  @IsString()
  totalEarnings!: string;

  @IsNumber()
  totalActions!: number;

  @IsString()
  completionRate!: string;

  @IsOptional()
  @IsNumber()
  rank?: number;

  @IsOptional()
  @IsNumber()
  availableOrders?: number;
}

export class GetBotStatsResponseDto {
  @IsString()
  sourceId!: string;

  @IsNumber()
  totalUsers!: number;

  @IsNumber()
  activeUsers!: number;

  @IsString()
  totalEarnings!: string;

  @IsNumber()
  totalActions!: number;

  @IsString()
  completionRate!: string;
}
```

---

## Controllers (1)

### SourceBotController

**File:** `libs/feature/traffic/main/src/controller/source-bot.controller.ts`

```typescript
@ApiTags('Source Bot API')
@Controller('api/v1/source')
export class SourceBotController {
  constructor(
    private readonly sourceBotService: SourceBotService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register bot' })
  async registerBot(@Body() dto: RegisterBotRequestDto) {
    const result = await this.sourceBotService.registerBot(dto);
    return Ok(result);
  }

  @Post('orders/available')
  @ApiOperation({ summary: 'Get available orders for user' })
  async getOrders(@Body() dto: GetOrdersRequestDto) {
    const result = await this.sourceBotService.getAvailableOrders(dto);
    return Ok(result);
  }

  @Post('orders/check')
  @ApiOperation({ summary: 'Check subscription status' })
  async checkStatus(@Body() dto: CheckStatusRequestDto) {
    const result = await this.sourceBotService.checkStatus(dto);
    return Ok(result);
  }

  @Post('orders/:orderId/complete')
  @ApiOperation({ summary: 'Report completed action' })
  async completeAction(
    @Param('orderId') orderId: string,
    @Body() dto: CompleteActionRequestDto,
  ) {
    const result = await this.sourceBotService.submitCompletion(orderId, dto);
    return Ok(result);
  }

  @Get('users/:userId/stats')
  @ApiOperation({ summary: 'Get user statistics' })
  async getUserStats(
    @Param('userId') userId: number,
    @Query('key') key: string,
  ) {
    const result = await this.sourceBotService.getUserStats(userId, key);
    return Ok(result);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get bot statistics' })
  async getBotStats(@Query('key') key: string) {
    const result = await this.sourceBotService.getBotStats(key);
    return Ok(result);
  }
}
```

---

## Services (1 main + 2 helpers)

### 1. SourceBotService (Main)

**File:** `libs/feature/traffic/main/src/service/source-bot.service.ts`

```typescript
@Injectable()
export class SourceBotService {
  constructor(
    private readonly trafficSourceRepository: TrafficSourceRepository,
    private readonly trafficOrderRepository: TrafficOrderRepository,
    private readonly trafficUserRepository: TrafficUserRepository,
    private readonly trafficActionsRepository: TrafficActionsRepository,
    private readonly botValidationService: BotTokenValidationService,
  ) {}

  /**
   * Register bot
   */
  async registerBot(dto: RegisterBotRequestDto): Promise<RegisterBotResponseDto> {
    // 1. Validate bot token with Telegram
    const botInfo = await this.botValidationService.validateWithTelegram(dto.key);

    if (!botInfo) {
      return { error: 'Invalid bot token', status: 'rejected' };
    }

    // 2. Check if already registered
    const existing = await this.trafficSourceRepository.findByBotToken(dto.key);
    if (existing) {
      return {
        sourceId: existing.id,
        botUsername: existing.botUsername!,
        telegramId: existing.telegramId,
        status: 'active',
        error: 'Bot already registered',
      };
    }

    // 3. Create TrafficSource
    const source = await this.trafficSourceRepository.create({
      name: dto.name,
      description: dto.description,
      type: 'bot_with_token',
      botToken: dto.key,
      botUsername: botInfo.username,
      telegramId: botInfo.id.toString(),
      isActive: true,
      managedBy: null,  // API-managed, not UI
    });

    return {
      sourceId: source.id,
      botUsername: source.botUsername!,
      telegramId: source.telegramId,
      status: 'active',
    };
  }

  /**
   * Get available orders for user
   */
  async getAvailableOrders(dto: GetOrdersRequestDto): Promise<GetOrdersResponseDto> {
    // 1. Validate bot token
    const source = await this.validateBotToken(dto.key);

    // 2. Find active orders for this source
    const orders = await this.trafficOrderRepository.find({
      trafficSource: source.id,
      status: 'active',
      currentCount: { $lt: this.em.raw('target_count') },
    });

    // 3. Check which orders user already completed
    const completedOrderIds = await this.trafficActionsRepository.find({
      userId: dto.userId,
      status: 'completed',
    }).then(actions => actions.map(a => a.trafficOrder.id));

    // 4. Filter out completed
    const available = orders.filter(o => !completedOrderIds.includes(o.id));

    // 5. Apply targeting filters
    const filtered = this.applyTargeting(available, dto);

    // 6. Map to DTOs
    const orderDtos = await Promise.all(
      filtered.map(order => this.mapToSourceOrderDto(order))
    );

    return {
      orders: orderDtos,
      message: orderDtos.length > 0 ? undefined : 'No orders available',
    };
  }

  /**
   * Check subscription status
   */
  async checkStatus(dto: CheckStatusRequestDto): Promise<CheckStatusResponseDto> {
    // 1. Validate bot token
    await this.validateBotToken(dto.key);

    // 2. Find order
    const order = await this.trafficOrderRepository.findOne({
      orderId: dto.orderId,
    }, { populate: ['trafficTarget'] });

    if (!order) {
      return {
        status: 'not_subscribed',
        canProceed: false,
        message: 'Order not found',
      };
    }

    // 3. Check if user already completed
    const action = await this.trafficActionsRepository.findOne({
      trafficOrder: order.id,
      userId: dto.userId,
    });

    if (action) {
      return {
        status: action.status === 'completed' ? 'verified' : 'pending',
        canProceed: action.status === 'completed',
      };
    }

    // 4. Optionally verify with Telegram API
    // const isSubscribed = await this.verifySubscription(dto.userId, order.trafficTarget);

    return {
      status: 'not_subscribed',
      canProceed: false,
      message: 'Please complete the action',
    };
  }

  /**
   * Submit completed action
   */
  async submitCompletion(
    orderId: string,
    dto: CompleteActionRequestDto,
  ): Promise<CompleteActionResponseDto> {
    // 1. Validate bot token
    const source = await this.validateBotToken(dto.key);

    // 2. Find order
    const order = await this.trafficOrderRepository.findOne({
      orderId,
      trafficSource: source.id,
    }, { populate: ['trafficTarget'] });

    if (!order) {
      return {
        success: false,
        error: 'Order not found or not assigned to this bot',
      };
    }

    // 3. Check duplicate
    const existing = await this.trafficActionsRepository.findOne({
      trafficOrder: order.id,
      userId: dto.userId,
    });

    if (existing) {
      return {
        success: false,
        error: 'Action already submitted',
      };
    }

    // 4. Create action
    const action = await this.trafficActionsRepository.create({
      trafficOrder: order,
      trafficSource: source,
      type: dto.actionType as TrafficActionType,
      status: 'completed',
      userId: dto.userId,
      username: dto.username,
      reward: order.pricePerAction,
      completedAt: new Date(dto.completedAt),
    });

    // 5. Update order progress
    await this.trafficOrderRepository.nativeUpdate(
      { id: order.id },
      {
        currentCount: order.currentCount + 1,
        spentAmount: add(order.spentAmount, order.pricePerAction),
      }
    );

    // 6. Update or create TrafficUser
    let trafficUser = await this.trafficUserRepository.findOne({
      telegramId: dto.userId.toString(),
      trafficSource: source.id,
    });

    if (!trafficUser) {
      trafficUser = await this.trafficUserRepository.create({
        telegramId: dto.userId.toString(),
        username: dto.username,
        firstName: dto.username || 'User',
        trafficSource: source,
        totalEarnings: '0',
        totalOrdersParticipated: 0,
      });
    }

    // 7. Update user earnings
    const newEarnings = add(trafficUser.totalEarnings, order.pricePerAction);
    await this.trafficUserRepository.nativeUpdate(
      { id: trafficUser.id },
      {
        totalEarnings: toDbString(newEarnings, 8),
        totalOrdersParticipated: trafficUser.totalOrdersParticipated + 1,
      }
    );

    return {
      success: true,
      actionId: action.actionId,
      status: 'verified',
      reward: order.pricePerAction,
      userEarnings: toDbString(newEarnings, 2),
    };
  }

  /**
   * Get user stats
   */
  async getUserStats(userId: number, key: string): Promise<GetUserStatsResponseDto> {
    const source = await this.validateBotToken(key);

    const user = await this.trafficUserRepository.findOne({
      telegramId: userId.toString(),
      trafficSource: source.id,
    });

    if (!user) {
      return {
        userId,
        totalEarnings: '0.00',
        totalActions: 0,
        completionRate: '0.00',
      };
    }

    const availableOrders = await this.getAvailableOrdersCount(source.id, userId);

    return {
      userId,
      totalEarnings: toDisplayString(user.totalEarnings, 2),
      totalActions: user.totalOrdersParticipated,
      completionRate: toDisplayString(user.completionRate, 1),
      availableOrders,
    };
  }

  /**
   * Get bot stats
   */
  async getBotStats(key: string): Promise<GetBotStatsResponseDto> {
    const source = await this.validateBotToken(key);

    const totalUsers = await this.trafficUserRepository.count({
      trafficSource: source.id,
    });

    const activeUsers = await this.trafficUserRepository.count({
      trafficSource: source.id,
      status: 'active',
      lastSeenAt: { $gte: subDays(new Date(), 7) },
    });

    const users = await this.trafficUserRepository.find({
      trafficSource: source.id,
    });

    const totalEarnings = users.reduce((sum, u) => add(sum, u.totalEarnings), '0');
    const totalActions = users.reduce((sum, u) => sum + u.totalOrdersParticipated, 0);
    const avgCompletionRate = users.length > 0
      ? users.reduce((sum, u) => add(sum, u.completionRate), '0') / users.length
      : '0';

    return {
      sourceId: source.id,
      totalUsers,
      activeUsers,
      totalEarnings: toDisplayString(totalEarnings, 2),
      totalActions,
      completionRate: toDisplayString(avgCompletionRate.toString(), 1),
    };
  }

  // Helper methods
  private async validateBotToken(key: string): Promise<TrafficSourceEntity> {
    const source = await this.trafficSourceRepository.findOne({
      botToken: key,
      isActive: true,
    });

    if (!source) {
      throw new UnauthorizedException('Invalid bot token');
    }

    return source;
  }

  private applyTargeting(
    orders: TrafficOrderEntity[],
    dto: GetOrdersRequestDto,
  ): TrafficOrderEntity[] {
    return orders.filter(order => {
      if (!order.requirements) return true;

      const req = order.requirements;

      // Gender filter
      if (req.gender && dto.gender && req.gender !== dto.gender) {
        return false;
      }

      // Age filter
      if (dto.age) {
        if (req.minAge && dto.age < req.minAge) return false;
        if (req.maxAge && dto.age > req.maxAge) return false;
      }

      // Country filter (would need user's country)
      // if (req.countries && userCountry && !req.countries.includes(userCountry)) {
      //   return false;
      // }

      return true;
    });
  }

  private async mapToSourceOrderDto(order: TrafficOrderEntity): Promise<SourceOrderDto> {
    await order.trafficTarget.load();

    return {
      orderId: order.orderId,
      action: order.type as string,
      target: {
        type: order.trafficTarget.type as string,
        username: order.trafficTarget.username || '',
        link: order.trafficTarget.inviteLink || `https://t.me/${order.trafficTarget.username}`,
        name: order.trafficTarget.name,
      },
      reward: toDisplayString(order.pricePerAction, 2),
      requirements: order.requirements,
    };
  }

  private async getAvailableOrdersCount(sourceId: string, userId: number): Promise<number> {
    const orders = await this.trafficOrderRepository.find({
      trafficSource: sourceId,
      status: 'active',
      currentCount: { $lt: this.em.raw('target_count') },
    });

    const completedOrderIds = await this.trafficActionsRepository.find({
      userId,
      status: 'completed',
    }).then(actions => actions.map(a => a.trafficOrder.id));

    return orders.filter(o => !completedOrderIds.includes(o.id)).length;
  }
}
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Create DTOs (5 files)
- [ ] Create `SourceBotController`
- [ ] Create `SourceBotService` skeleton
- [ ] Add routes to module

### Week 2: Core Logic
- [ ] Implement `registerBot()`
- [ ] Implement `getAvailableOrders()`
- [ ] Implement `submitCompletion()`
- [ ] Add targeting filters

### Week 3: Features
- [ ] Implement `checkStatus()`
- [ ] Implement `getUserStats()`
- [ ] Implement `getBotStats()`
- [ ] Add validation

### Week 4: Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Load testing
- [ ] Bug fixes

---

## Summary

### What We're Building
**API for bot owners to connect their bots** (like SubGram/FlyerService provide)

### Endpoints (6)
1. `POST /source/register` - Register bot
2. `POST /source/orders/available` - Get orders
3. `POST /source/orders/check` - Check status
4. `POST /source/orders/:id/complete` - Submit action
5. `GET /source/users/:id/stats` - User stats
6. `GET /source/stats` - Bot stats

### Uses Existing
- ✅ TrafficSource entity
- ✅ TrafficOrder entity
- ✅ TrafficUser entity
- ✅ TrafficActions entity
- ✅ BotTokenValidationService

### New Code
- 5 DTO files (~12 classes)
- 1 Controller (~200 lines)
- 1 Service (~500 lines)

**Total:** ~800 lines of code

**Timeline:** 3-4 weeks

**Complexity:** ⭐⭐⭐ (Medium)
