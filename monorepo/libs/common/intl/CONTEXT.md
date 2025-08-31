# Internationalization (Intl)

## Purpose and Responsibilities
The `intl` library provides comprehensive internationalization (i18n) support for xRocket's multi-language platform. It offers translation management, language resolution, custom decorators for injection, and context-aware translation services supporting English, Russian, and Chinese languages across all microservices.

## Key Components

### AppCommonIntlModule
- **I18n Configuration**: Sets up nestjs-i18n with fallback language and file watching
- **Resolver Integration**: Configures language resolvers for different contexts
- **Translation Loading**: Manages translation file loading from i18n directory
- **Global Configuration**: Provides centralized i18n configuration for all services

### AppI18nContext
- **Enhanced Translation**: Extended I18nContext with additional translation methods
- **Context Management**: Manages i18n context creation and lifecycle
- **Type Safety**: Provides type-safe translation methods
- **Convenience Methods**: Simplified `tr()` method for common translation needs

### Language Resolvers
- **BotLangResolver**: Resolves language from bot context for Telegram integrations
- **AcceptLanguageResolver**: Standard HTTP Accept-Language header resolution
- **Context-Aware**: Resolves language based on execution context

### I18n Decorator
- **Parameter Injection**: Custom decorator for injecting i18n context into controllers
- **Context Extraction**: Automatically extracts and creates i18n context
- **Type Safety**: Provides strongly-typed i18n context injection

## Dependencies

### External Dependencies
- `nestjs-i18n` - NestJS internationalization framework
- `@nestjs/common` - NestJS core functionality

### Internal Dependencies
- `@app/common-shared` - Default language configuration and shared utilities

## Integration Points

### Microservice Integration
Used across all xRocket services for:
- **User Interface**: Web and mobile application translations
- **Bot Responses**: Telegram bot message localization
- **Email Templates**: Multi-language email communications
- **Error Messages**: Localized error responses
- **API Responses**: Internationalized API response messages

### Service Usage
- **Web Controllers**: HTTP endpoint response localization
- **Bot Controllers**: Telegram bot message translations
- **Email Services**: Email template localization
- **Notification Services**: Push notification translations

## Usage Patterns

### Controller Integration
```typescript
import { I18n, AppI18nContext } from '@app/common-intl';

@Controller('users')
export class UserController {
  @Get('profile')
  async getUserProfile(@I18n() i18n: AppI18nContext) {
    return {
      message: i18n.tr('user.profile.welcome', { 
        name: 'John' 
      }),
      title: i18n.tr('user.profile.title')
    };
  }

  @Post('create')
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @I18n() i18n: AppI18nContext
  ) {
    try {
      const user = await this.userService.create(createUserDto);
      return {
        message: i18n.tr('user.created.success'),
        user
      };
    } catch (error) {
      throw new BadRequestException(
        i18n.tr('user.created.error')
      );
    }
  }
}
```

### Bot Integration
```typescript
import { BotLangResolver } from '@app/common-intl';

@Injectable()
export class TelegramBotService {
  constructor(
    private readonly i18n: I18nService
  ) {}

  async sendWelcomeMessage(ctx: TelegramContext) {
    const i18nContext = AppI18nContext.getI18nContext(ctx);
    
    const welcomeMessage = i18nContext.tr('bot.welcome', {
      username: ctx.from.username
    });
    
    await ctx.reply(welcomeMessage);
  }

  async sendBalanceInfo(ctx: TelegramContext, balance: BigNumber) {
    const i18nContext = AppI18nContext.getI18nContext(ctx);
    
    const balanceMessage = i18nContext.tr('bot.balance.info', {
      amount: balance.toString(),
      currency: 'USD'
    });
    
    await ctx.reply(balanceMessage);
  }
}
```

### Service-Level Translation
```typescript
@Injectable()
export class EmailService {
  constructor(
    private readonly i18n: I18nService
  ) {}

  async sendTransactionNotification(
    user: User, 
    transaction: Transaction
  ) {
    const subject = this.i18n.t('email.transaction.subject', {
      lang: user.language,
      args: { amount: transaction.amount }
    });

    const body = this.i18n.t('email.transaction.body', {
      lang: user.language,
      args: {
        username: user.name,
        amount: transaction.amount,
        currency: transaction.currency
      }
    });

    await this.sendEmail(user.email, subject, body);
  }
}
```

