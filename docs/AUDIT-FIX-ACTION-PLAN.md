# Audit Fix Action Plan
**Created:** 2025-11-07
**Project:** MotivBuy - Bot & API Audit Fixes
**Status:** Ready for Implementation

---

## Executive Summary

This document provides step-by-step fixes for all issues identified in the Bot & API Comprehensive Audit Report.
Each fix includes:
- **Priority Level** (Critical/High/Medium/Low)
- **Estimated Effort**
- **Detailed Code Examples**
- **Testing Requirements**
- **Risk Assessment**

---

## Table of Contents

1. [Critical Fixes](#1-critical-fixes)
2. [High Priority Fixes](#2-high-priority-fixes)
3. [Medium Priority Fixes](#3-medium-priority-fixes)
4. [Low Priority Fixes](#4-low-priority-fixes)

---

## 1. Critical Fixes

### Issue #1: Manual Handler Instantiation (CRITICAL)

**File:** `monorepo/libs/feature/bot/main/src/service/bot.service.ts`
**Lines:** 505-527
**Severity:** ❌ Critical
**Effort:** 2 hours
**Risk:** High - Bypasses dependency injection, causes null reference errors

#### Current Code (WRONG):
```typescript
private async handleProfileCommand(ctx: BotContext): Promise<void> {
  const { ProfileActionHandler } = require('../handler/profile-action.handler');
  const { MenuActionHandler } = require('../handler/menu-action.handler');
  const menuHandler = new MenuActionHandler();
  const profileHandler = new ProfileActionHandler(null as any, menuHandler);
  await profileHandler.handleProfileView(ctx);
}
```

#### Fixed Code:
```typescript
// 1. Update constructor to inject handlers
constructor(
  private readonly botConfigService: BotConfigService,
  private readonly orderHandler: OrderHandler,
  private readonly i18n: I18nService,
  private readonly callbackRouter: CallbackRouterHandler,
  private readonly botUserService: BotUserService,
  private readonly botSessionService: BotSessionService,
  // Add these new dependencies
  private readonly profileHandler: ProfileActionHandler,
  private readonly settingsHandler: SettingsActionHandler,
  private readonly balanceHandler: BalanceActionHandler,
  private readonly menuHandler: MenuActionHandler,
) {}

// 2. Update command handlers to use injected dependencies
private async handleProfileCommand(ctx: BotContext): Promise<void> {
  await this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext);
}

private async handleSettingsCommand(ctx: BotContext): Promise<void> {
  await this.settingsHandler.handleSettingsView(ctx);
}

private async handleBalanceCommand(ctx: BotContext): Promise<void> {
  await this.balanceHandler.handleBalanceView(ctx as AuthenticatedBotContext);
}

private async handleMenuCommand(ctx: BotContext): Promise<void> {
  const keyboard = this.menuHandler.createMainMenuKeyboard();
  await ctx.reply('📋 <b>Main Menu</b>\n\nSelect an option below:', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
```

#### Files to Modify:
1. `monorepo/libs/feature/bot/main/src/service/bot.service.ts`

#### Testing:
```bash
# Test bot commands work
/start
/profile  # Should display profile without errors
/balance  # Should display balance
/settings # Should display settings
/menu     # Should display menu
```

---

### Issue #2: Split Large File (CRITICAL)

**File:** `monorepo/libs/feature/bot/main/src/handler/callback-router.handler.ts`
**Current Size:** 1421 lines (limit: 500)
**Severity:** ❌ Critical
**Effort:** 4-6 hours
**Risk:** Medium - Requires careful refactoring

#### Strategy:

Split the 1421-line file into multiple focused files:

```
callback-router.handler.ts (150 lines)
├── routers/
│   ├── menu-router.ts (100 lines)
│   ├── profile-router.ts (150 lines)
│   ├── balance-router.ts (150 lines)
│   ├── order-router.ts (250 lines)
│   └── settings-router.ts (100 lines)
├── handlers/
│   ├── admin-handler.ts (150 lines)
│   ├── campaign-handler.ts (150 lines)
│   ├── export-handler.ts (100 lines)
│   ├── traffic-handler.ts (150 lines)
│   └── withdrawal-handler.ts (100 lines)
```

#### New File Structure:

**1. callback-router.handler.ts** (Main router - 150 lines)
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { MessageService } from '../service/message.service';
import { MenuRouter } from './routers/menu-router';
import { ProfileRouter } from './routers/profile-router';
import { BalanceRouter } from './routers/balance-router';
import { OrderRouter } from './routers/order-router';
import { SettingsRouter } from './routers/settings-router';

type ActionHandler = (ctx: BotContext, action: string, params: string[]) => Promise<void>;

@Injectable()
export class CallbackRouterHandler {
  private readonly logger = new Logger(CallbackRouterHandler.name);
  private primaryActionHandlers!: Map<string, ActionHandler>;

  constructor(
    private readonly rateLimitMiddleware: RateLimitMiddleware,
    private readonly messageService: MessageService,
    private readonly menuRouter: MenuRouter,
    private readonly profileRouter: ProfileRouter,
    private readonly balanceRouter: BalanceRouter,
    private readonly orderRouter: OrderRouter,
    private readonly settingsRouter: SettingsRouter,
  ) {
    this.initializeHandlerMaps();
  }

  private initializeHandlerMaps(): void {
    this.primaryActionHandlers = new Map([
      ['menu', this.menuRouter.route.bind(this.menuRouter)],
      ['profile', this.profileRouter.route.bind(this.profileRouter)],
      ['balance', this.balanceRouter.route.bind(this.balanceRouter)],
      ['orders', this.orderRouter.route.bind(this.orderRouter)],
      ['order', this.orderRouter.route.bind(this.orderRouter)],
      ['settings', this.settingsRouter.route.bind(this.settingsRouter)],
      // ... other mappings
    ]);
  }

  async routeCallback(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
      return;
    }

    const { data } = ctx.callbackQuery;

    try {
      // Check rate limit
      const isAllowed = await this.rateLimitMiddleware.checkRateLimit(ctx, 'callback');
      if (!isAllowed) {
        await ctx.answerCallbackQuery(ctx.t('common.errors.rate_limit'));
        return;
      }

      // Parse callback data
      const [primaryAction, secondaryAction, ...params] = data.split(':');

      this.logger.debug('Routing callback', {
        userId: ctx.from?.id,
        primaryAction,
        secondaryAction,
        params,
      });

      // Route to appropriate handler
      const handler = this.primaryActionHandlers.get(primaryAction);
      if (handler) {
        await handler(ctx, secondaryAction, params);
      } else {
        this.logger.warn('Unknown primary action', { primaryAction, data });
        await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      this.logger.error('Error routing callback', {
        error: error instanceof Error ? error.message : String(error),
        data,
        userId: ctx.from?.id,
      });
      await ctx.answerCallbackQuery(ctx.t('common.error'));
    }
  }
}
```

**2. routers/menu-router.ts** (100 lines)
```typescript
import { Injectable } from '@nestjs/common';
import { BotContext } from '@app/feature-bot-shared';
import { MenuActionHandler } from '../../handler/menu-action.handler';
import { MessageService } from '../../service/message.service';

@Injectable()
export class MenuRouter {
  private readonly actionHandlers!: Map<string, (ctx: BotContext) => Promise<void>>;

  constructor(
    private readonly menuHandler: MenuActionHandler,
    private readonly messageService: MessageService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.actionHandlers = new Map([
      ['main', this.handleMainMenu.bind(this)],
      ['profile', this.handleProfileMenu.bind(this)],
      ['balance', this.handleBalanceMenu.bind(this)],
      // ... other menu actions
    ]);
  }

  async route(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.actionHandlers.get(action || 'main');
    if (handler) {
      await handler(ctx);
    } else {
      await this.handleUnknownMenu(ctx);
    }
  }

  private async handleMainMenu(ctx: BotContext): Promise<void> {
    const keyboard = this.menuHandler.createMainMenuKeyboard();
    await this.messageService.sendOrEditMessage(ctx, {
      text: ctx.t('menu.main'),
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }

  // ... other menu handlers
}
```

**3. routers/profile-router.ts** (150 lines)
```typescript
import { Injectable } from '@nestjs/common';
import { AuthenticatedBotContext, BotContext } from '@app/feature-bot-shared';
import { ProfileActionHandler } from '../../handler/profile-action.handler';

@Injectable()
export class ProfileRouter {
  private readonly actionHandlers!: Map<string, (ctx: BotContext, params: string[]) => Promise<void>>;

  constructor(private readonly profileHandler: ProfileActionHandler) {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.actionHandlers = new Map([
      ['view', async (ctx) => this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext)],
      ['edit', this.handleProfileEdit.bind(this)],
      ['details', async (ctx) => this.profileHandler.handleProfileDetails(ctx as AuthenticatedBotContext)],
      ['verify', async (ctx) => this.profileHandler.handleVerification(ctx as AuthenticatedBotContext)],
      // ... other profile actions
    ]);
  }

  async route(ctx: BotContext, action: string, params: string[]): Promise<void> {
    const handler = this.actionHandlers.get(action || 'view');
    if (handler) {
      await handler(ctx, params);
    } else {
      await this.profileHandler.handleProfileView(ctx as AuthenticatedBotContext);
    }
  }

  private async handleProfileEdit(ctx: BotContext, params: string[]): Promise<void> {
    if (params.length > 0) {
      await ctx.reply(ctx.t('profile.enter_new_field', { field: params[0] }));
      if (ctx.session) {
        ctx.session.conversationState = 'profile_edit_field';
        ctx.session.formData = { field: params[0] };
      }
    } else {
      await this.profileHandler.handleProfileEditStart(ctx as AuthenticatedBotContext);
    }
  }
}
```

#### Files to Create:
1. `monorepo/libs/feature/bot/main/src/handler/routers/menu-router.ts`
2. `monorepo/libs/feature/bot/main/src/handler/routers/profile-router.ts`
3. `monorepo/libs/feature/bot/main/src/handler/routers/balance-router.ts`
4. `monorepo/libs/feature/bot/main/src/handler/routers/order-router.ts`
5. `monorepo/libs/feature/bot/main/src/handler/routers/settings-router.ts`
6. `monorepo/libs/feature/bot/main/src/handler/routers/index.ts`
7. `monorepo/libs/feature/bot/main/src/handler/handlers/admin-handler.ts`
8. `monorepo/libs/feature/bot/main/src/handler/handlers/campaign-handler.ts`
9. `monorepo/libs/feature/bot/main/src/handler/handlers/export-handler.ts`
10. `monorepo/libs/feature/bot/main/src/handler/handlers/traffic-handler.ts`

#### Testing:
```bash
# Test all callback routing still works
pnpm run test libs/feature/bot
pnpm run lint libs/feature/bot
```

---

## 2. High Priority Fixes

### Issue #3: Type Assertions in bot.service.ts

**File:** `monorepo/libs/feature/bot/main/src/service/bot.service.ts`
**Lines:** 91, 347, 454
**Severity:** ⚠️ High
**Effort:** 3-4 hours
**Risk:** Medium - Requires Grammy type system understanding

#### Problem:
```typescript
// Line 91
this.bot.use(BotAuthMiddleware.create(...) as any);

// Line 347
this.bot.use(this.orderHandler.getComposer() as any);

// Line 454
return { ... } as unknown as BotContext;
```

#### Solution: Use Generic Middleware Type

**1. Update BotAuthMiddleware:**
```typescript
// monorepo/libs/feature/bot/main/src/middleware/bot-auth.middleware.ts

import { Middleware } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

@Injectable()
export class BotAuthMiddleware {
  // Change return type to Middleware<BotContext>
  static create(
    botUserService: BotUserService,
    botSessionService: BotSessionService,
  ): Middleware<BotContext> {
    const middleware = new BotAuthMiddleware(botUserService, botSessionService);
    return middleware.middleware.bind(middleware) as Middleware<BotContext>;
  }

  async middleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
    // ... existing code
  }
}
```

**2. Update bot.service.ts to use BotContext:**
```typescript
// Change from Bot<BotSessionContext> to Bot<BotContext>
import { Bot, Middleware } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotContext> | null = null;  // Changed type

  async initialize(): Promise<void> {
    // Create bot with BotContext
    this.bot = new Bot<BotContext>(botToken);

    // Install session middleware
    this.bot.use(session({ initial: () => ({}) }));

    // Install i18n middleware
    this.bot.use(createGrammyI18nMiddleware(this.i18n));

    // Install authentication middleware - NO TYPE ASSERTION
    const authMiddleware = BotAuthMiddleware.create(
      this.botUserService,
      this.botSessionService
    );
    this.bot.use(authMiddleware);

    // Install error handling
    this.bot.catch(async (err) => {
      const { ctx } = err;
      const error = err.error as Error;
      this.logger.error('Bot error occurred', {
        error: error.message,
        stack: err.stack,
        userId: ctx.user?.id,
        messageText: ctx.message?.text,
      });
      await this.handleError(error, ctx);
    });

    // Register handlers
    this.registerCommandHandlers();
    this.registerCallbackHandlers();
    this.registerFeatureHandlers();
  }

  private registerCommandHandlers(): void {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      await this.processCommand(ctx, BotCommand.Start);  // No mapping needed
    });

    this.bot.command('help', async (ctx) => {
      await this.processCommand(ctx, BotCommand.Help);
    });

    this.bot.command('profile', protectHandler(async (ctx) => {
      await this.processCommand(ctx, BotCommand.Profile);
    }));

    // ... other commands
  }

  private registerFeatureHandlers(): void {
    if (!this.bot) return;

    // Get composer with proper type
    const orderComposer = this.orderHandler.getComposer();
    this.bot.use(orderComposer);  // No type assertion
  }

  // Remove mapContextToBotContext method - no longer needed
  async processCommand(ctx: BotContext, command: BotCommand): Promise<void> {
    // ctx is already BotContext - no mapping needed
    try {
      this.logger.debug(`Processing command: ${command}`, {
        userId: ctx.from?.id,
        command,
      });

      if (!ctx.from && command !== BotCommand.Start) {
        await this.sendAuthenticationRequired(ctx);
        return;
      }

      const handler = this.commandHandlers[command];
      if (handler) {
        await handler(ctx);
      } else {
        await this.handleUnknownCommand(ctx);
      }
    } catch (err: unknown) {
      this.logger.error('Error processing command', {
        command,
        error: unknownToError(err),
        userId: ctx.from?.id,
      });
      await this.handleError(err as Error, ctx);
    }
  }
}
```

**3. Update OrderHandler to return proper type:**
```typescript
// monorepo/libs/feature/bot/main/src/features/order/order.handler.ts

import { Composer } from 'grammy';
import { BotContext } from '@app/feature-bot-shared';

@Injectable()
export class OrderHandler {
  private composer: Composer<BotContext>;

  constructor() {
    this.composer = new Composer<BotContext>();
    this.registerHandlers();
  }

  getComposer(): Composer<BotContext> {
    return this.composer;
  }

  private registerHandlers(): void {
    this.composer.command('order', async (ctx) => {
      // ... handler code
    });
  }
}
```

#### Files to Modify:
1. `monorepo/libs/feature/bot/main/src/middleware/bot-auth.middleware.ts`
2. `monorepo/libs/feature/bot/main/src/service/bot.service.ts`
3. `monorepo/libs/feature/bot/main/src/features/order/order.handler.ts`

#### Testing:
```bash
pnpm run build
pnpm run test
pnpm run lint
```

---

### Issue #4: Missing API Endpoints

**Priority:** ⚠️ High
**Effort:** 3-5 days
**Risk:** Low - New code, no breaking changes

Create the following controllers to match bot functionality:

#### 4.1: SettingsController

**File:** `monorepo/libs/feature/user/main/src/controller/settings.controller.ts`

```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  UserSettingsDto,
  UpdateLanguageDto,
  UpdateThemeDto,
  UpdatePrivacyDto,
} from '../dto';
import { SettingsService } from '../service/settings.service';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@CurrentUserId() userId: string): AsyncResult<UserSettingsDto, InternalException> {
    const result = await this.settingsService.getSettings(userId);
    return Ok(result);
  }

  @Patch('language')
  @ApiOperation({ summary: 'Update language preference' })
  @ApiResponse({ status: 200, description: 'Language updated successfully' })
  async updateLanguage(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateLanguageDto,
  ): AsyncResult<UserSettingsDto, InternalException> {
    const result = await this.settingsService.updateLanguage(userId, dto.language);
    return Ok(result);
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Update theme preference' })
  @ApiResponse({ status: 200, description: 'Theme updated successfully' })
  async updateTheme(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateThemeDto,
  ): AsyncResult<UserSettingsDto, InternalException> {
    const result = await this.settingsService.updateTheme(userId, dto.theme);
    return Ok(result);
  }

  @Patch('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings updated successfully' })
  async updatePrivacy(
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePrivacyDto,
  ): AsyncResult<UserSettingsDto, InternalException> {
    const result = await this.settingsService.updatePrivacy(userId, dto);
    return Ok(result);
  }
}
```

**DTOs to create:**
```typescript
// monorepo/libs/feature/user/shared/src/dto/settings.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export class UserSettingsDto {
  @ApiProperty()
  language!: string;

  @ApiProperty()
  theme!: string;

  @ApiProperty()
  showBalance!: boolean;

  @ApiProperty()
  showReferrals!: boolean;

  @ApiProperty()
  enableNotifications!: boolean;
}

