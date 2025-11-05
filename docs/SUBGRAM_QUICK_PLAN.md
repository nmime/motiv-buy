# SubGram Model - Quick Implementation Plan

## Phase 0: SubGram Model (Start Here)

---

## Entities (2 new)

### 1. ProviderApiKeyEntity
**File:** `libs/database/src/entity/ProviderApiKey.entity.ts`

```typescript
import { Entity, Property, ManyToOne, Index } from '@mikro-orm/core';
import { BaseEntity } from './Base.entity';
import { UserEntity } from './User.entity';

@Entity({ tableName: 'provider_api_key' })
export class ProviderApiKeyEntity extends BaseEntity {
  @Property({ type: 'varchar', length: 255 })
  @Index()
  apiKeyHash!: string; // bcrypt hash

  @Property({ type: 'varchar', length: 100 })
  @Index()
  providerId!: string; // e.g., 'subgram', 'flyerservice', 'custom_123'

  @Property({ type: 'varchar', length: 255 })
  providerName!: string;

  @Property({ type: 'json' })
  permissions!: string[]; // ['orders:read', 'orders:write', 'actions:submit', 'webhooks:manage']

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => UserEntity)
  createdBy!: UserEntity;

  @Property({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;
}
```

**Fields:**
- `apiKeyHash` - bcrypt hash of API key (never store plaintext)
- `providerId` - unique provider identifier
- `providerName` - human-readable name
- `permissions` - array of permission scopes
- `isActive` - can be revoked
- `createdBy` - user who created it
- `lastUsedAt` - track usage

---

### 2. ProviderWebhookEntity
**File:** `libs/database/src/entity/ProviderWebhook.entity.ts`

```typescript
import { Entity, Property, ManyToOne, Index } from '@mikro-orm/core';
import { BaseEntity } from './Base.entity';
import { UserEntity } from './User.entity';

@Entity({ tableName: 'provider_webhook' })
export class ProviderWebhookEntity extends BaseEntity {
  @Property({ type: 'varchar', length: 100 })
  @Index()
  providerId!: string;

  @Property({ type: 'varchar', length: 500 })
  url!: string;

  @Property({ type: 'json' })
  events!: string[]; // ['order.created', 'order.updated', 'order.completed', 'order.cancelled']

  @Property({ type: 'varchar', length: 255 })
  secret!: string; // For HMAC signature verification

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => UserEntity)
  createdBy!: UserEntity;

  @Property({ type: 'timestamp', nullable: true })
  lastTriggeredAt?: Date;
}
```

**Fields:**
- `providerId` - links to provider
- `url` - webhook endpoint URL
- `events` - which events to send
- `secret` - for HMAC-SHA256 signature
- `isActive` - can be paused
- `lastTriggeredAt` - track last delivery

---

## Repositories (2 new)

### 1. ProviderApiKeyRepository
**File:** `libs/database/src/repository/ProviderApiKey.repository.ts`

```typescript
import { EntityRepository } from '@mikro-orm/postgresql';
import { ProviderApiKeyEntity } from '../entity/ProviderApiKey.entity';

export class ProviderApiKeyRepository extends EntityRepository<ProviderApiKeyEntity> {
  async findByProviderId(providerId: string): Promise<ProviderApiKeyEntity | null> {
    return this.findOne({ providerId, isActive: true });
  }

  async findByApiKeyHash(hash: string): Promise<ProviderApiKeyEntity | null> {
    return this.findOne({ apiKeyHash: hash, isActive: true }, { populate: ['createdBy'] });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.nativeUpdate({ id }, { lastUsedAt: new Date() });
  }

  async deactivate(id: string): Promise<void> {
    await this.nativeUpdate({ id }, { isActive: false });
  }

  async createApiKey(
    providerId: string,
    providerName: string,
    apiKeyHash: string,
    permissions: string[],
    createdBy: UserEntity,
  ): Promise<ProviderApiKeyEntity> {
    const key = this.create({
      providerId,
      providerName,
      apiKeyHash,
      permissions,
      isActive: true,
      createdBy,
    });
    await this.em.persistAndFlush(key);
    return key;
  }
}
```

---

