# Bot Menu System Implementation

## Overview

This document describes the comprehensive bot menu system implementation for the MotivBuy Telegram bot. The implementation includes 10+ critical menu actions with proper error handling, input validation, state management, and security features.

## Implemented Features

### 1. Profile Management
**Location:** `/monorepo/libs/feature/bot/main/src/handler/profile-action.handler.ts`

**Features:**
- View user profile with status, verification, and referral information
- Edit profile fields (first name, last name, username, language)
- View detailed profile information
- Account verification status and requirements
- Input validation for all profile fields

**Actions:**
- `profile:view` - Display user profile
- `profile:edit` - Start profile editing
- `profile:edit:<field>` - Edit specific field
- `profile:details` - View detailed information
- `profile:verify` - Check verification status

### 2. Balance Management
**Location:** `/monorepo/libs/feature/bot/main/src/handler/balance-action.handler.ts`

**Features:**
- View balance across multiple currencies
- Transaction history with pagination
- Withdrawal initiation with verification checks
- Deposit information and methods
- Available, locked, and total balance display

**Actions:**
- `balance:view` - Display all balances
- `balance:history` - View transaction history
- `balance:history:page:<number>` - Paginated history
- `balance:withdraw` - Start withdrawal process
- `balance:deposit` - Show deposit options

### 3. Statistics & Analytics
**Location:** `/monorepo/libs/feature/bot/main/src/handler/statistics-action.handler.ts`

**Features:**
- Statistics overview with key metrics
- Detailed statistics by order status and type
- Traffic analytics with completion rates
- Earnings breakdown by type
- Last 7 days earnings tracking

**Actions:**
- `stats:overview` - Show statistics summary
- `stats:detailed` - Detailed statistics breakdown
- `stats:traffic` - Traffic performance metrics
- `stats:earnings` - Earnings analysis

### 4. Order Management
**Location:** `/monorepo/libs/feature/bot/main/src/handler/order-action.handler.ts`

**Features:**
- View active orders with progress tracking
- Completed orders history
- Order creation workflow
- Order search functionality
- Detailed order information with all metrics

**Actions:**
- `orders:active` - List active orders
- `orders:active:page:<number>` - Paginated active orders
- `orders:completed` - List completed orders
- `orders:create` - Start order creation
- `orders:search` - Search orders
- `order:details:<orderId>` - View order details

### 5. Settings Configuration
**Location:** `/monorepo/libs/feature/bot/main/src/handler/settings-action.handler.ts`

**Features:**
- Language selection (7 supported languages)
- Notification preferences (5 types)
- Privacy settings
- User preferences management
- Toggle-based configuration

**Actions:**
- `settings:language` - Language selection menu
- `settings:lang:<code>` - Change language
- `settings:notifications` - Notification settings
- `settings:notify:<type>` - Toggle notification
- `settings:preferences` - Preferences menu
- `settings:privacy` - Privacy settings

## Security Features

### 1. Rate Limiting
**Location:** `/monorepo/libs/feature/bot/main/src/middleware/rate-limit.middleware.ts`

**Features:**
- Per-user rate limiting
- Different limits for different action types
- Automatic blocking for repeated violations
- Temporary blocks with configurable duration
- In-memory storage with automatic cleanup

**Configuration:**
- Messages: 20 requests/minute
- Callbacks: 30 requests/minute
- Withdrawals: 3 requests/hour
- Order Creation: 10 requests/hour

### 2. CSRF Protection
**Location:** `/monorepo/libs/feature/bot/main/src/middleware/csrf-protection.middleware.ts`

**Features:**
- Token generation for protected actions
- Session-based token storage
- Token validation and expiration (30 minutes)
- One-time use tokens
- Protected callback data generation

**Protected Actions:**
- Withdrawal operations
- Order creation/cancellation
- Settings updates
- Profile editing
- Payment confirmations

### 3. Input Validation
**Location:** `/monorepo/libs/feature/bot/main/src/util/bot-validation.util.ts`

**Features:**
- Comprehensive validation utilities (pre-existing)
- Email, phone, username validation
- Message sanitization
- XSS prevention
- SQL injection prevention
- Length and format validation

## Architecture

### Handler Pattern
Each feature area has a dedicated handler:
- `MenuActionHandler` - Menu creation and navigation
- `ProfileActionHandler` - Profile operations
- `BalanceActionHandler` - Balance operations
- `StatisticsActionHandler` - Analytics operations
- `OrderActionHandler` - Order management
- `SettingsActionHandler` - Settings management