export class UpdateLanguageDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  language!: string;
}

export class UpdateThemeDto {
  @ApiProperty({ example: 'dark' })
  @IsEnum(['light', 'dark', 'auto'])
  theme!: string;
}

export class UpdatePrivacyDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  showBalance?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  showReferrals?: boolean;
}
```

#### 4.2: AdminController

**File:** `monorepo/libs/feature/admin/main/src/controller/admin.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException, UnauthorizedException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok, Err } from 'ts-results';
import { AdminGuard } from '../guard/admin.guard';
import {
  AdminStatsDto,
  UserManagementDto,
  OrderManagementDto,
} from '../dto';
import { AdminService } from '../service/admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiProblemExceptions([
  [InternalException, { description: 'Internal server error occurred' }],
  [UnauthorizedException, { description: 'Admin access required' }],
])
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(
    @CurrentUserId() userId: string,
  ): AsyncResult<AdminStatsDto, InternalException | UnauthorizedException> {
    const result = await this.adminService.getStats(userId);
    return Ok(result);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(
    @CurrentUserId() userId: string,
  ): AsyncResult<UserManagementDto[], InternalException | UnauthorizedException> {
    const result = await this.adminService.getUsers(userId);
    return Ok(result);
  }

  @Post('users/:userId/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 200, description: 'User blocked successfully' })
  async blockUser(
    @CurrentUserId() adminId: string,
    @Param('userId') userId: string,
  ): AsyncResult<{ success: boolean }, InternalException | UnauthorizedException> {
    const result = await this.adminService.blockUser(adminId, userId);
    return Ok(result);
  }
}
```

**Create AdminGuard:**
```typescript
// monorepo/libs/feature/admin/main/src/guard/admin.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { UserRepository } from '@app/database';
import { UnauthorizedException } from '@app/common-exception';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
  };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException({ detail: 'Authentication required' });
    }

    const user = await this.userRepository.findOne({ id: userId });

    if (!user) {
      throw new UnauthorizedException({ detail: 'User not found' });
    }

    // Check if user has admin role
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new UnauthorizedException({ detail: 'Admin access required' });
    }

    return true;
  }
}
```

#### 4.3: AnalyticsController

**File:** `monorepo/libs/feature/balance/main/src/controller/analytics.controller.ts`

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  BalanceAnalyticsDto,
  PerformanceMetricsDto,
} from '../dto';
import { AnalyticsService } from '../service/analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get balance analytics' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to analyze (default: 30)' })
  @ApiResponse({ status: 200, description: 'Balance analytics retrieved successfully' })
  async getBalanceAnalytics(
    @CurrentUserId() userId: string,
    @Query('days') days?: number,
  ): AsyncResult<BalanceAnalyticsDto, InternalException> {
    const result = await this.analyticsService.getBalanceAnalytics(userId, days || 30);
    return Ok(result);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  async getPerformanceMetrics(
    @CurrentUserId() userId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): AsyncResult<PerformanceMetricsDto, InternalException> {
    const result = await this.analyticsService.getPerformanceMetrics(userId, { fromDate, toDate });
    return Ok(result);
  }
}
```