### 2. ProviderWebhookRepository
**File:** `libs/database/src/repository/ProviderWebhook.repository.ts`

```typescript
import { EntityRepository } from '@mikro-orm/postgresql';
import { ProviderWebhookEntity } from '../entity/ProviderWebhook.entity';

export class ProviderWebhookRepository extends EntityRepository<ProviderWebhookEntity> {
  async findByProviderId(providerId: string): Promise<ProviderWebhookEntity[]> {
    return this.find({ providerId, isActive: true });
  }

  async findByProviderIdAndEvent(
    providerId: string,
    event: string,
  ): Promise<ProviderWebhookEntity[]> {
    return this.find({
      providerId,
      isActive: true,
      events: { $contains: [event] },
    });
  }

  async updateLastTriggered(id: string): Promise<void> {
    await this.nativeUpdate({ id }, { lastTriggeredAt: new Date() });
  }
}
```

---

## DTOs (5 new)

### 1. GetOrdersResponseDto
**File:** `libs/feature/traffic-provider/shared/src/dto/provider-order.dto.ts`

```typescript
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProviderOrderTargetDto {
  @ApiProperty()
  @IsString()
  telegramId!: string;

  @ApiProperty()
  @IsString()
  username!: string;

  @ApiProperty()
  @IsEnum(['channel', 'group', 'bot'])
  type!: 'channel' | 'group' | 'bot';
}

export class ProviderOrderRequirementsDto {
  @ApiProperty()
  @IsNumber()
  totalCount!: number;

  @ApiProperty()
  @IsNumber()
  currentCount!: number;

  @ApiProperty()
  @IsNumber()
  remainingCount!: number;

  @ApiProperty()
  @IsNumber()
  dailyLimit!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  targeting?: {
    gender?: 'male' | 'female';
    ageMin?: number;
    ageMax?: number;
    countries?: string[];
    languages?: string[];
  };
}

export class ProviderOrderPricingDto {
  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  pricePerAction!: string;

  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  totalBudget!: string;

  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  spentAmount!: string;
}

export class ProviderOrderDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty()
  @IsEnum(['channel_subscribers', 'post_views', 'group_members'])
  type!: 'channel_subscribers' | 'post_views' | 'group_members';

  @ApiProperty()
  @ValidateNested()
  @Type(() => ProviderOrderTargetDto)
  target!: ProviderOrderTargetDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ProviderOrderRequirementsDto)
  requirements!: ProviderOrderRequirementsDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ProviderOrderPricingDto)
  pricing!: ProviderOrderPricingDto;

  @ApiProperty()
  @IsEnum(['active', 'paused'])
  status!: 'active' | 'paused';
}

export class PaginationDto {
  @ApiProperty()
  @IsNumber()
  total!: number;

  @ApiProperty()
  @IsNumber()
  limit!: number;

  @ApiProperty()
  @IsNumber()
  offset!: number;

  @ApiProperty()
  @IsNumber()
  hasMore!: boolean;
}

export class GetOrdersResponseDto {
  @ApiProperty({ type: [ProviderOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderOrderDto)
  orders!: ProviderOrderDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination!: PaginationDto;
}
```

---

### 2. SubmitActionsDto
**File:** `libs/feature/traffic-provider/shared/src/dto/provider-action.dto.ts`

```typescript
import { IsNumber, IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ActionProofDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  additionalData?: Record<string, unknown>;
}

export class ActionSubmissionDto {
  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  userId!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty()
  @IsEnum(['subscribe', 'view', 'join'])
  actionType!: 'subscribe' | 'view' | 'join';

  @ApiProperty({ description: 'ISO timestamp' })
  @IsString()
  completedAt!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionProofDto)
  proof?: ActionProofDto;
}

export class SubmitActionsDto {
  @ApiProperty({ type: [ActionSubmissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionSubmissionDto)
  actions!: ActionSubmissionDto[];
}

export class ActionResultDto {
  @ApiProperty()
  @IsString()
  actionId!: string;

  @ApiProperty()
  @IsNumber()
  userId!: number;

  @ApiProperty()
  @IsEnum(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'Decimal string', required: false })
  @IsOptional()
  @IsString()
  reward?: string;
}

export class OrderProgressDto {
  @ApiProperty()
  @IsNumber()
  currentCount!: number;

  @ApiProperty()
  @IsNumber()
  remainingCount!: number;

  @ApiProperty()
  @IsNumber()
  completionPercentage!: number;
}

export class SubmitActionsResponseDto {
  @ApiProperty()
  @IsNumber()
  accepted!: number;

  @ApiProperty()
  @IsNumber()
  rejected!: number;

  @ApiProperty({ type: [ActionResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionResultDto)
  actions!: ActionResultDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => OrderProgressDto)
  orderProgress!: OrderProgressDto;
}
```

