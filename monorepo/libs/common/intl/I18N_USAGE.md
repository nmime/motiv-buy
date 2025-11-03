# I18n Usage Guide

Complete guide for using internationalization in both Bot and API.

## 📋 Table of Contents

- [Bot Usage (Grammy)](#bot-usage-grammy)
- [API Usage (NestJS Controllers)](#api-usage-nestjs-controllers)
- [Adding New Translations](#adding-new-translations)
- [Changing User Language](#changing-user-language)
- [Examples](#examples)

---

## 🤖 Bot Usage (Grammy)

### Setup

The i18n plugin is added to Grammy bot automatically. It provides:
- `ctx.t()` - Translation function
- `ctx.language` - Current user language

### Integration

```typescript
// In BotService (libs/feature/bot/main/src/service/bot.service.ts)
import { createGrammyI18nMiddleware } from '@app/common-intl';

export class BotService {
  constructor(
    private readonly i18nService: I18nService,
    // ... other services
  ) {}

  async start() {
    const bot = new Bot<BotContext>(token);

    // Add i18n middleware BEFORE other middlewares
    bot.use(createGrammyI18nMiddleware(this.i18nService));

    // Add session middleware
    bot.use(session({ initial: () => ({}) }));

    // Your handlers...
    this.setupHandlers(bot);

    await bot.start();
  }
}
```

### Usage in Handlers

```typescript
// Simple translation
bot.command('start', (ctx) => {
  const message = ctx.t('order.main_menu.title');
  ctx.reply(message);
});

// Translation with parameters
bot.command('stats', (ctx) => {
  const message = ctx.t('order.order_list.total_count', { count: 42 });
  ctx.reply(message); // "Всего заказов: 42" (if Russian)
});

// Access current language
bot.command('language', (ctx) => {
  ctx.reply(`Your language: ${ctx.language}`); // 'ru' or 'en'
});

// In services (inject I18nService)
export class OrderService {
  constructor(private readonly i18n: I18nService) {}

  getMessage(ctx: BotContext): string {
    // Use ctx.language to get user's language
    return this.i18n.t('order.errors.invalid_link', {
      lang: ctx.language,
    });
  }
}
```

### Language Detection

Language is detected automatically in this order:
1. **Session language** (if user previously set it)
2. **Telegram user language_code** (from user profile)
3. **Default language** (English)

### Changing Language

```typescript
import { changeUserLanguage } from '@app/common-intl';

bot.command('lang_ru', (ctx) => {
  const success = changeUserLanguage(ctx, 'ru');
  ctx.reply(success ? '✅ Язык изменён на русский' : '❌ Ошибка');
});

bot.command('lang_en', (ctx) => {
  const success = changeUserLanguage(ctx, 'en');
  ctx.reply(success ? '✅ Language changed to English' : '❌ Error');
});
```

---

## 🌐 API Usage (NestJS Controllers)

### Setup

The `@I18n()` decorator is available immediately after importing `AppCommonIntlModule`.
It uses the `Accept-Language` HTTP header.

### Usage in Controllers

```typescript
import { I18n, ApiI18nContext } from '@app/common-intl';

@Controller('orders')
export class OrderController {
  /**
   * Example 1: Simple translation
   */
  @Post()
  async createOrder(
    @I18n() i18n: ApiI18nContext,
    @Body() dto: CreateOrderDto,
  ) {
    // Translate using user's language from Accept-Language header
    const successMessage = i18n.t('order.success.order_created');

    return {
      message: successMessage, // "✅ Заказ создан успешно!" or "✅ Order created successfully!"
    };
  }

  /**
   * Example 2: Translation with parameters
   */
  @Delete(':id')
  async deleteOrder(
    @I18n() i18n: ApiI18nContext,
    @Param('id') id: string,
  ) {
    // Translation with interpolation
    const errorMessage = i18n.t('order.errors.moderation_rejected', {
      reason: 'spam detected',
    });

    throw new BadRequestException(errorMessage);
  }

  /**
   * Example 3: Access user language
   */
  @Get('status')
  async getStatus(@I18n() i18n: ApiI18nContext) {
    return {
      language: i18n.language, // 'ru', 'en', etc.
      message: i18n.t('order.view_order.status'),
    };
  }

  /**
   * Example 4: Override language
   */
  @Get('messages')
  async getMessages(@I18n() i18n: ApiI18nContext) {
    return {
      userLanguage: i18n.t('order.main_menu.title'), // User's language
      russian: i18n.tWithLang('order.main_menu.title', 'ru'), // Force Russian
      english: i18n.tWithLang('order.main_menu.title', 'en'), // Force English
    };
  }

  /**
   * Example 5: Check if translation exists
   */
  @Get('validate')
  async validateKey(@I18n() i18n: ApiI18nContext, @Query('key') key: string) {
    const exists = i18n.exists(key);
    return { key, exists };
  }
}
```

### Alternative: Get Language Only

If you only need the language code without translation function:

```typescript
import { Lang } from '@app/common-intl';

@Get('language')
async getLanguage(@Lang() lang: string) {
  return { language: lang }; // 'ru' or 'en'
}
```

### Client-Side Headers

Clients should send the `Accept-Language` header:

```bash
# cURL example
curl -H "Accept-Language: ru-RU,ru;q=0.9,en;q=0.8" \
  https://api.example.com/orders

# Axios example
axios.get('/orders', {
  headers: {
    'Accept-Language': navigator.language, // Browser language
  },
});

# Fetch API example
fetch('/orders', {
  headers: {
    'Accept-Language': 'ru',
  },
});
```

---

## 📝 Adding New Translations

### File Structure

```
libs/common/intl/locales/
├── en/
│   └── order.json      # English translations
└── ru/
    └── order.json      # Russian translations
```

### Adding Translations

1. **Edit both locale files** (`ru/order.json` and `en/order.json`)

2. **Use nested keys** for organization:

```json
{
  "order": {
    "creation": {
      "title": "Creating New Order",
      "step": "Step {{current}} of {{total}}"
    },
    "errors": {
      "invalid_link": "❌ Invalid link format"
    }
  }
}
```

3. **Use interpolation** for dynamic values:

```json
{
  "order_list": {
    "total_count": "Total orders: {{count}}"
  }
}
```

### Usage

```typescript
// Bot
ctx.t('order.creation.title'); // "Creating New Order"
ctx.t('order.creation.step', { current: 2, total: 4 }); // "Step 2 of 4"

// API
i18n.t('order.creation.title');
i18n.t('order.creation.step', { current: 2, total: 4 });
```

---

## 🔄 Changing User Language

### In Bot

```typescript
import { changeUserLanguage, getSupportedLanguages } from '@app/common-intl';

// Change language
bot.command('language', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('🇷🇺 Русский', 'lang:ru')
    .text('🇬🇧 English', 'lang:en');

  ctx.reply('Choose language / Выберите язык:', {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^lang:(.+)$/, async (ctx) => {
  const lang = ctx.match[1];
  const success = changeUserLanguage(ctx, lang);

  if (success) {
    const message = ctx.t('settings.language_changed');
    await ctx.answerCallbackQuery(message);
    await ctx.editMessageText(message);
  }
});

// Get supported languages
const languages = getSupportedLanguages(); // ['en', 'ru', 'es', ...]
```

### In API

The API uses the `Accept-Language` header, so language changes are handled client-side.

```typescript
// Client changes language preference
localStorage.setItem('language', 'ru');

// All API requests include the header
axios.defaults.headers.common['Accept-Language'] = localStorage.getItem('language');
```

---

## 📚 Complete Examples

### Example 1: Order Creation Handler

```typescript
// libs/feature/bot/main/src/features/order/handlers/order.creation.handler.ts

export class OrderCreationHandler {
  async handleCreateOrder(ctx: BotContext) {
    // Use ctx.t() directly - language is automatic
    const message = ctx.t('order.creation.channel_link.instruction');

    const keyboard = new InlineKeyboard()
      .text(ctx.t('order.buttons.back'), 'order:list');

    await ctx.reply(message, { reply_markup: keyboard });
  }

  async handleChannelLink(ctx: BotContext) {
    const link = ctx.message?.text;

    if (!this.isValidLink(link)) {
      // Error message in user's language
      await ctx.reply(ctx.t('order.errors.invalid_link'));
      return;
    }

    // Success message with parameter
    const channel = await this.getChannelInfo(link);
    const message = ctx.t('order.creation.bot_admin.channel_found');

    await ctx.reply(message);
  }
}
```

### Example 2: API Error Handling

```typescript
// libs/feature/order/main/src/controller/order.controller.ts

@Controller('orders')
export class OrderController {
  @Post()
  async createOrder(
    @I18n() i18n: ApiI18nContext,
    @Body() dto: CreateOrderDto,
  ) {
    // Validate
    if (!dto.channelLink) {
      throw new BadRequestException(
        i18n.t('order.errors.invalid_link'),
      );
    }

    // Check permissions
    if (!hasPermission) {
      throw new ForbiddenException(
        i18n.t('order.errors.access_denied'),
      );
    }

    // Create order
    const order = await this.orderService.create(dto);

    // Return success
    return {
      message: i18n.t('order.success.order_created'),
      order,
    };
  }
}
```

### Example 3: Service with I18n

```typescript
// If you need i18n in a service (less common)

@Injectable()
export class OrderMessagesService {
  constructor(private readonly i18n: I18nService) {}

  getErrorMessage(errorKey: string, language: string): string {
    return this.i18n.t(`order.errors.${errorKey}`, { lang: language });
  }

  getSuccessMessage(successKey: string, language: string): string {
    return this.i18n.t(`order.success.${successKey}`, { lang: language });
  }
}

// Usage in handler
const message = this.messagesService.getErrorMessage('invalid_link', ctx.language);
```

---

## 🎯 Best Practices

1. **Always use translation keys**, never hardcode text
2. **Pass `ctx` to services** so they can access `ctx.language`
3. **Use descriptive keys**: `order.errors.invalid_link` instead of `err1`
4. **Keep translations synchronized** between languages
5. **Use interpolation** for dynamic content
6. **Test both languages** before deploying

---

## 🔍 Debugging

### Check current language:

```typescript
// Bot
console.log('Language:', ctx.language);
console.log('Session:', ctx.session?.language);
console.log('Telegram:', ctx.from?.language_code);

// API
console.log('Language:', i18n.language);
console.log('Header:', request.headers['accept-language']);
```

### Verify translation exists:

```typescript
// Bot
const exists = ctx.t('order.test.key') !== 'order.test.key';

// API
const exists = i18n.exists('order.test.key');
```

---

## 🚀 Quick Reference

| Context | Translation | Language | Change Language |
|---------|-------------|----------|-----------------|
| **Bot** | `ctx.t(key, options)` | `ctx.language` | `changeUserLanguage(ctx, 'ru')` |
| **API** | `i18n.t(key, options)` | `i18n.language` | Client-side header |
| **Service** | `i18n.t(key, { lang, args })` | Pass from context | N/A |

---

## ✅ Supported Languages

Current supported languages (from `libs/common/shared/src/types/language.enum.ts`):
- `en` - English
- `ru` - Russian
- `es` - Spanish
- `fr` - French
- `de` - German
- `zh` - Chinese
- `ja` - Japanese
- `ko` - Korean

To add a new language:
1. Create `libs/common/intl/locales/{lang}/order.json`
2. Add to `Language` enum
3. Restart the application