#### 4.4: SecurityController (Login History)

**File:** `monorepo/libs/feature/user/main/src/controller/security.controller.ts`

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CurrentUserId, JwtAuthGuard } from '@app/feature-auth-shared';
import { ApiProblemExceptions, InternalException } from '@app/common-exception';
import { AsyncResult } from '@app/common-shared';
import { Ok } from 'ts-results';
import {
  LoginHistoryDto,
  SecurityOverviewDto,
} from '../dto';
import { SecurityService } from '../service/security.service';

@ApiTags('security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiProblemExceptions([[InternalException, { description: 'Internal server error occurred' }]])
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('login-history')
  @ApiOperation({ summary: 'Get login history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50)' })
  @ApiResponse({ status: 200, description: 'Login history retrieved successfully' })
  async getLoginHistory(
    @CurrentUserId() userId: string,
    @Query('limit') limit?: number,
  ): AsyncResult<LoginHistoryDto[], InternalException> {
    const result = await this.securityService.getLoginHistory(userId, limit || 50);
    return Ok(result);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get security overview' })
  @ApiResponse({ status: 200, description: 'Security overview retrieved successfully' })
  async getSecurityOverview(
    @CurrentUserId() userId: string,
  ): AsyncResult<SecurityOverviewDto, InternalException> {
    const result = await this.securityService.getSecurityOverview(userId);
    return Ok(result);
  }
}
```

#### Files to Create:
1. Settings: 3 files (controller, service, DTOs)
2. Admin: 5 files (controller, service, guard, DTOs, module)
3. Analytics: 3 files (controller, service, DTOs)
4. Security: 3 files (controller, service, DTOs)

Total: 14 new files

#### Testing:
```bash
# Test new endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/settings
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/admin/stats
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/analytics/balance
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/security/login-history
```

---

## 3. Medium Priority Fixes

### Issue #5: Weak Admin Authorization

**File:** `monorepo/libs/feature/bot/main/src/handler/callback-router.handler.ts`
**Line:** 1046
**Severity:** ⚠️ Medium
**Effort:** 1 hour
**Risk:** Low

#### Current Code (WRONG):
```typescript
if (!user.isVerified) {
  await ctx.reply('⛔️ Access denied. Admin privileges required.');
  return;
}
```

#### Fixed Code:
```typescript
// 1. Add UserRole enum to database
// monorepo/libs/database/src/entity/user.entity.ts

export enum UserRole {
  User = 'user',
  Moderator = 'moderator',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

@Entity({ tableName: 'users' })
export class UserEntity extends BaseEntity {
  // ... existing fields

  @Enum({ items: () => UserRole, default: UserRole.User })
  @Index()
  role!: UserRole;
}

// 2. Update admin check in callback router
if (!user.role || (user.role !== UserRole.Admin && user.role !== UserRole.SuperAdmin)) {
  await ctx.reply('⛔️ Access denied. Admin privileges required.');
  return;
}
```

#### Files to Modify:
1. `monorepo/libs/database/src/entity/user.entity.ts`
2. `monorepo/libs/feature/bot/main/src/handler/callback-router.handler.ts`
3. Create migration for role column

#### Migration:
```bash
pnpm run migration:create add_user_role_column
```

```typescript
// Generated migration file
import { Migration } from '@mikro-orm/migrations';

export class Migration20251107000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "users"
      ADD COLUMN "role" VARCHAR(50) NOT NULL DEFAULT 'user';
    `);

    this.addSql(`
      CREATE INDEX "users_role_index" ON "users" ("role");
    `);

    // Optionally promote first user to super admin
    this.addSql(`
      UPDATE "users"
      SET "role" = 'super_admin'
      WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX "users_role_index";`);
    this.addSql(`ALTER TABLE "users" DROP COLUMN "role";`);
  }
}
```

#### Testing:
```bash
# Run migration
pnpm run migration:run

# Test admin access
/admin  # Should check role properly
```

---

### Issue #6: API Key Rate Limiting

**Severity:** ⚠️ Medium
**Effort:** 2 hours
**Risk:** Low

#### Create API Key Throttler Guard:

**File:** `monorepo/libs/feature/traffic/shared/src/guard/api-key-throttler.guard.ts`

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { TooManyRequestsException } from '@app/common-exception';

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: FastifyRequest): Promise<string> {
    // Extract API key from request body (for POST endpoints)
    const body = req.body as Record<string, unknown> | undefined;
    const apiKey = body?.apiKey as string | undefined;

    if (apiKey) {
      return `api-key:${apiKey}`;
    }

    // Fallback to IP-based tracking
    const ip = (req.headers['cf-connecting-ip'] as string) ??
               (req.headers['x-real-ip'] as string) ??
               req.ip;

    return `ip:${ip}`;
  }

  protected override throwThrottlingException(context: ExecutionContext): void {
    throw new TooManyRequestsException({
      detail: 'Rate limit exceeded for this API key. Please try again later.',
    });
  }
}
```

#### Apply to Public API Controller:

```typescript
// monorepo/libs/feature/traffic/main/src/controller/traffic-source-public.controller.ts