---

### 3. RegisterWebhookDto
**File:** `libs/feature/traffic-provider/shared/src/dto/provider-webhook.dto.ts`

```typescript
import { IsString, IsArray, IsUrl, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterWebhookDto {
  @ApiProperty()
  @IsUrl()
  url!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  events!: string[]; // ['order.created', 'order.updated', 'order.completed', 'order.cancelled']

  @ApiProperty()
  @IsString()
  secret!: string; // Provider's secret for HMAC signature
}

export class WebhookResponseDto {
  @ApiProperty()
  @IsString()
  webhookId!: string;

  @ApiProperty()
  @IsUrl()
  url!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  events!: string[];

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty()
  @IsString()
  createdAt!: string;
}
```

---

### 4. GetBalanceResponseDto
**File:** `libs/feature/traffic-provider/shared/src/dto/provider-analytics.dto.ts`

```typescript
import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBalanceResponseDto {
  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  balance!: string;

  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  totalEarnings!: string;

  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  pendingEarnings!: string;

  @ApiProperty()
  @IsNumber()
  completedActions!: number;

  @ApiProperty()
  @IsNumber()
  activeOrders!: number;
}
```

---

### 5. GetFiltersResponseDto
**File:** `libs/feature/traffic-provider/shared/src/dto/provider-filters.dto.ts`

```typescript
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AgeRangeDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsNumber()
  min!: number;

  @ApiProperty()
  @IsNumber()
  max!: number;
}

export class CountryDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class LanguageDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class TrafficTypeDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Decimal string' })
  @IsString()
  basePrice!: string;
}

export class GetFiltersResponseDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  genders!: string[];

  @ApiProperty({ type: [AgeRangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgeRangeDto)
  ageRanges!: AgeRangeDto[];

  @ApiProperty({ type: [CountryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountryDto)
  countries!: CountryDto[];

  @ApiProperty({ type: [LanguageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  languages!: LanguageDto[];

  @ApiProperty({ type: [TrafficTypeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrafficTypeDto)
  trafficTypes!: TrafficTypeDto[];
}
```

---

## Auth (API Key Guard)

### ProviderApiKeyGuard
**File:** `libs/feature/traffic-provider/main/src/guard/provider-api-key.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ProviderApiKeyService } from '../service/provider-api-key.service';
import { InvalidApiKeyException } from '@app/feature-traffic-provider-shared';

export interface RequestWithProvider extends Request {
  provider?: {
    id: string;
    providerId: string;
    providerName: string;
    permissions: string[];
  };
}

@Injectable()
export class ProviderApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ProviderApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithProvider>();

    // Extract API key from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new InvalidApiKeyException('Missing or invalid Authorization header');
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "

    // Validate API key
    const result = await this.apiKeyService.validateApiKey(apiKey);

    if (result.err) {
      throw new InvalidApiKeyException(result.val.message);
    }

    // Attach provider info to request
    request.provider = {
      id: result.val.id,
      providerId: result.val.providerId,
      providerName: result.val.providerName,
      permissions: result.val.permissions,
    };

    return true;
  }
}
```

---

