# Bot Flow Refactor Summary

## Overview
Successfully refactored the bot to use **message editing** instead of sending new messages on every callback. This provides a much better user experience with a single, constantly-updating message interface.

## Changes Made

### 1. MessageService (`libs/feature/bot/main/src/service/message.service.ts`)
- **New service** that wraps Telegram's `sendMessage` and `editMessageText`
- Automatically detects if a message exists and either:
  - Edits the existing message (if `callbackQuery.message.message_id` exists)
  - Sends a new message (if no message exists)
- Handles edge cases:
  - Message not modified (silent success)
  - Message not found (sends new message)
- Provides utility methods:
  - `sendOrEditMessage()` - Smart send/edit based on context
  - `sendNewMessage()` - Always send new
  - `editMessage()` - Edit existing
  - `deleteMessage()` - Delete message

### 2. Updated Module Exports
- Added `MessageService` to `BotMainModule` providers and exports
- Updated `callback-router.handler.ts` to inject and use `MessageService`

### 3. Updated All Handlers
Replaced `ctx.reply()` and `ctx.replyWithHTML()` calls with `messageService.sendOrEditMessage()`:

#### Main Handlers Updated:
- **profile-action.handler.ts** - Profile view
- **balance-action.handler.ts** - Balance view
- **statistics-action.handler.ts** - Statistics overview
- **order-action.handler.ts** - Active/completed orders
- **settings-action.handler.ts** - Settings view
- **callback-router.handler.ts** - All menu displays (main, orders, referrals, payments, support, help)

#### Before:
```typescript
await ctx.replyWithHTML(profileText, { reply_markup: keyboard });
```

#### After:
```typescript
await this.messageService.sendOrEditMessage(ctx, {
  text: profileText,
  parseMode: 'HTML',
  replyMarkup: keyboard,
});
```

## Benefits

### 1. **Better UX**
- Single message thread instead of spam
- Cleaner chat history
- Consistent interface

### 2. **Performance**
- Reduced message count
- Lower API usage
- Faster interactions

### 3. **Maintainability**
- Centralized message handling
- Consistent error handling
- Easier to add new features

## How It Works

1. User clicks a button → Callback query triggered
2. `MessageService.sendOrEditMessage()` called
3. Service checks: `ctx.callbackQuery?.message?.message_id`
4. If message exists → Edit it
5. If no message → Send new
6. All subsequent clicks continue editing the same message

## Testing

To test the bot:
```bash
# Start bot in development mode
npm run dev:bot

# Or build and run
npm run build:bot
npm run start:bot
```

## Notes

- The bot uses `callbackQuery.message` to get the current message ID
- No session storage needed for message IDs
- Gracefully handles edge cases (message not found/modified)
- Pre-existing payment module build issues are unrelated to this refactor

## Files Changed

1. ✅ Created: `libs/feature/bot/main/src/service/message.service.ts`
2. ✅ Modified: `libs/feature/bot/main/src/bot-main.module.ts`
3. ✅ Modified: `libs/feature/bot/main/src/handler/callback-router.handler.ts`
4. ✅ Modified: `libs/feature/bot/main/src/handler/profile-action.handler.ts`
5. ✅ Modified: `libs/feature/bot/main/src/handler/balance-action.handler.ts`
6. ✅ Modified: `libs/feature/bot/main/src/handler/statistics-action.handler.ts`
7. ✅ Modified: `libs/feature/bot/main/src/handler/order-action.handler.ts`
8. ✅ Modified: `libs/feature/bot/main/src/handler/settings-action.handler.ts`

## Verification

- ✅ No TypeScript errors in bot-main module
- ✅ All handlers updated to use MessageService
- ✅ MessageService properly integrated into module
- ✅ Build dependencies satisfied (except pre-existing payment issues)

The bot flow is now fully refactored to use message editing instead of sending new messages!