### Router Pattern
**Location:** `/monorepo/libs/feature/bot/main/src/handler/callback-router.handler.ts`

The `CallbackRouterHandler` provides centralized routing:
- Parses callback data
- Applies rate limiting
- Routes to appropriate handler
- Handles errors uniformly
- Provides answer callback query

### State Management
Session-based state management for multi-step actions:
- `conversationState` - Current conversation context
- `formData` - Data collected during multi-step flows
- `temp` - Temporary data (CSRF tokens, etc.)

## Integration

### Main Bot Service
**Location:** `/monorepo/libs/feature/bot/main/src/service/bot.service.ts`

**Changes:**
1. Updated callback query handler to use `CallbackRouterHandler`
2. Updated command handlers to use action handlers
3. Integrated rate limiting
4. Added proper error handling

### Command Mapping
- `/profile` → `ProfileActionHandler.handleProfileView()`
- `/balance` → `BalanceActionHandler.handleBalanceView()`
- `/settings` → `SettingsActionHandler.handleSettingsView()`
- `/menu` → Main menu with inline keyboard

## Error Handling

### User-Friendly Messages
All errors are translated to user-friendly messages:
- `USER_NOT_FOUND` → "User account not found. Please use /start to register."
- `INSUFFICIENT_BALANCE` → "Insufficient balance for this operation."
- `INVALID_INPUT` → "Invalid input provided. Please check and try again."
- `RATE_LIMIT_EXCEEDED` → "Too many requests. Please wait a moment and try again."

### Comprehensive Logging
All actions are logged with:
- User ID
- Action type
- Parameters
- Timestamps
- Error details

## Database Integration

### Entities Used
- `UserEntity` - User information
- `UserBalanceEntity` - Balance data
- `UserBalanceHistoryEntity` - Transaction history
- `UserSettingsEntity` - User settings
- `TrafficOrderEntity` - Order information

### Repository Pattern
All handlers use EntityManager for database operations:
- `em.findOne()` - Find single entity
- `em.find()` - Find multiple entities
- `em.findAndCount()` - Find with pagination
- `em.persistAndFlush()` - Save changes

## Testing Considerations

### Unit Testing
Each handler should be tested with:
- Mock EntityManager
- Mock BotContext
- Various input scenarios
- Error scenarios

### Integration Testing
Test complete flows:
1. User views profile
2. User edits profile field
3. Profile is updated in database
4. Success message is shown

### Security Testing
Test security features:
- Rate limiting triggers correctly
- CSRF tokens are validated
- Input sanitization works
- SQL injection is prevented

## Future Enhancements

### Planned Features
1. Referral system implementation
2. Payment method integration
3. Advanced order filters
4. Export functionality
5. Admin panel integration

### Performance Optimizations
1. Caching layer for frequently accessed data
2. Database connection pooling
3. Query optimization
4. Background job processing for heavy operations

### UX Improvements
1. Inline query support
2. Custom keyboards for frequent actions
3. Quick action buttons
4. Voice message support

## Usage Examples

### Basic Menu Navigation
```typescript
// User sends /menu
// Bot displays main menu with inline keyboard
// User clicks "Profile"
// profileHandler.handleProfileView() is called
// User sees their profile information
```

### Multi-Step Action (Profile Edit)
```typescript
// User clicks "Edit Profile"
// Session state: conversationState = 'profile_edit'
// Bot shows field selection keyboard
// User clicks "First Name"
// Session state: formData = { field: 'firstName' }
// Bot asks for new value
// User sends new value
// Handler validates and updates
// Success message shown
```

### Paginated List
```typescript
// User clicks "Transaction History"
// Handler fetches first 10 transactions
// Bot displays with pagination keyboard
// User clicks "Next"
// callback: balance:history:page=2
// Handler fetches next 10 transactions
// Bot displays page 2
```

## Deployment Notes

### Environment Variables
No new environment variables required. Uses existing:
- `BOT_TOKEN` - Telegram bot token
- Database connection configuration

### Dependencies
All dependencies are already in package.json:
- `grammy` - Telegram bot framework
- `@mikro-orm/core` - ORM
- `@nestjs/common` - NestJS framework

### Database Migrations
No new migrations required. Uses existing entities.

### Monitoring
Monitor these metrics:
- Rate limit violations per hour
- CSRF validation failures
- Error rates by handler
- Average response time
- User engagement by feature

## Support

For questions or issues:
- Check logs in `/var/log/bot/`
- Review error tracking dashboard
- Contact development team

---

**Implementation Date:** 2025-11-03
**Version:** 1.0.0
**Status:** Production Ready