### ProviderApiKeyService
**File:** `libs/feature/traffic-provider/main/src/service/provider-api-key.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ProviderApiKeyRepository } from '@app/database';
import { Result, Ok, Err } from '@app/common-shared';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface ValidatedProvider {
  id: string;
  providerId: string;
  providerName: string;
  permissions: string[];
}

@Injectable()
export class ProviderApiKeyService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly apiKeyRepository: ProviderApiKeyRepository) {}

  /**
   * Generate new API key
   * Format: prov_live_<32_random_chars>
   */
  generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const randomString = randomBytes.toString('base64url');
    return `prov_live_${randomString}`;
  }

  /**
   * Hash API key for storage
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.SALT_ROUNDS);
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<Result<ValidatedProvider, Error>> {
    try {
      // Extract provider ID from key format (if needed for optimization)
      // For now, we'll query all active keys and compare hashes

      // Find all active keys (optimize later with provider ID extraction)
      const allKeys = await this.apiKeyRepository.findAll({
        where: { isActive: true },
        populate: ['createdBy'],
      });

      // Compare hashes (constant-time)
      for (const keyEntity of allKeys) {
        const isMatch = await bcrypt.compare(apiKey, keyEntity.apiKeyHash);

        if (isMatch) {
          // Update last used
          await this.apiKeyRepository.updateLastUsed(keyEntity.id);

          return Ok({
            id: keyEntity.id,
            providerId: keyEntity.providerId,
            providerName: keyEntity.providerName,
            permissions: keyEntity.permissions,
          });
        }
      }

      return Err(new Error('Invalid API key'));
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Check if provider has permission
   */
  hasPermission(provider: ValidatedProvider, permission: string): boolean {
    return provider.permissions.includes(permission);
  }
}
```

---

### Decorators
**File:** `libs/feature/traffic-provider/shared/src/decorator/provider.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithProvider } from '../guard/provider-api-key.guard';

export const CurrentProvider = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithProvider>();
    return request.provider;
  },
);

export interface ProviderAuth {
  id: string;
  providerId: string;
  providerName: string;
  permissions: string[];
}
```

---

## Endpoints (5)

### ProviderOrderController
**File:** `libs/feature/traffic-provider/main/src/controller/provider-order.controller.ts`

```typescript
import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProviderApiKeyGuard } from '../guard/provider-api-key.guard';
import { CurrentProvider, ProviderAuth } from '@app/feature-traffic-provider-shared';
import { ProviderOrderService } from '../service/provider-order.service';
import {
  GetOrdersResponseDto,
  SubmitActionsDto,
  SubmitActionsResponseDto,
} from '@app/feature-traffic-provider-shared';
import { Ok } from '@app/common-shared';

@ApiTags('Provider - Orders')
@Controller('api/v1/provider/orders')
@UseGuards(ProviderApiKeyGuard)
@ApiBearerAuth()
export class ProviderOrderController {
  constructor(private readonly orderService: ProviderOrderService) {}

  @Get('available')
  @ApiOperation({ summary: 'Get available orders for provider' })
  @ApiResponse({ status: 200, type: GetOrdersResponseDto })
  async getAvailableOrders(
    @CurrentProvider() provider: ProviderAuth,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const result = await this.orderService.getAvailableOrders(provider.providerId, {
      type,
      status,
      limit: limit || 50,
      offset: offset || 0,
    });

    return Ok(result);
  }

  @Post(':orderId/actions')
  @ApiOperation({ summary: 'Submit completed actions for an order' })
  @ApiResponse({ status: 200, type: SubmitActionsResponseDto })
  async submitActions(
    @CurrentProvider() provider: ProviderAuth,
    @Param('orderId') orderId: string,
    @Body() dto: SubmitActionsDto,
  ) {
    const result = await this.orderService.submitActions(provider.providerId, orderId, dto);

    return Ok(result);
  }
}
```

---

### ProviderWebhookController
**File:** `libs/feature/traffic-provider/main/src/controller/provider-webhook.controller.ts`

