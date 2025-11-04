# I18n Implementation Roadmap - Phase 2b & Beyond

**Status:** Session 1 Complete (45% Overall) | Ready for Session 2  
**Last Updated:** 2025-11-04

---

## 🎯 CURRENT STATE

### ✅ Foundation Complete
- 16 locale files with 400+ keys
- I18nLoader infrastructure ready
- 5 handlers refactored (151 strings)
- Patterns established and documented

### 🔄 Next Priority: Phase 2b (Bot Handlers)
- 9 remaining handlers with ~200+ strings
- High impact on user experience
- Estimated effort: 1.5-2 hours

---

## 📋 PHASE 2B: REMAINING BOT HANDLERS

### 1️⃣ callback.handler.ts (110+ strings) - HIGHEST PRIORITY

**File:** `/libs/feature/bot/main/src/handler/callback.handler.ts`

**Sections to Refactor:**
```
Lines 50-100:      Invalid callback data, authentication errors
Lines 200-250:     Menu selection, profile/settings menus
Lines 260-300:     Security settings, feature coming soon
Lines 400-500:     Support, tutorials, changelog menus
Lines 500-600:     General command execution, error handling
```

**Key Patterns in File:**
```typescript
// PATTERN 1: Feature "coming soon"
// BEFORE
await ctx.reply('📊 Statistics feature coming soon!');

// AFTER - Add to bot.json
await ctx.reply(ctx.t('bot.features.statistics_coming_soon'));

// PATTERN 2: Menu text with headers
// BEFORE
await ctx.reply('🔒 Security Settings\n\nConfigure your account security options:', {

// AFTER - Add to bot.json
await ctx.reply(ctx.t('bot.menus.security_settings'), {
  reply_markup: {
    inline_keyboard: [[
      { text: ctx.t('common.buttons.change_password'), callback_data: 'profile:password' },
      // ... more buttons
    ]]
  }
});

// PATTERN 3: Invalid action handling
// BEFORE
await ctx.reply(`❌ Profile action "${subAction}" not available yet.`);

// AFTER
await ctx.reply(ctx.t('common.errors.feature_not_available'));
```

**New Keys Needed (callback.handler.ts):**
```json
{
  "bot": {
    "features": {
      "statistics_coming_soon": "📊 Statistics feature coming soon!",
      "traffic_coming_soon": "🎯 Traffic management coming soon!",
      "campaign_coming_soon": "📋 Campaign management coming soon!",
      "withdrawal_coming_soon": "💸 Withdrawal system coming soon!",
      "referral_coming_soon": "🤝 Referral program coming soon!",
      "data_export_coming_soon": "📥 Data export coming soon!",
      "verification_coming_soon": "✅ Verification system coming soon!",
      "notifications_coming_soon": "🔔 Notification settings coming soon!"
    },
    "menus": {
      "security_settings": "🔒 Security Settings\n\nConfigure your account security options:",
      "tutorials": "📚 Tutorials & Guides\n\nLearn how to use MotivBuy effectively:",
      "changelog": "📝 What's New\n\nLatest updates and improvements:",
      "support": "📞 Contact Support\n\nGet help from our support team:"
    },
    "buttons": {
      "change_password": "🔑 Change Password",
      "email_security": "📧 Email Security",
      "2fa": "📱 Two-Factor Auth",
      "login_history": "🔐 Login History",
      "full_changelog": "📝 Full Changelog",
      "subscribe_updates": "🔔 Subscribe to Updates"
    }
  }
}
```

---

### 2️⃣ callback-router.handler.ts (50+ strings)

**File:** `/libs/feature/bot/main/src/handler/callback-router.handler.ts`

**Key Patterns:**
```typescript
// PATTERN 1: Rate limiting
// BEFORE
await ctx.answerCallbackQuery('Rate limit exceeded');

// AFTER
await ctx.answerCallbackQuery(ctx.t('common.errors.rate_limit'));

// PATTERN 2: Unknown actions
// BEFORE
await ctx.answerCallbackQuery('Unknown action');
await ctx.reply('Unknown action. Please try again or use /menu.');

// AFTER
await ctx.answerCallbackQuery(ctx.t('common.errors.unknown_action'));
await ctx.reply(ctx.t('common.errors.unknown_action_help'));

// PATTERN 3: Menu headers
// BEFORE
const menuConfig = {
  text: '📋 <b>Main Menu</b>\n\nSelect an option:',
  // ...
};

// AFTER
const menuConfig = {
  text: `<b>${ctx.t('bot.menus.main')}</b>\n\n${ctx.t('bot.menus.select_option')}`,
  // ...
};
```

