# Complete I18n Refactoring Guide - Implementation Ready

**Status:** Phase 2 - 75% Complete | Remaining: ~550 strings across 18 files  
**Date:** 2025-11-04  
**Target Completion:** ~2-3 more hours of systematic refactoring

---

## 📋 REFACTORING PATTERNS & EXAMPLES

### Pattern 1: Reply Messages
```typescript
// BEFORE
await ctx.reply('Hello user');
await ctx.reply('🔒 Authentication required');

// AFTER  
await ctx.reply(ctx.t('auth.authentication_required'));
await ctx.reply(ctx.t('menu.welcome_message'));
```

### Pattern 2: Callback Answers
```typescript
// BEFORE
await ctx.answerCallbackQuery('Error occurred');
await ctx.answerCallbackQuery('✅ Saved');

// AFTER
await ctx.answerCallbackQuery(ctx.t('common.error'));
await ctx.answerCallbackQuery(ctx.t('common.success.saved'));
```

### Pattern 3: Exceptions
```typescript
// BEFORE
throw new BadRequestException('Invalid input');
throw new NotFoundException('User not found');

// AFTER
throw new BadRequestException(this.i18n.t('common.errors.invalid_input', { lang }));
throw new NotFoundException(this.i18n.t('common.errors.not_found', { lang }));
```

### Pattern 4: Menu Messages with HTML
```typescript
// BEFORE
const message = '<b>My Orders</b>\n\nTotal: 5 orders';

// AFTER
const message = `<b>${ctx.t('bot.order.list_title')}</b>\n\n${ctx.t('bot.order.total_count', { count: 5 })}`;
```

---

## 🎯 TRANSLATION KEYS REFERENCE

### Already Available Keys (Use These First!)
- `common.error` - Generic error
- `common.errors.*` - Specific error types
- `common.success.*` - Success message types
- `common.buttons.*` - Button labels
- `auth.*` - Authentication messages
- `balance.*` - Balance operations
- `bot.*` - Bot-specific messages
- `payment.*` - Payment messages
- `traffic.*` - Traffic messages
- `statistic.*` - Statistic messages
- `user.*` - User messages

### Add These Keys When Needed
For messages not yet in locale files, add to `/libs/common/intl/locales/{en,ru}/{feature}.json`:

```json
{
  "feature_name": {
    "new_key": "Translation text",
    "action_result": "{{status}} action result"
  }
}
```

---

## 📁 REMAINING FILES TO REFACTOR

### Phase 2b: Bot Handlers (9 files, ~200 strings)

```
Priority: HIGH - These handlers generate most user messages

1. callback.handler.ts (110+ strings)
   - Menu text generation
   - Feature "coming soon" messages
   - Invalid action responses
   - Button labels in InlineKeyboards

2. callback-router.handler.ts (50+ strings)
   - Rate limit messages
   - Unknown action handling
   - Menu header texts

3. command.handler.ts (30+ strings)
   - Command confirmation messages
   - Help text
   - Command errors

4. menu.handler.ts (25+ strings)
   - Menu navigation text
   - Menu error handling
   - Authentication messages

5-9. Other action handlers (~20 strings each)
   - profile-action.handler.ts
   - settings-action.handler.ts
   - order-action.handler.ts
   - menu-action.handler.ts
   - statistics-action.handler.ts
```

### Phase 3: API Controllers (11 files, ~200 strings)

```
Priority: MEDIUM - Backend endpoints need i18n error messages

1. Payment controllers (2 files)
2. Balance controller (1 file)
3. Traffic controllers (3 files)
4. Statistic controllers (2 files)
5. User controller (1 file)
6. Auth controller (1 file)
7. Other service controllers (1 file)
```

### Phase 4: Services (20 files, ~150 strings)

```
Priority: MEDIUM - Service error messages

Main services to update:
- payment.service.ts
- balance.service.ts
- traffic.service.ts
- statistic.service.ts
- user.service.ts
- auth.service.ts
- bot.service.ts
- menu.service.ts
- And others
```

---

## 🚀 QUICK START FOR REMAINING FILES

### For Each File:

1. **Search & Replace Patterns**
   ```bash
   # Find plain text messages
   grep -n "await ctx.reply\|await ctx.answerCallbackQuery\|throw new" filename.ts
   ```

2. **Refactor Steps**
   - Replace `'plain text'` with `ctx.t('key.name')`
   - Replace hardcoded strings with i18n keys
   - Ensure consistent key naming
   - Add new keys to locale files if needed

3. **Add to Locale Files**
   ```json
   {
     "namespace": {
       "action": "Translation here",
       "result": "Result {{variable}}"
     }
   }
   ```

4. **Test**
   - Verify i18n keys exist
   - Check both EN and RU versions
   - Test message rendering

---

## 📊 ESTIMATED EFFORT

| Phase | Files | Strings | Time | Status |
|-------|-------|---------|------|--------|
| Phase 1 | 12 | 400+ | ~1h | ✅ Done |
| Phase 2a | 5 | 151 | ~1.5h | ✅ Done |
| Phase 2b | 9 | 200+ | ~1.5h | ⏳ Pending |
| Phase 3 | 11 | 200+ | ~2h | ⏳ Pending |
| Phase 4 | 20 | 150+ | ~1.5h | ⏳ Pending |
| **Total** | **57** | **~1100** | **~7.5h** | **45% Done** |

---

## ✅ COMPLETION CHECKLIST

### When Refactoring Each File:
- [ ] Find all plain text messages  
- [ ] Replace with `ctx.t()` or `i18n.t()`
- [ ] Add new keys to EN locale file
- [ ] Add matching Russian translations
- [ ] Verify message rendering
- [ ] Test error cases
- [ ] Check interpolation variables

### Final Validation:
- [ ] Run linter on all files
- [ ] No hardcoded text remains
- [ ] All keys exist in locale files
- [ ] Both EN and RU translations complete
- [ ] Build succeeds
- [ ] No runtime errors

---

## 🔗 KEY RESOURCE FILES

- Locale Files: `/libs/common/intl/locales/{en,ru}/`
- I18n Loader: `/libs/common/intl/src/i18n.loader.ts`
- Usage Guide: `/libs/common/intl/I18N_USAGE.md`
- Setup Guide: `/libs/common/intl/I18N_SETUP_GUIDE.md`

---

## 📝 NEXT STEPS

1. **Continue with remaining handlers** - Follow callback.handler.ts pattern
2. **Refactor API controllers** - Apply same i18n patterns
3. **Update services** - Ensure error messages are localized
4. **Run comprehensive tests** - Both EN and RU languages
5. **Deploy to production** - Full i18n support

---

**Time Estimate for Full Completion:** ~2-3 hours of focused work  
**Current Overall Progress:** ~45%  
**Remaining Work:** ~55%