```typescript
import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProviderApiKeyGuard } from '../guard/provider-api-key.guard';
import { CurrentProvider, ProviderAuth } from '@app/feature-traffic-provider-shared';
import { ProviderWebhookService } from '../service/provider-webhook.service';
import { RegisterWebhookDto, WebhookResponseDto } from '@app/feature-traffic-provider-shared';
import { Ok } from '@app/common-shared';

@ApiTags('Provider - Webhooks')
@Controller('api/v1/provider/webhooks')
@UseGuards(ProviderApiKeyGuard)
@ApiBearerAuth()
export class ProviderWebhookController {
  constructor(private readonly webhookService: ProviderWebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Register webhook for provider' })
  @ApiResponse({ status: 201, type: WebhookResponseDto })
  async registerWebhook(
    @CurrentProvider() provider: ProviderAuth,
    @Body() dto: RegisterWebhookDto,
  ) {
    const result = await this.webhookService.register(provider.providerId, dto);

    return Ok(result);
  }

  @Get()
  @ApiOperation({ summary: 'Get registered webhooks' })
  @ApiResponse({ status: 200, type: [WebhookResponseDto] })
  async getWebhooks(@CurrentProvider() provider: ProviderAuth) {
    const result = await this.webhookService.getByProviderId(provider.providerId);

    return Ok(result);
  }

  @Delete(':webhookId')
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 200 })
  async deleteWebhook(
    @CurrentProvider() provider: ProviderAuth,
    @Param('webhookId') webhookId: string,
  ) {
    await this.webhookService.delete(provider.providerId, webhookId);

    return Ok({ success: true });
  }
}
```

---

### ProviderAnalyticsController
**File:** `libs/feature/traffic-provider/main/src/controller/provider-analytics.controller.ts`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProviderApiKeyGuard } from '../guard/provider-api-key.guard';
import { CurrentProvider, ProviderAuth } from '@app/feature-traffic-provider-shared';
import { ProviderAnalyticsService } from '../service/provider-analytics.service';
import { GetBalanceResponseDto, GetFiltersResponseDto } from '@app/feature-traffic-provider-shared';
import { Ok } from '@app/common-shared';

@ApiTags('Provider - Analytics')
@Controller('api/v1/provider')
export class ProviderAnalyticsController {
  constructor(private readonly analyticsService: ProviderAnalyticsService) {}

  @Get('balance')
  @UseGuards(ProviderApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get provider balance and earnings' })
  @ApiResponse({ status: 200, type: GetBalanceResponseDto })
  async getBalance(@CurrentProvider() provider: ProviderAuth) {
    const result = await this.analyticsService.getBalance(provider.providerId);

    return Ok(result);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available targeting filters (public endpoint)' })
  @ApiResponse({ status: 200, type: GetFiltersResponseDto })
  async getFilters() {
    const result = await this.analyticsService.getFilters();

    return Ok(result);
  }
}
```

---

## Summary

### Entities: 2
1. `ProviderApiKeyEntity` - API key authentication
2. `ProviderWebhookEntity` - Webhook registration

### Repositories: 2
1. `ProviderApiKeyRepository` - API key operations
2. `ProviderWebhookRepository` - Webhook operations

### DTOs: 5 files, ~15 classes
1. `provider-order.dto.ts` - Order-related DTOs
2. `provider-action.dto.ts` - Action submission DTOs
3. `provider-webhook.dto.ts` - Webhook DTOs
4. `provider-analytics.dto.ts` - Balance DTOs
5. `provider-filters.dto.ts` - Filters DTOs

### Guards: 1
1. `ProviderApiKeyGuard` - API key authentication

### Services: 1 (auth)
1. `ProviderApiKeyService` - API key generation, validation

### Controllers: 3
1. `ProviderOrderController` - 2 endpoints
2. `ProviderWebhookController` - 3 endpoints
3. `ProviderAnalyticsController` - 2 endpoints

### Endpoints: 5 (7 total with variations)
1. `GET /api/v1/provider/orders/available` - Get orders
2. `POST /api/v1/provider/orders/:id/actions` - Submit actions
3. `POST /api/v1/provider/webhooks` - Register webhook
4. `GET /api/v1/provider/balance` - Get balance
5. `GET /api/v1/provider/filters` - Get filters (public)

### Auth Flow:
```
Request → Authorization: Bearer <API_KEY>
       → ProviderApiKeyGuard
       → ProviderApiKeyService.validateApiKey()
       → bcrypt.compare() with stored hashes
       → Attach provider to request
       → Controller action
```

---

## Next Steps

1. ✅ Create entities and repositories
2. ✅ Create DTOs
3. ✅ Create auth guard and service
4. ⏳ Create business logic services (4 more)
5. ⏳ Create controllers
6. ⏳ Create migration
7. ⏳ Write tests