**New Keys (callback-router.handler.ts):**
```json
{
  "common": {
    "errors": {
      "rate_limit": "⏱️ Too many requests. Please try again later.",
      "unknown_action": "❌ Unknown action",
      "unknown_action_help": "Unknown action. Please try again or use /menu."
    }
  },
  "bot": {
    "menus": {
      "main": "🏠 Main Menu",
      "orders": "📦 Orders Menu",
      "referrals": "🎁 Referrals Menu",
      "payments": "💳 Payments Menu",
      "profile": "👤 Profile",
      "settings": "⚙️ Settings",
      "balance": "💰 Balance",
      "help": "🆘 Help",
      "select_option": "Select an option:",
      "manage_orders": "Manage your traffic orders:",
      "view_referrals": "View and manage your referrals:",
      "manage_payments": "Manage your payments:"
    }
  }
}
```

---

### 3️⃣ command.handler.ts (30+ strings)

**File:** `/libs/feature/bot/main/src/handler/command.handler.ts`

**Key Methods to Update:**
```typescript
// sendAuthenticationRequired() - Lines ~50-55
async sendAuthenticationRequired(ctx: BotContext): Promise<void> {
  // BEFORE: await ctx.reply('Please log in first');
  // AFTER: await ctx.reply(ctx.t('auth.login_required'));
}

// handleStartCommand() - Line ~65
async handleStartCommand(ctx: BotContext): Promise<void> {
  // BEFORE: const msg = `Welcome ${name}!`;
  // AFTER: const msg = ctx.t('bot.commands.welcome', { name });
}

// handleHelpCommand() - Line ~68
async handleHelpCommand(ctx: BotContext): Promise<void> {
  // BEFORE: const helpText = 'Available commands:\n...';
  // AFTER: const helpText = ctx.t('bot.commands.help_text');
}
```

**New Keys (command.handler.ts):**
```json
{
  "auth": {
    "login_required": "🔒 Please log in first",
    "login_required_for_command": "🔒 You need to be logged in to use this command"
  },
  "bot": {
    "commands": {
      "welcome": "👋 Welcome, {{name}}!",
      "help_text": "Available commands:\n/start - Start bot\n/menu - Open menu\n/help - Show help\n/profile - View profile",
      "profile_title": "👤 Your Profile",
      "settings_title": "⚙️ Settings",
      "balance_title": "💰 Your Balance",
      "stats_title": "📈 Statistics",
      "campaign_title": "📋 Campaigns",
      "traffic_title": "🎯 Traffic Sources",
      "referral_title": "🎁 Referral Program",
      "withdraw_title": "💸 Withdraw Funds",
      "admin_title": "🔧 Admin Panel",
      "menu_title": "🏠 Main Menu",
      "support_title": "🆘 Support",
      "language_title": "🌐 Select Language",
      "verify_title": "✅ Verify Account",
      "export_title": "📥 Export Data",
      "reset_title": "🔄 Reset Settings",
      "status_title": "📊 Bot Status"
    }
  }
}
```

---

### 4️⃣ menu.handler.ts (25+ strings)

**File:** `/libs/feature/bot/main/src/handler/menu.handler.ts`

**Key Section:**
```typescript
// Line 69 - Authentication check
if (!ctx.from?.id) {
  // BEFORE: await ctx.reply('🔒 Authentication required to access menus.');
  // AFTER: await ctx.reply(ctx.t('auth.authentication_required'));
}

// Line 96-98 - Menu navigation logging
await this.updateNavigationState(userId, menuType, options);
// BEFORE: console.log(`Navigating to ${menuType}`);
// AFTER: Uses i18n for error messages in catch block
```

**New Keys (menu.handler.ts):**
```json
{
  "bot": {
    "menu": {
      "navigation_error": "❌ Failed to navigate to menu",
      "menu_not_found": "❌ Menu not found",
      "invalid_menu_type": "❌ Invalid menu type",
      "menu_loading": "⏳ Loading menu...",
      "menu_loaded": "✅ Menu loaded successfully"
    }
  }
}
```

