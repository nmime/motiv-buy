# I18n Setup Guide - Feature-Separated Locales

## 📋 Overview

All translations have been reorganized into **feature-separated locale files** for better maintainability and scalability. Each feature (auth, user, balance, payment, traffic, statistic, bot) has its own translation files.

## 📁 Structure

```
libs/common/intl/locales/
├── en/
│   ├── common.json      # Shared translations
│   ├── auth.json        # Authentication feature
│   ├── user.json        # User/Profile feature
│   ├── balance.json     # Balance feature
│   ├── payment.json     # Payment feature
│   ├── traffic.json     # Traffic feature
│   ├── statistic.json   # Statistic feature
│   └── bot.json         # Bot feature (orders, menus, commands)
└── ru/
    ├── common.json
    ├── auth.json
    ├── user.json
    ├── balance.json
    ├── payment.json
    ├── traffic.json
    ├── statistic.json
    └── bot.json
```

## 🔄 How It Works

The `I18nLoader` automatically loads all feature files for a given language and merges them into a single namespace. When you request a translation, it searches across all features.

### Usage in Code

```typescript
// Bot Usage
ctx.t('bot.menu.main');                    // "📋 Main Menu"
ctx.t('common.buttons.back');              // "◀️ Back"
ctx.t('auth.welcome');                     // "👋 Welcome to MotivBuy!"

// API Controllers
i18n.t('balance.title');                   // "💰 Balance"
i18n.t('payment.error');                   // "❌ Payment error"
i18n.t('traffic.sources');                 // "📊 Traffic Sources"
```

## 📝 Translation Key Naming Convention

Each feature file uses a consistent naming pattern:

### Common (Shared)
```json
{
  "common": { ... },
  "buttons": { ... },
  "errors": { ... },
  "success": { ... }
}
```

### Feature-Specific
```json
{
  "auth": { ... },
  "user": { ... },
  "balance": { ... },
  // etc
}
```

## ✅ Key Namespaces

### common.json
- `common.*` - General UI elements (currency, loading, errors)
- `buttons.*` - Reusable button text
- `errors.*` - Common error messages
- `success.*` - Common success messages

### auth.json
- `auth.welcome` - Welcome message
- `auth.authentication_required` - Auth required message
- `auth.login_success` - Login success
- `auth.user_not_found` - User not found

### user.json
- `user.profile.*` - Profile management
- `user.settings.*` - User settings

### balance.json
- `balance.title` - Balance section title
- `balance.withdrawal_status` - Withdrawal status
- `balance.history` - Transaction history

### payment.json
- `payment.title` - Payment title
- `payment.providers.*` - Payment providers
- `payment.error` - Payment errors

### traffic.json
- `traffic.title` - Traffic title
- `traffic.sources` - Traffic sources
- `traffic.orders` - Traffic orders

### statistic.json
- `statistic.title` - Statistics title
- `statistic.earnings` - Earnings section
- `statistic.traffic` - Traffic section

### bot.json
Contains multiple sub-sections:
- `bot.menu.*` - Menu navigation
- `bot.commands.*` - Bot commands
- `bot.order.*` - Order management
- `bot.configuration.*` - Order configuration
- `bot.status.*` - Order statuses
- `bot.buttons.*` - Bot-specific buttons

## 🛠️ Adding New Translations

### 1. Identify the Feature
Determine which feature the translation belongs to (auth, user, balance, etc.)

### 2. Add to Both Languages
Update both `en/{feature}.json` and `ru/{feature}.json`:

```json
{
  "feature_name": {
    "new_key": "Translation text with {{interpolation}}"
  }
}
```

### 3. Use in Code
```typescript
const message = ctx.t('feature_name.new_key', { interpolation: 'value' });
```

## 🌍 Supported Languages

- `en` - English
- `ru` - Russian (Русский)

## 📋 Translation Key Examples

### Without Interpolation
```typescript
ctx.t('bot.menu.main')
// Returns: "📋 Main Menu"
```

### With Interpolation
```typescript
ctx.t('balance.history', { page: 1, total: 5 })
// Returns: "Page 1 of 5"
```

### Nested Access
```typescript
ctx.t('bot.status.active')
// Returns: "Active"
```

## 🔍 Key Features

✅ **Feature Separation** - Each feature has its own translation files
✅ **Automatic Loading** - I18nLoader merges all features into one namespace
✅ **Interpolation** - Support for dynamic values using `{{key}}`
✅ **Emojis** - All messages include relevant emojis for better UX
✅ **Bilingual** - Complete translations for English and Russian

## ⚠️ Common Mistakes to Avoid

❌ Hardcoding text instead of using translation keys
❌ Adding plain text to button labels or messages
❌ Not updating both EN and RU locales
❌ Using inconsistent key naming
❌ Forgetting to use `ctx.t()` or `i18n.t()` helpers

## ✨ Best Practices

✅ Always use translation keys for user-facing text
✅ Keep translations consistent between languages
✅ Use descriptive key names
✅ Include emojis in messages for better UX
✅ Use interpolation for dynamic content
✅ Test both languages before deploying
✅ Keep related translations in the same feature file

## 🔗 Related Files

- Main I18n Module: `/libs/common/intl/src/common-intl.module.ts`
- Loader: `/libs/common/intl/src/i18n.loader.ts`
- Bot Usage Guide: `/libs/common/intl/I18N_USAGE.md`
- Locales Directory: `/libs/common/intl/locales/`
