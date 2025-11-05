# Bot Main Feature Library

Core business logic module for Telegram bot functionality in the Motiv-Buy platform.

## Overview

This library contains the main business logic for bot operations including:

- Bot orchestration and lifecycle management
- Menu management and navigation
- Session handling and state management
- Command processing and routing
- Callback query handling

## Architecture

The library follows the established domain-driven architecture with clear separation of concerns:

- **Services**: Core business logic for bot operations
- **Handlers**: Request processing and routing logic
- **Composers**: UI composition and menu building logic

## Key Components

### Services

- **BotService**: Core bot orchestration and coordination
- **MenuService**: Menu generation and navigation management
- **SessionService**: User session lifecycle and state management

### Handlers

- **CommandHandler**: Bot command processing and routing
- **MenuHandler**: Menu interaction and navigation handling
- **CallbackHandler**: Inline keyboard callback processing

### Composers

- **MainMenuComposer**: Main menu interface composition
- **AuthComposer**: Authentication flow UI composition

## Usage

### Import the module

```typescript
import { BotMainModule } from '@app/feature-bot-main';

@Module({
  imports: [BotMainModule],
})
export class AppModule {}
```

### Use services

```typescript
import {BotService, MenuService} from '@app/feature-bot-main';

@Injectable()
export class MyBotController {
  constructor(
    private readonly botService: BotService,
    private readonly menuService: MenuService,
  ) {
  }
}
```

## Dependencies

- `@app/feature-bot-shared` - Shared types and utilities
- `@app/database` - Database access layer
- `@nestjs/common` - NestJS core functionality

## Testing

Run tests with:

```bash
npm run test:feature-bot-main
```

## Development

This library follows the established coding standards:

- TypeScript strict mode
- Comprehensive JSDoc documentation
- Service-oriented architecture
- Dependency injection patterns