import { ApiKeyThrottlerGuard } from '@app/feature-traffic-shared';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Traffic Source - Public API')
@Controller('source')
@UseGuards(ApiKeyThrottlerGuard)  // Apply API key throttler
@Throttle({ default: { limit: 100, ttl: 60000 } })  // 100 req/min per API key
export class TrafficSourcePublicController {
  // ... existing code
}
```

#### Testing:
```bash
# Test rate limiting
for i in {1..110}; do
  curl -X POST http://localhost:3000/source/tasks \
    -H "Content-Type: application/json" \
    -d '{"apiKey":"test-key-123"}'
done
# Should get 429 after 100 requests
```

---

## 4. Low Priority Fixes

### Issue #7: Hardcoded Strings

**Severity:** ℹ️ Low
**Effort:** 2-3 days
**Risk:** Very Low

#### Strategy:

Replace hardcoded strings with i18n keys:

**Before:**
```typescript
const message = `Выбери нужный пункт 👇`;
```

**After:**
```typescript
const message = ctx.t('menu.select_option');
```

#### Translation Files:

**Create:** `monorepo/apps/bot/resources/i18n/ru.json`
```json
{
  "menu": {
    "select_option": "Выбери нужный пункт 👇",
    "main": "Главное меню",
    "profile": "Профиль",
    "balance": "Баланс",
    "settings": "Настройки"
  },
  "commands": {
    "help_text": "Доступные команды:\n/start - Запустить бота\n..."
  }
}
```

**Create:** `monorepo/apps/bot/resources/i18n/en.json`
```json
{
  "menu": {
    "select_option": "Choose an option 👇",
    "main": "Main Menu",
    "profile": "Profile",
    "balance": "Balance",
    "settings": "Settings"
  },
  "commands": {
    "help_text": "Available Commands:\n/start - Start the bot\n..."
  }
}
```

#### Files to Update:
- All command handlers in `bot.service.ts`
- All action handlers in callback router
- Menu handlers

---

## Implementation Timeline

### Week 1: Critical Fixes
- **Day 1-2**: Fix manual handler instantiation (#1)
- **Day 3-5**: Split large callback router file (#2)

### Week 2: High Priority Fixes
- **Day 1-2**: Fix type assertions (#3)
- **Day 3-5**: Create SettingsController + DTOs (#4.1)

### Week 3: More API Endpoints
- **Day 1-2**: Create AdminController + Guard (#4.2)
- **Day 3**: Create AnalyticsController (#4.3)
- **Day 4**: Create SecurityController (#4.4)
- **Day 5**: Testing and documentation

### Week 4: Medium Priority
- **Day 1**: Fix admin authorization with roles (#5)
- **Day 2**: Add API key rate limiting (#6)
- **Day 3-5**: Testing and refinement

### Week 5+: Low Priority
- **Ongoing**: Replace hardcoded strings with i18n (#7)

---

## Testing Checklist

### Critical Fixes
- [ ] All bot commands work without errors
- [ ] No null reference errors in handlers
- [ ] Dependency injection working properly
- [ ] All callback routes function correctly
- [ ] File sizes are under 500 lines

### High Priority Fixes
- [ ] Type assertions removed
- [ ] Bot compiles without errors
- [ ] All new API endpoints return correct responses
- [ ] Swagger documentation generated correctly
- [ ] Proper authentication on protected endpoints

### Medium Priority Fixes
- [ ] Admin role check works correctly
- [ ] Non-admin users cannot access admin panel
- [ ] API key rate limiting works per key
- [ ] Rate limits are enforced correctly

### Low Priority Fixes
- [ ] All strings use i18n keys
- [ ] Multiple languages supported
- [ ] Translations load correctly

---

## Risk Assessment

| Fix | Risk Level | Mitigation |
|-----|-----------|------------|
| #1 Manual instantiation | Low | Thorough testing of all commands |
| #2 Split large file | Medium | Keep original as backup, test routing |
| #3 Type assertions | Medium | Test with TypeScript strict mode |
| #4 New API endpoints | Low | New code, doesn't affect existing |
| #5 Admin authorization | Low | Careful migration, test role checks |
| #6 API key limiting | Low | Test with multiple keys |
| #7 i18n strings | Very Low | Gradual replacement, test rendering |

---

## Rollback Plan

If any fix causes issues:

1. **Immediate**: Revert the specific commit
```bash
git revert <commit-hash>
git push
```

2. **For file splits**: Keep original file as `.backup` until testing complete

3. **For database changes**: Run down migration
```bash
pnpm run migration:revert
```

4. **For API changes**: API versioning allows old endpoints to remain

---

## Success Metrics

### Code Quality
- ✅ No `any` types in codebase
- ✅ No type assertions (except `as const`)
- ✅ All files under 500 lines
- ✅ 100% proper dependency injection

### Feature Parity
- ✅ All bot features have API equivalents
- ✅ Settings management via API
- ✅ Admin panel via API
- ✅ Analytics via API
- ✅ Security/login history via API

### Security
- ✅ Role-based admin access
- ✅ Per-API-key rate limiting
- ✅ All endpoints properly authenticated

### Performance
- ✅ O(1) routing with Maps
- ✅ Efficient callback handling
- ✅ No performance regressions

---

## Conclusion

This action plan provides comprehensive fixes for all issues identified in the audit. Prioritize critical and high-priority fixes first, then move to medium and low priority items.

Each fix includes:
- Detailed code examples
- Testing requirements
- Risk assessment
- Rollback plan

Follow the weekly timeline for systematic implementation.

---

**End of Action Plan**
