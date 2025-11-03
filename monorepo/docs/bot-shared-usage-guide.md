# Bot Shared Library - Usage Guide

## Overview

The `@app/feature-bot-shared` library provides essential services and utilities for Telegram bot development in the monorepo. This guide covers the newly implemented bot instance management and subscription validation features.

## Table of Contents

1. [BotFactoryService](#botfactoryservice)
2. [BotSubscriptionService](#botsubscriptionservice)
3. [Integration Examples](#integration-examples)
4. [Configuration](#configuration)
5. [Testing](#testing)

---

## BotFactoryService

The `BotFactoryService` manages bot instance creation and token validation.

### Features

- ✅ Create authenticated bot instances with tokens from `.env`
- ✅ Create unauthenticated bot instances for testing
- ✅ Validate bot tokens using Telegram's `getMe` API
- ✅ Retrieve bot information and capabilities

### Installation

Import the service in your module:

```typescript
import { BotSharedModule } from '@app/feature-bot-shared';

@Module({
  imports: [BotSharedModule],
  // ...
})
export class YourModule {}
```

### Usage Examples

#### 1. Create Bot with Token from Config

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotFactoryService } from '@app/feature-bot-shared';

@Injectable()
export class YourService {
  constructor(
    private readonly botFactory: BotFactoryService,
    private readonly configService: ConfigService,
  ) {}

  async createBot() {
    // Get token from environment configuration
    const botToken = this.configService.get<string>('BOT_TOKEN');

    // Create bot instance with options
    const bot = this.botFactory.createBot(botToken, {
      enableSession: true,
      enableRetry: true,
      apiTimeout: 5000, // 5 seconds
    });

    return bot;
  }
}
```

#### 2. Create Unauthenticated Bot (for Testing)

```typescript
async createMockBot() {
  // Create bot without valid token (useful for unit tests)
  const mockBot = this.botFactory.createUnauthenticatedBot({
    enableSession: false,
  });

  return mockBot;
}
```

#### 3. Validate Bot Token

```typescript
async validateToken(token: string) {
  const result = await this.botFactory.validateBotToken(token);

  if (result.isValid) {
    console.log('✅ Token is valid!');
    console.log('Bot username:', result.botInfo?.username);
    console.log('Bot ID:', result.botInfo?.id);
    console.log('Can join groups:', result.botInfo?.canJoinGroups);
  } else {
    console.error('❌ Token is invalid:', result.error);
    console.error('Error code:', result.errorCode);
  }

  return result;
}
```

#### 4. Get Bot Information

```typescript
async getBotDetails() {
  const token = this.configService.get<string>('BOT_TOKEN');
  const bot = this.botFactory.createBot(token);

  const info = await this.botFactory.getBotInfo(bot);

  console.log('Bot Information:');
  console.log('- ID:', info.id);
  console.log('- Username:', info.username);
  console.log('- First Name:', info.firstName);
  console.log('- Supports inline queries:', info.supportsInlineQueries);

  return info;
}
```

---

## BotSubscriptionService

The `BotSubscriptionService` checks user subscriptions to Telegram groups, supergroups, and channels.

### Features

- ✅ Check if user is subscribed to a chat (group/supergroup/channel)
- ✅ Bulk check subscriptions across multiple chats
- ✅ Verify admin/creator status
- ✅ Retrieve chat information and member counts

### Usage Examples

#### 1. Check Single Subscription

```typescript
import { Injectable } from '@nestjs/common';
import { BotSubscriptionService } from '@app/feature-bot-shared';

@Injectable()
export class SubscriptionGuard {
  constructor(private readonly subscriptionService: BotSubscriptionService) {}

  async checkUserSubscription(botToken: string, chatId: string, userId: number) {
    const result = await this.subscriptionService.checkSubscription(
      botToken,
      chatId, // Can be @username or numeric ID like -1001234567890
      userId,
    );

    if (result.isSubscribed) {
      console.log('✅ User is subscribed!');
      console.log('Status:', result.status); // member, administrator, creator
      console.log('Is admin:', result.isAdmin);
    } else {
      console.log('❌ User is not subscribed');
      console.log('Status:', result.status); // left, kicked, restricted
    }

    return result.isSubscribed;
  }
}
```

#### 2. Check Multiple Subscriptions (Required Channels)

```typescript
async checkRequiredChannels(botToken: string, userId: number) {
  const requiredChannels = [
    '@mychannel',
    '@myotherchannel',
    -1001234567890, // Numeric chat ID
  ];

  const result = await this.subscriptionService.checkMultipleSubscriptions(
    botToken,
    requiredChannels,
    userId,
  );

  if (result.isSubscribedToAll) {
    console.log('✅ User is subscribed to ALL required channels');
  } else {
    console.log('❌ User is missing some subscriptions:');
    console.log('Missing channels:', result.unsubscribedChats);
  }

  return result;
}
```

#### 3. Check Admin Status

```typescript
async verifyAdmin(botToken: string, chatId: string, userId: number) {
  const isAdmin = await this.subscriptionService.isUserAdmin(
    botToken,
    chatId,
    userId,
  );

  if (isAdmin) {
    console.log('✅ User is an administrator');
  } else {
    console.log('❌ User is not an administrator');
  }

  return isAdmin;
}
```

#### 4. Get Chat Information

```typescript
async getChatDetails(botToken: string, chatId: string) {
  const chatInfo = await this.subscriptionService.getChatInfo(botToken, chatId);

  console.log('Chat Information:');
  console.log('- ID:', chatInfo.id);
  console.log('- Type:', chatInfo.type); // channel, supergroup, group, private
  console.log('- Title:', chatInfo.title);
  console.log('- Username:', chatInfo.username);
  console.log('- Is Forum:', chatInfo.isForum);

  // Get member count
  const memberCount = await this.subscriptionService.getChatMemberCount(
    botToken,
    chatId,
  );
  console.log('- Members:', memberCount);

  return chatInfo;
}
```

---

## Integration Examples

### Example 1: Subscription-Gated Feature

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotSubscriptionService } from '@app/feature-bot-shared';

@Injectable()
export class PremiumFeatureService {
  private readonly requiredChannels = ['@premiumchannel', '@newschannel'];

  constructor(
    private readonly subscriptionService: BotSubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  async checkAccess(userId: number): Promise<boolean> {
    const botToken = this.configService.get<string>('BOT_TOKEN');

    const result = await this.subscriptionService.checkMultipleSubscriptions(
      botToken,
      this.requiredChannels,
      userId,
    );

    if (!result.isSubscribedToAll) {
      throw new UnauthorizedException(
        `Please subscribe to these channels first: ${result.unsubscribedChats.join(', ')}`,
      );
    }

    return true;
  }

  async executePremiumFeature(userId: number, data: any) {
    // Verify subscription first
    await this.checkAccess(userId);

    // Execute premium feature
    console.log('Executing premium feature for user:', userId);
    // ... your logic here
  }
}
```

### Example 2: Bot Initialization with Validation

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotFactoryService } from '@app/feature-bot-shared';

@Injectable()
export class BotInitService implements OnModuleInit {
  private readonly logger = new Logger(BotInitService.name);

  constructor(
    private readonly botFactory: BotFactoryService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeBot();
  }

  private async initializeBot() {
    const botToken = this.configService.get<string>('BOT_TOKEN');

    if (!botToken) {
      this.logger.error('BOT_TOKEN is not configured in environment');
      return;
    }

    // Validate token first
    this.logger.log('Validating bot token...');
    const validation = await this.botFactory.validateBotToken(botToken);

    if (!validation.isValid) {
      this.logger.error('Bot token validation failed:', validation.error);
      return;
    }

    this.logger.log(`✅ Bot validated: @${validation.botInfo?.username}`);

    // Create bot instance
    const bot = this.botFactory.createBot(botToken, {
      enableSession: true,
      enableRetry: true,
      apiTimeout: 10000,
    });

    this.logger.log('Bot instance created successfully');

    // Start bot
    await bot.start();
    this.logger.log('Bot is running!');
  }
}
```

### Example 3: Middleware for Subscription Check

```typescript
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BotSubscriptionService } from '@app/feature-bot-shared';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionMiddleware implements NestMiddleware {
  constructor(
    private readonly subscriptionService: BotSubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.id; // Assumes authentication middleware ran first

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const botToken = this.configService.get<string>('BOT_TOKEN');
    const requiredChannel = this.configService.get<string>('REQUIRED_CHANNEL');

    const result = await this.subscriptionService.checkSubscription(
      botToken,
      requiredChannel,
      userId,
    );

    if (!result.isSubscribed) {
      throw new ForbiddenException(
        `Please subscribe to ${requiredChannel} to access this feature`,
      );
    }

    next();
  }
}
```

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Bot Configuration
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Optional: Custom Telegram Bot API server
BOT_API_ROOT=https://api.telegram.org

# Optional: Required subscription channels (comma-separated)
REQUIRED_CHANNELS=@channel1,@channel2,-1001234567890

# Optional: API timeout in milliseconds
BOT_API_TIMEOUT=5000
```

### NestJS ConfigService Integration

```typescript
// config/bot.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('bot', () => ({
  token: process.env.BOT_TOKEN,
  apiRoot: process.env.BOT_API_ROOT,
  apiTimeout: parseInt(process.env.BOT_API_TIMEOUT || '5000', 10),
  requiredChannels: process.env.REQUIRED_CHANNELS?.split(',') || [],
}));
```

---

## Testing

### Unit Test Example: BotFactoryService

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BotFactoryService } from '@app/feature-bot-shared';

describe('BotFactoryService', () => {
  let service: BotFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotFactoryService],
    }).compile();

    service = module.get<BotFactoryService>(BotFactoryService);
  });

  it('should create a bot with valid token', () => {
    const bot = service.createBot('123456:ABC-DEF', {
      enableSession: true,
    });

    expect(bot).toBeDefined();
  });

  it('should create unauthenticated bot for testing', () => {
    const bot = service.createUnauthenticatedBot();

    expect(bot).toBeDefined();
  });
});
```

### Integration Test Example: Subscription Check

```typescript
import { Test } from '@nestjs/testing';
import { BotSubscriptionService } from '@app/feature-bot-shared';

