# Internationalization (i18n) Library

## Overview

Feature-separated internationalization system for MotivBuy using nestjs-i18n.

## Structure

```
libs/common/intl/
├── locales/
│   ├── en/                    # English translations
│   │   ├── common.json        # Common strings (errors, buttons, etc.)
│   │   ├── auth.json          # Authentication
│   │   ├── bot.json           # Bot features (largest file)
│   │   ├── balance.json       # Balance management
│   │   ├── payment.json       # Payment processing
│   │   ├── traffic.json       # Traffic management
│   │   ├── statistic.json     # Statistics
│   │   └── user.json          # User management
│   └── ru/                    # Russian translations (same structure)
├── src/
│   ├── i18n.loader.ts         # Loads and merges feature files
│   ├── common-intl.module.ts  # NestJS module
│   ├── decorator/             # Custom decorators
│   ├── plugin/                # Grammy.js i18n plugin
│   └── resolver/              # Language resolvers
└── CONTEXT.md                 # This file
```

## Translation Keys

Total: 570+ keys (285 EN + 285 RU)

### Key Organization

Keys follow the pattern: `{feature}.{section}.{key}`

Examples:
- `common.error`
- `common.errors.not_found`
- `common.success.saved`
- `auth.authentication_required`
- `bot.menu.main`
- `bot.order.creation`
- `balance.title`
- `payment.success`

## Usage

### In Bot Handlers (Grammy.js Context)

```typescript
// Simple key
await ctx.reply(ctx.t('common.error'));

// With parameters
await ctx.reply(ctx.t('bot.order.order_number', { id: '123' }));

// With HTML parsing
await ctx.replyWithHTML(ctx.t('bot.commands.welcome_back', { name: userName }));
```

### In Services (I18nService)

```typescript
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class MyService {
  constructor(private readonly i18n: I18nService) {}

  someMethod() {
    throw new Error(this.i18n.t('common.errors.not_found'));
  }
}
```

### In Controllers (with language context)

```typescript
import { I18nService } from 'nestjs-i18n';

@Controller('api')
export class MyController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  async getData(@I18nLang() lang: string) {
    const message = this.i18n.t('common.success', { lang });
    return { message };
  }
}
```

## Key Features

### Feature Separation
- Each feature has its own JSON file
- Common strings shared across features in `common.json`
- Easy to maintain and extend

### I18nLoader
- Automatically loads all feature files
- Merges them into a single namespace
- Handles missing files gracefully

### Language Detection
- Bot: Uses user's Telegram language
- API: Uses Accept-Language header
- Fallback to English

### Full Bilingual Support
- English (en) - default
- Russian (ru) - complete

## Important Rules

1. **NO plain text in code** - Everything must use i18n keys
2. **Key naming** - Use descriptive, hierarchical keys
3. **Consistency** - Reuse common keys when possible
4. **Both languages** - Always update EN and RU together
5. **Emojis** - Can be included in translations for visual appeal

## Common Keys Available

### Errors (common.errors.*)
- not_found
- access_denied
- invalid_input
- unauthorized
- user_not_found
- authentication_required
- feature_not_available
- payment_failed
- balance_invalid
- And 20+ more...

### Success (common.success.*)
- saved
- updated
- deleted
- created
- completed

### Buttons (common.buttons.*)
- back, next, previous
- confirm, cancel, close
- save, delete, edit
- create, add, remove
- And more...

## Implementation Status

✅ Infrastructure: 100% complete
✅ Locale files: 16 files (8 EN + 8 RU)
✅ Translation keys: 570+
✅ Bot handlers: 100% internationalized
✅ Services: 100% using i18n
✅ Documentation: Complete

## Adding New Keys

1. Add key to appropriate feature file (e.g., `locales/en/bot.json`)
2. Add same key to Russian file (`locales/ru/bot.json`)
3. Use in code: `ctx.t('bot.feature.new_key')` or `this.i18n.t('bot.feature.new_key')`
4. Test both languages

## Notes

- Grammar.js bot context has `ctx.t()` automatically injected
- Services need `I18nService` injected in constructor
- All keys are type-safe (when using generated types)
- Missing keys fall back to the key name itself
- HTML formatting supported in bot messages