### Translation Files Structure
```typescript
// i18n/en.json
{
  "user": {
    "profile": {
      "welcome": "Welcome, {{name}}!",
      "title": "User Profile"
    },
    "created": {
      "success": "User created successfully",
      "error": "Failed to create user"
    }
  },
  "bot": {
    "welcome": "Welcome to xRocket, {{username}}!",
    "balance": {
      "info": "Your balance: {{amount}} {{currency}}"
    }
  },
  "email": {
    "transaction": {
      "subject": "Transaction Alert: {{amount}}",
      "body": "Hello {{username}}, your transaction of {{amount}} {{currency}} has been processed."
    }
  }
}

// i18n/ru.json
{
  "user": {
    "profile": {
      "welcome": "Добро пожаловать, {{name}}!",
      "title": "Профиль пользователя"
    },
    "created": {
      "success": "Пользователь успешно создан",
      "error": "Не удалось создать пользователя"
    }
  }
  // ... rest of translations
}
```

## Configuration

### Module Configuration
```typescript
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',           // Default fallback language
      loaderOptions: {
        path: path.join(process.cwd(), 'i18n/'),  // Translation files path
        watch: true,                    // Watch for file changes
      },
      logging: false,                   // Disable i18n logging
      resolvers: [                      // Language resolution strategies
        AcceptLanguageResolver,         // HTTP Accept-Language header
        BotLangResolver                 // Bot context language
      ],
    })
  ]
})
```

### Language Support
```typescript
enum Language {
  en = 'en',    // English
  ru = 'ru',    // Russian
  zh = 'zh'     // Chinese
}

const defaultLanguage = Language.en;
```

## Security Considerations

### Input Validation
- **Translation Key Validation**: Validates translation keys to prevent injection
- **Parameter Sanitization**: Sanitizes translation parameters
- **Context Isolation**: Isolates translation context per request

### Data Protection
- **No Sensitive Data**: Translation files contain no sensitive information
- **Parameter Safety**: Translation parameters are properly escaped
- **Context Security**: User context properly validated before language resolution

## Performance Notes

### Translation Caching
- **File Watching**: Efficient file watching for translation updates
- **Memory Caching**: In-memory caching of loaded translations
- **Lazy Loading**: Translations loaded on demand

### Context Management
- **Lightweight Context**: Minimal overhead for context creation
- **Resolver Efficiency**: Fast language resolution strategies
- **Memory Management**: Proper cleanup of translation contexts

## Development Notes

### Architecture Pattern
Implements **Internationalization Strategy** pattern:
1. **Centralized Translations**: All translations managed in central location
2. **Context-Aware Resolution**: Language resolved based on execution context
3. **Type-Safe Translations**: Compile-time validation of translation usage

### Translation Key Convention
```typescript
// Hierarchical key structure
'feature.component.action.status'

// Examples:
'user.profile.welcome'           // User profile welcome message
'bot.balance.insufficient'       // Bot insufficient balance message
'email.verification.subject'     // Email verification subject
'error.validation.required'      // Validation error message
```

### Language Resolution Priority
1. **Bot Context**: Language from bot user context (Telegram)
2. **Accept-Language**: HTTP Accept-Language header
3. **Fallback**: Default language (English)

### Context Types
```typescript
interface BaseI18nContext {
  lang: Language;      // Resolved language
  i18n: I18nService;   // Translation service instance
}

class AppI18nContext extends I18nContext {
  tr(key: string, options?: TranslateOptions): string;
  // Simplified translation method
}
```

### Best Practices
- **Key Consistency**: Use consistent naming conventions for translation keys
- **Parameter Validation**: Validate translation parameters before interpolation
- **Fallback Strategy**: Always provide fallback translations
- **Context Awareness**: Use appropriate language resolvers for different contexts
- **File Organization**: Organize translation files by feature/module

### Extension Guidelines
- **New Languages**: Add new language files and update Language enum
- **Custom Resolvers**: Implement I18nResolver interface for custom resolution logic
- **Translation Validation**: Implement validation for required translation keys
- **Dynamic Loading**: Consider dynamic loading for large translation sets
