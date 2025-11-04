# Bot Shared Feature Library

Shared utilities, types, and services for bot functionality in the Motiv-Buy platform.

## Overview

This library provides common bot-related functionality that can be reused across different bot implementations and
applications:

- **Types & Interfaces**: TypeScript definitions for bot contexts, menus, and sessions
- **DTOs**: Data transfer objects with validation for API interactions
- **Enums**: Standardized enumerations for menu types and bot commands
- **Utilities**: Helper functions for keyboards, callbacks, and data processing

## Key Components

### Types

- **BotContext**: Telegram bot context interface with message and user data
- **MenuConfig**: Menu configuration and button layout definitions
- **SessionInterface**: User session management and state tracking
- **CallbackData**: Callback query data structure and parsing

### DTOs

- **MenuActionDto**: Menu action requests with validation
- **SessionDataDto**: Session data operations and updates
- **ConversationStateDto**: Conversation flow state management

### Enums

- **MenuType**: Available menu types in the bot system
- **BotCommand**: Supported bot commands and their identifiers

### Utilities

- **KeyboardUtil**: Inline and reply keyboard creation helpers
- **CallbackUtil**: Callback data parsing and building utilities

## Usage

### Import types

```typescript
import { BotContext, MenuType, BotCommand } from '@app/feature-bot-shared';
```

### Use utilities

```typescript
import { KeyboardUtil, CallbackUtil } from '@app/feature-bot-shared';

// Create inline keyboard
const keyboard = KeyboardUtil.createInlineKeyboard(menuConfig);

// Parse callback data
const callbackData = CallbackUtil.parseCallbackData(queryData);
```

### Use DTOs

```typescript
import { MenuActionDto, SessionDataDto } from '@app/feature-bot-shared';

const menuAction = new MenuActionDto({
  action: MenuActionType.Navigate,
  menuId: 'profile',
  userId: '123',
  chatId: '456',
});
```

## Module Import

```typescript
import { BotSharedModule } from '@app/feature-bot-shared';

@Module({
  imports: [BotSharedModule],
})
export class MyModule {}
```

## Dependencies

- `@app/common-redis` - Redis integration for session storage
- `@app/database` - Database access for bot data
- `@nestjs/common` - NestJS core functionality
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation

## Design Principles

This shared library follows these principles:

- **Type Safety**: Comprehensive TypeScript definitions
- **Reusability**: Generic utilities that work across implementations
- **Validation**: Strong input validation for all DTOs
- **Documentation**: Complete JSDoc coverage for all public APIs

## Testing

Run tests with:

```bash
npm run test:feature-bot-shared
```