describe('Subscription Integration Test', () => {
  let service: BotSubscriptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BotSubscriptionService],
    }).compile();

    service = module.get<BotSubscriptionService>(BotSubscriptionService);
  });

  it('should check user subscription (requires valid bot token)', async () => {
    const botToken = process.env.BOT_TOKEN;
    const testChatId = '@testchannel';
    const testUserId = 123456789;

    const result = await service.checkSubscription(botToken, testChatId, testUserId);

    expect(result).toBeDefined();
    expect(result.isSubscribed).toBeDefined();
    expect(result.status).toBeDefined();
  });
});
```

---

## API Reference

### BotFactoryService

| Method                  | Parameters                                    | Returns                        | Description                       |
| ----------------------- | --------------------------------------------- | ------------------------------ | --------------------------------- |
| `createBot`             | `token: string, options?: BotInstanceOptions` | `Bot<BotSessionContext>`       | Create authenticated bot instance |
| `createUnauthenticatedBot` | `options?: BotInstanceOptions`             | `Bot<BotSessionContext>`       | Create unauthenticated bot        |
| `validateBotToken`      | `token: string`                               | `Promise<BotValidationResult>` | Validate token using getMe API    |
| `getBotInfo`            | `bot: Bot<BotSessionContext>`                 | `Promise<BotInstanceInfo>`     | Retrieve bot information          |

### BotSubscriptionService

| Method                      | Parameters                                                   | Returns                                | Description                      |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------- | -------------------------------- |
| `checkSubscription`         | `botToken, chatId, userId`                                   | `Promise<SubscriptionCheckResult>`     | Check single subscription        |
| `checkMultipleSubscriptions` | `botToken, chatIds[], userId`                               | `Promise<BulkSubscriptionCheckResult>` | Check multiple subscriptions     |
| `isUserAdmin`               | `botToken, chatId, userId`                                   | `Promise<boolean>`                     | Check if user is admin           |
| `getChatInfo`               | `botToken, chatId`                                           | `Promise<ChatInformation>`             | Get chat details                 |
| `getChatMemberCount`        | `botToken, chatId`                                           | `Promise<number>`                      | Get chat member count            |

---

## Best Practices

1. **Token Security**: Never hardcode tokens. Always use environment variables.
2. **Error Handling**: Always check `isValid` and `error` fields in validation results.
3. **Rate Limiting**: Be mindful of Telegram API rate limits (especially for subscription checks).
4. **Caching**: Cache subscription check results to avoid excessive API calls.
5. **Testing**: Use `createUnauthenticatedBot()` for unit tests; use real tokens in integration tests.

---

## Support

For issues or questions, contact the development team or refer to:
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Grammy Framework Documentation](https://grammy.dev/)

---

**Last Updated**: 2025-11-03
**Library Version**: `@app/feature-bot-shared@latest`