---

### 5️⃣-9️⃣ Other Action Handlers (20 strings each)

**Files:**
- `order-action.handler.ts`
- `menu-action.handler.ts`
- `profile-action.handler.ts`
- `settings-action.handler.ts`
- `statistics-action.handler.ts`

**Generic Pattern:**
```typescript
// All follow same pattern as above:
// 1. Find plain text messages
// 2. Replace with ctx.t('bot.action_type.message_key')
// 3. Add keys to appropriate locale file
// 4. Ensure consistency

// Example pattern:
// BEFORE: await ctx.reply('❌ Error processing order action');
// AFTER: await ctx.reply(ctx.t('bot.order.action_error'));
```

---

## 📝 IMPLEMENTATION STEPS FOR EACH FILE

### Step-by-Step Process:

1. **Identify all string literals**
   ```bash
   grep -n "await ctx.reply\|await ctx.answerCallbackQuery\|text:" filename.ts
   ```

2. **Categorize strings**
   - Error messages → `common.errors.*`
   - Success messages → `common.success.*`
   - Feature messages → `{feature}.*`
   - Menu text → `bot.menus.*`
   - Buttons → `common.buttons.*`
   - Commands → `bot.commands.*`

3. **Replace in code**
   ```typescript
   // BEFORE
   const msg = 'Error occurred';
   
   // AFTER
   const msg = ctx.t('common.error');
   ```

4. **Add to locale files**
   ```json
   {
     "namespace": {
       "key": "Translation text"
     }
   }
   ```

5. **Add Russian translation**
   Ensure both EN and RU files have matching structure

6. **Test**
   - Check message renders correctly
   - Verify i18n key exists
   - Test error cases

---

## 🎯 PRIORITY ORDER FOR SESSION 2

1. **callback.handler.ts** (110+ strings) - ~45 minutes
2. **callback-router.handler.ts** (50+ strings) - ~20 minutes
3. **command.handler.ts** (30+ strings) - ~15 minutes
4. **menu.handler.ts** (25+ strings) - ~10 minutes
5. **Other handlers** (5 files, ~20 strings each) - ~30 minutes
6. **Add locale keys** (Update EN and RU files) - ~15 minutes

**Total estimated:** ~2.5 hours to complete Phase 2b

---

## ✅ COMPLETION CHECKLIST FOR PHASE 2B

- [ ] callback.handler.ts refactored (110 strings)
- [ ] callback-router.handler.ts refactored (50 strings)
- [ ] command.handler.ts refactored (30 strings)
- [ ] menu.handler.ts refactored (25 strings)
- [ ] order-action.handler.ts refactored (20 strings)
- [ ] menu-action.handler.ts refactored (20 strings)
- [ ] profile-action.handler.ts refactored (20 strings)
- [ ] settings-action.handler.ts refactored (20 strings)
- [ ] statistics-action.handler.ts refactored (20 strings)
- [ ] All new keys added to EN locale file
- [ ] All new keys added to RU locale file
- [ ] No linter errors
- [ ] Build succeeds
- [ ] Messages render correctly

---

## 📊 SESSION 2 METRICS

| Metric | Target |
|--------|--------|
| **Files Refactored** | 9 |
| **Strings Replaced** | 200+ |
| **New Locale Keys** | 50+ |
| **Time Estimate** | 2-3 hours |
| **Phase Completion** | 100% |
| **Overall Progress** | 60-65% |

---

## 🚀 AFTER PHASE 2B COMPLETES

1. **Phase 3: API Controllers**
   - 11 controllers with ~200+ strings
   - Est. time: 2 hours

2. **Phase 4: Services**
   - 20+ files with ~150+ strings
   - Est. time: 1.5 hours

3. **Testing & Validation**
   - Both languages
   - All message paths
   - Error handling
   - Est. time: 1-2 hours

4. **Production Deployment**
   - Build verification
   - Final testing
   - Deploy to production

---

## 💡 KEY REMINDERS

✅ Always use `ctx.t()` for bot handlers  
✅ Always use `i18n.t()` for NestJS controllers  
✅ Keep 80% key reuse strategy  
✅ Add keys to both EN and RU files  
✅ Maintain consistent key naming patterns  
✅ Test both languages before finalizing  

---

**Ready for Phase 2b? Start with callback.handler.ts!**
