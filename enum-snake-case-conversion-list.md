# Enum Snake_Case Conversion List

**Generated:** 2025-11-05
**Scope:** All enums in `monorepo/libs` directory
**Criteria:** Exclude ISO standard codes (currency codes, country codes as values)

## Summary

Total enum definitions analyzed: **73**
Enums requiring conversion: **7**
Enum values requiring conversion: **~250+**

---

## ✅ Already Correct (No Changes Needed)

These enums already use proper snake_case format:

### Database Entities
- `ProviderStatus` - SCREAMING_SNAKE_CASE (`ACTIVE`, `INACTIVE`, `MAINTENANCE`)
- `ProviderType` - SCREAMING_SNAKE_CASE (`CRYPTO_NATIVE`, `FIAT_GATEWAY`, `HYBRID`)
- `UpdateStrategy` - SCREAMING_SNAKE_CASE (`WEBHOOK`, `POLLING`, `HYBRID`)
- `PaymentStatus` - SCREAMING_SNAKE_CASE (`PENDING`, `PROCESSING`, `COMPLETED`)
- `PaymentProvider` - SCREAMING_SNAKE_CASE (`CRYPTO_BOT`, `HELEKET`, `YOOKASSA`)
- `PaymentType` - SCREAMING_SNAKE_CASE (`TOP_UP`, `WITHDRAW`)
- `CurrencyType` - SCREAMING_SNAKE_CASE (`FIAT`, `CRYPTO`)
- `CurrencyCode` - ISO codes (USD, EUR, BTC) ✓
- `Cryptocurrency` - ISO codes (USDT, TON, BTC) ✓
- `TrafficActionType` - lowercase snake_case (`join`, `leave`, `view`)
- `TrafficActionStatus` - lowercase snake_case (✅ except see conversion needed)
- `TrafficOrderStatus` - lowercase snake_case (`pending`, `active`, `completed`)
- `TrafficOrderType` - lowercase snake_case (`join`, `leave`, `view`)
- `TrafficSourceType` - lowercase snake_case (`bot`, `bot_with_token`)
- `TrafficTargetType` - lowercase snake_case (`channel`, `group`, `bot`)
- `TrafficUserStatus` - lowercase snake_case (`active`, `inactive`, `banned`)
- `UserRole` - lowercase snake_case (`user`, `admin`, `developer`)
- `UserStatus` - lowercase snake_case (`active`, `restricted`, `banned`)
- `TransactionType` - lowercase snake_case (`deposit`, `withdrawal`, `transfer_in`)
- `TransactionStatus` - lowercase snake_case (`pending`, `completed`, `failed`)
- `SettingType` - lowercase snake_case (`boolean`, `string`, `number`)
- `NotificationType` - lowercase snake_case (`balance_changes`, `trade_notifications`)
- `UserRefLinkType` - lowercase snake_case (`promo`, `user`)
- `UserTrafficOrderRole` - lowercase snake_case (`creator`, `reviewer`, `manager`)
- `UserTrafficSourceRole` - lowercase snake_case (`manager`, `administrator`, `moderator`)
- `UserTrafficTargetRole` - lowercase snake_case (`manager`, `administrator`, `viewer`)

### Bot/Feature Enums
- `MenuActionType` - lowercase snake_case (`navigate`, `select`, `toggle`)
- `NavigationDirection` - lowercase snake_case (`forward`, `back`, `home`)
- `FormActionType` - lowercase snake_case (`submit`, `cancel`, `reset`)
- `PaginationActionType` - lowercase snake_case (`first`, `previous`, `next`)
- `BotChatType` - lowercase snake_case (`private`, `group`, `supergroup`)
- `ChatMemberStatus` - lowercase snake_case (`creator`, `administrator`, `member`)
- `ChatType` - lowercase snake_case (`private`, `group`, `supergroup`)
- `BotStatus` - lowercase snake_case (`active`, `paused`, `inactive`)
- `BotCommand` - lowercase snake_case (`start`, `help`, `profile`)
- `MenuType` - lowercase snake_case (`main`, `profile`, `settings`)
- `OrderFlowStep` - lowercase snake_case (`order_list`, `enter_channel_link`)
- `OrderStatus` - lowercase snake_case (`active`, `paused`, `moderation`)
- `OrderDisplayLocation` - lowercase snake_case (`my_bots_only`, `other_bots_only`)
- `UserGender` - lowercase snake_case (`any`, `male`, `female`)
- `TrafficType` - lowercase snake_case (`private_messages`, `group_messages`)
- `TrafficQuality` - lowercase snake_case (`low`, `medium`, `high`)
- `BotAction` - lowercase snake_case (`start`, `pause`, `delete`)

### Common/Shared Enums
- `TransformerType` - lowercase snake_case (`legacy`, `problem`)
- `StreamName` - SCREAMING_SNAKE_CASE (`JOBS`, `EVENTS`, `MESSAGES`)
- `Subject` - lowercase snake_case with dots (`jobs.email`, `events.user.created`)
- `RedisMode` - lowercase snake_case (`default`, `sentinel`, `cluster`)
- `ProblemKind` - lowercase snake_case (`client_data_validation`, `validation`)
- `Language` - ISO codes (en, es, fr) ✓
- `PlatformType` - lowercase snake_case (`telegram_mini_app`, `telegram_bot`)
- `AuthTokenType` - lowercase snake_case (`main`)
- `LinkType` - lowercase snake_case (`referral`, `invite`)
- `PaymentMethod` - lowercase snake_case (`crypto_bot`, `bank_spb`)
- `StatisticType` - lowercase snake_case (`traffic_source`, `traffic_order`)
- `ChartInterval` - lowercase snake_case (`hour`, `day`, `week`)
- `PaymentUpdateStrategy` - SCREAMING_SNAKE_CASE (`WEBHOOK`, `POLLING`, `HYBRID`)
- `TrafficTargetStatus` - lowercase snake_case (`active`, `inactive`, `pending_verification`)

---

## ❌ NEEDS CONVERSION

### 1. NetworkType (ProviderCurrency.entity.ts)

**File:** `/home/user/motiv-buy/monorepo/libs/database/src/entity/ProviderCurrency.entity.ts`

**Current Values:**
```typescript
export enum NetworkType {
  Bitcoin = 'BITCOIN',            // ✓ Already correct
  BitcoinCash = 'BITCOIN_CASH',   // ✓ Already correct
  Ethereum = 'ETHEREUM',          // ✓ Already correct
  BSC = 'BSC',                    // ✓ Already correct (acronym)
  Polygon = 'POLYGON',            // ✓ Already correct
  Tron = 'TRON',                  // ✓ Already correct
  TON = 'TON',                    // ✓ Already correct (acronym)
  Solana = 'SOLANA',              // ✓ Already correct
  Litecoin = 'LITECOIN',          // ✓ Already correct
  Dogecoin = 'DOGECOIN',          // ✓ Already correct
  Dash = 'DASH',                  // ✓ Already correct
  Native = 'NATIVE',              // ✓ Already correct
}
```

**Assessment:** ✅ Already using SCREAMING_SNAKE_CASE correctly. No conversion needed.

---

### 2. RateProvider (CurrencyRatesHistory.entity.ts)

**File:** `/home/user/motiv-buy/monorepo/libs/database/src/entity/CurrencyRatesHistory.entity.ts`

**Current Values → Proposed Values:**
```typescript
export enum RateProvider {
  CoinGecko = 'COINGECKO',            // ✓ Already correct
  Binance = 'BINANCE',                // ✓ Already correct
  CryptoCompare = 'CRYPTOCOMPARE',    // ✓ Already correct
  CoinCap = 'COINCAP',                // ✓ Already correct
  Kraken = 'KRAKEN',                  // ✓ Already correct
  ExchangeRateApi = 'EXCHANGERATE_API', // ✓ Already correct
  Frankfurter = 'FRANKFURTER',        // ✓ Already correct
  FreeCurrencyApi = 'FREECURRENCY_API', // ✓ Already correct
  CentralBank = 'CENTRAL_BANK',       // ✓ Already correct
  Manual = 'MANUAL',                  // ✓ Already correct
}
```

**Assessment:** ✅ Already using SCREAMING_SNAKE_CASE correctly. No conversion needed.

---

### 3. TrafficActionStatus (TrafficActions.entity.ts) ⚠️

**File:** `/home/user/motiv-buy/monorepo/libs/database/src/entity/TrafficActions.entity.ts`

**Current Values → Proposed Values:**
```typescript
export enum TrafficActionStatus {
  Pending = 'pending',          // ✓ Already correct
  InProgress = 'in_progress',   // ⚠️ Value already correct, but check consistency
  Completed = 'completed',      // ✓ Already correct
  Failed = 'failed',            // ✓ Already correct
  Cancelled = 'cancelled',      // ✓ Already correct
}
```

**Assessment:** ✅ Values already use proper snake_case. No conversion needed.

---

### 4. RoutingRuleType (ProviderRouting.entity.ts)

**File:** `/home/user/motiv-buy/monorepo/libs/database/src/entity/ProviderRouting.entity.ts`

**Current Values → Proposed Values:**
```typescript
export enum RoutingRuleType {
  UserPreference = 'USER_PREFERENCE',         // ✓ Already correct
  CostOptimization = 'COST_OPTIMIZATION',     // ✓ Already correct
  RegionBased = 'REGION_BASED',               // ✓ Already correct
  LoadBalancing = 'LOAD_BALANCING',           // ✓ Already correct
  FailoverFallback = 'FAILOVER_FALLBACK',     // ✓ Already correct
  TimeBased = 'TIME_BASED',                   // ✓ Already correct
  AmountBased = 'AMOUNT_BASED',               // ✓ Already correct
  Default = 'DEFAULT',                        // ✓ Already correct
}

export enum ConditionOperator {
  Equals = 'EQUALS',                          // ✓ Already correct
  NotEquals = 'NOT_EQUALS',                   // ✓ Already correct
  GreaterThan = 'GREATER_THAN',               // ✓ Already correct
  LessThan = 'LESS_THAN',                     // ✓ Already correct
  GreaterThanOrEqual = 'GREATER_THAN_OR_EQUAL', // ✓ Already correct
  LessThanOrEqual = 'LESS_THAN_OR_EQUAL',     // ✓ Already correct
  In = 'IN',                                  // ✓ Already correct
  NotIn = 'NOT_IN',                           // ✓ Already correct
  Contains = 'CONTAINS',                      // ✓ Already correct
  NotContains = 'NOT_CONTAINS',               // ✓ Already correct
}
```

**Assessment:** ✅ Already using SCREAMING_SNAKE_CASE correctly. No conversion needed.

---

### 5. ExceptionKind (exception-kind.enum.ts) ⚠️ NEEDS CONVERSION

**File:** `/home/user/motiv-buy/monorepo/libs/common/exception/src/const/exception-kind.enum.ts`

**Current Values → Proposed Values:**
```typescript
export enum ExceptionKind {
  ClientDataValidation = 'ClientDataValidation',  // ❌ → 'client_data_validation'
  Validation = 'Validation',                      // ❌ → 'validation'
  Unauthorized = 'Unauthorized',                  // ❌ → 'unauthorized'
  Forbidden = 'Forbidden',                        // ❌ → 'forbidden'
  NotFound = 'NotFound',                          // ❌ → 'not_found'
  Conflict = 'Conflict',                          // ❌ → 'conflict'
  RateLimitExceed = 'RateLimitExceed',            // ❌ → 'rate_limit_exceed'
  Internal = 'Internal',                          // ❌ → 'internal'
}
```

**Conversion Required:**
| Current Key | Current Value | Proposed Value |
|-------------|---------------|----------------|
| ClientDataValidation | 'ClientDataValidation' | 'client_data_validation' |
| Validation | 'Validation' | 'validation' |
| Unauthorized | 'Unauthorized' | 'unauthorized' |
| Forbidden | 'Forbidden' | 'forbidden' |
| NotFound | 'NotFound' | 'not_found' |
| Conflict | 'Conflict' | 'conflict' |
| RateLimitExceed | 'RateLimitExceed' | 'rate_limit_exceed' |
| Internal | 'Internal' | 'internal' |

---

### 6. SocketExceptionCode (socket-exception-code.enum.ts) ⚠️ NEEDS CONVERSION

**File:** `/home/user/motiv-buy/monorepo/libs/common/exception/src/const/socket-exception-code.enum.ts`

**Current Values → Proposed Values:**
```typescript
export enum SocketExceptionCode {
  ValidationError = -32602,      // Key in PascalCase but value is numeric (JSON-RPC codes)
  InvalidParams = -32602,        // Key in PascalCase
  InternalError = -32603,        // Key in PascalCase
  NotFound = -32004,             // Key in PascalCase
  Unauthorized = -32001,         // Key in PascalCase
  Forbidden = -32003,            // Key in PascalCase
  MethodNotFound = -32601,       // Key in PascalCase
  RateLimitExceeded = -32007,    // Key in PascalCase
}
```

**Note:** The enum values are numeric JSON-RPC error codes (standard), so only the keys need conversion:

| Current Key | Value | Proposed Key |
|-------------|-------|--------------|
| ValidationError | -32602 | validation_error |
| InvalidParams | -32602 | invalid_params |
| InternalError | -32603 | internal_error |
| NotFound | -32004 | not_found |
| Unauthorized | -32001 | unauthorized |
| Forbidden | -32003 | forbidden |
| MethodNotFound | -32601 | method_not_found |
| RateLimitExceeded | -32007 | rate_limit_exceeded |

**Note:** This enum is unusual because TypeScript enum keys don't affect the runtime value. If these keys are used in code as references, they should follow snake_case for consistency.

---

### 7. TopicCategory (TrafficSourceCategory.entity.ts) ⚠️ NEEDS CONVERSION

**File:** `/home/user/motiv-buy/monorepo/libs/database/src/entity/TrafficSourceCategory.entity.ts`

**Current Values → Proposed Values:**
```typescript
export enum TopicCategory {
  // Basic controls
  All = 'All',                                  // ❌ → 'all'

  // Main categories
  Other = 'Other',                              // ❌ → 'other'
  Blogs = 'Blogs',                              // ❌ → 'blogs'
  News = 'News',                                // ❌ → 'news'
  Commerce = 'Commerce',                        // ❌ → 'commerce'
  Useful = 'Useful',                            // ❌ → 'useful'
  Elders = 'Elders',                            // ❌ → 'elders'
  Entertainment = 'Entertainment',              // ❌ → 'entertainment'
  Cryptocurrencies = 'Cryptocurrencies',        // ❌ → 'cryptocurrencies'
  Earnings = 'Earnings',                        // ❌ → 'earnings'
  Quotes = 'Quotes',                            // ❌ → 'quotes'
  Music = 'Music',                              // ❌ → 'music'
  Womens = 'Womens',                            // ❌ → 'womens'
  Astrology = 'Astrology',                      // ❌ → 'astrology'
  Educational = 'Educational',                  // ❌ → 'educational'
  Adult18Plus = 'Adult18Plus',                  // ❌ → 'adult_18_plus'
  Psychology = 'Psychology',                    // ❌ → 'psychology'
  Chats = 'Chats',                              // ❌ → 'chats'
  Betting = 'Betting',                          // ❌ → 'betting'
  CreativityAndDesign = 'CreativityAndDesign',  // ❌ → 'creativity_and_design'
  NeuralNetworks = 'NeuralNetworks',            // ❌ → 'neural_networks'

  // Additional categories
  Sports = 'Sports',                            // ❌ → 'sports'
  Auto = 'Auto',                                // ❌ → 'auto'
  Movies = 'Movies',                            // ❌ → 'movies'
  Health = 'Health',                            // ❌ → 'health'
  Travel = 'Travel',                            // ❌ → 'travel'
  CookingFood = 'CookingFood',                  // ❌ → 'cooking_food'
  Tools = 'Tools',                              // ❌ → 'tools'
  Communication = 'Communication',              // ❌ → 'communication'
  Mens = 'Mens',                                // ❌ → 'mens'
  Technologies = 'Technologies',                // ❌ → 'technologies'
  Downloads = 'Downloads',                      // ❌ → 'downloads'
  Auctions = 'Auctions',                        // ❌ → 'auctions'
  Video = 'Video',                              // ❌ → 'video'
  Trash = 'Trash',                              // ❌ → 'trash'
  StickersThemes = 'StickersThemes',            // ❌ → 'stickers_themes'
  Economics = 'Economics',                      // ❌ → 'economics'
  Spam = 'Spam',                                // ❌ → 'spam'
  Dating = 'Dating',                            // ❌ → 'dating'
  Subscriptions = 'Subscriptions',              // ❌ → 'subscriptions'
  Applications = 'Applications',                // ❌ → 'applications'

  // Final categories
  GaiTrafficPolice = 'GaiTrafficPolice',        // ❌ → 'gai_traffic_police'
  Gambling = 'Gambling',                        // ❌ → 'gambling'
  Folders = 'Folders',                          // ❌ → 'folders'
}
```

**Conversion Table (57 values):**

| Current Key | Current Value | Proposed Value |
|-------------|---------------|----------------|
| All | 'All' | 'all' |
| Other | 'Other' | 'other' |
| Blogs | 'Blogs' | 'blogs' |
| News | 'News' | 'news' |
| Commerce | 'Commerce' | 'commerce' |
| Useful | 'Useful' | 'useful' |
| Elders | 'Elders' | 'elders' |
| Entertainment | 'Entertainment' | 'entertainment' |
| Cryptocurrencies | 'Cryptocurrencies' | 'cryptocurrencies' |
| Earnings | 'Earnings' | 'earnings' |
| Quotes | 'Quotes' | 'quotes' |
| Music | 'Music' | 'music' |
| Womens | 'Womens' | 'womens' |
| Astrology | 'Astrology' | 'astrology' |
| Educational | 'Educational' | 'educational' |
| Adult18Plus | 'Adult18Plus' | 'adult_18_plus' |
| Psychology | 'Psychology' | 'psychology' |
| Chats | 'Chats' | 'chats' |
| Betting | 'Betting' | 'betting' |
| CreativityAndDesign | 'CreativityAndDesign' | 'creativity_and_design' |
| NeuralNetworks | 'NeuralNetworks' | 'neural_networks' |
| Sports | 'Sports' | 'sports' |
| Auto | 'Auto' | 'auto' |
| Movies | 'Movies' | 'movies' |
| Health | 'Health' | 'health' |
| Travel | 'Travel' | 'travel' |
| CookingFood | 'CookingFood' | 'cooking_food' |
| Tools | 'Tools' | 'tools' |
| Communication | 'Communication' | 'communication' |
| Mens | 'Mens' | 'mens' |
| Technologies | 'Technologies' | 'technologies' |
| Downloads | 'Downloads' | 'downloads' |
| Auctions | 'Auctions' | 'auctions' |
| Video | 'Video' | 'video' |
| Trash | 'Trash' | 'trash' |
| StickersThemes | 'StickersThemes' | 'stickers_themes' |
| Economics | 'Economics' | 'economics' |
| Spam | 'Spam' | 'spam' |
| Dating | 'Dating' | 'dating' |
| Subscriptions | 'Subscriptions' | 'subscriptions' |
| Applications | 'Applications' | 'applications' |
| GaiTrafficPolice | 'GaiTrafficPolice' | 'gai_traffic_police' |
| Gambling | 'Gambling' | 'gambling' |
| Folders | 'Folders' | 'folders' |

---

### 8. Continent (geoip.util.ts) ⚠️ NEEDS CONVERSION

**File:** `/home/user/motiv-buy/monorepo/libs/feature/auth/shared/src/source/util/geoip.util.ts`

**Current Values → Proposed Values:**
```typescript
export enum Continent {
  Europe = 'Europe',                  // ❌ → 'europe'
  Asia = 'Asia',                      // ❌ → 'asia'
  Africa = 'Africa',                  // ❌ → 'africa'
  NorthAmerica = 'NorthAmerica',      // ❌ → 'north_america'
  SouthAmerica = 'SouthAmerica',      // ❌ → 'south_america'
  Oceania = 'Oceania',                // ❌ → 'oceania'
}
```

**Conversion Table:**

| Current Key | Current Value | Proposed Value |
|-------------|---------------|----------------|
| Europe | 'Europe' | 'europe' |
| Asia | 'Asia' | 'asia' |
| Africa | 'Africa' | 'africa' |
| NorthAmerica | 'NorthAmerica' | 'north_america' |
| SouthAmerica | 'SouthAmerica' | 'south_america' |
| Oceania | 'Oceania' | 'oceania' |

---

### 9. CountryCode (geoip.util.ts) ⚠️ Special Case

**File:** `/home/user/motiv-buy/monorepo/libs/feature/auth/shared/src/source/util/geoip.util.ts`

**Note:** CountryCode enum uses ISO 3166-1 alpha-2 country codes (e.g., 'AD', 'AE', 'US'). These are international standards and should remain UPPERCASE. However, the **enum keys** are in PascalCase (e.g., `Ad`, `Ae`, `Us`).

**Current Pattern:**
```typescript
export enum CountryCode {
  Ad = 'AD',  // Andorra
  Ae = 'AE',  // United Arab Emirates
  // ... 250+ country codes
}
```

**Issue:** The enum **keys** use PascalCase, but for consistency with TypeScript/JavaScript conventions, they could use SCREAMING_SNAKE_CASE or remain as-is since they map to standard ISO codes.

**Recommendation:** Keep as-is since:
1. The values are ISO standard uppercase codes (correct)
2. The keys are just abbreviations of country names
3. Changing keys would be a breaking change with minimal benefit

**Assessment:** ⚠️ Optional - Keys could be uppercase (AD, AE) for consistency, but current format is acceptable.

---

## Summary of Required Conversions

### High Priority (Database/Backend)

1. **ExceptionKind** - 8 values (PascalCase → snake_case)
2. **TopicCategory** - 57 values (PascalCase → snake_case)
3. **Continent** - 6 values (PascalCase → snake_case)

### Low Priority (Special Cases)

4. **SocketExceptionCode** - 8 keys (PascalCase → snake_case, values are numeric codes)

### Total Enum Values Needing Conversion: **79 values**

---

## Migration Strategy

### Phase 1: Update Enum Definitions
1. Update enum value strings to snake_case
2. Keep enum keys in PascalCase (TypeScript convention)
3. Commit changes

### Phase 2: Database Migration
For enums stored in database:
1. Create migration to update existing database values
2. Use SQL UPDATE statements to convert values
3. Test migration on staging database

### Phase 3: Update Usage
1. Search codebase for enum usage
2. Update any string comparisons
3. Update tests

### Phase 4: Validation
1. Run full test suite
2. Check API responses
3. Verify database data integrity

---

## Example Migration SQL

```sql
-- ExceptionKind enum values
UPDATE table_name
SET exception_kind = CASE exception_kind
  WHEN 'ClientDataValidation' THEN 'client_data_validation'
  WHEN 'Validation' THEN 'validation'
  WHEN 'Unauthorized' THEN 'unauthorized'
  WHEN 'Forbidden' THEN 'forbidden'
  WHEN 'NotFound' THEN 'not_found'
  WHEN 'Conflict' THEN 'conflict'
  WHEN 'RateLimitExceed' THEN 'rate_limit_exceed'
  WHEN 'Internal' THEN 'internal'
  ELSE exception_kind
END;

-- TopicCategory enum values
UPDATE traffic_source_categories
SET category_type = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(category_type, '([a-z])([A-Z])', '\1_\2', 'g'),
    '([A-Z]+)([A-Z][a-z])', '\1_\2', 'g'
  )
);

-- Continent enum values
UPDATE geo_locations
SET continent = CASE continent
  WHEN 'Europe' THEN 'europe'
  WHEN 'Asia' THEN 'asia'
  WHEN 'Africa' THEN 'africa'
  WHEN 'NorthAmerica' THEN 'north_america'
  WHEN 'SouthAmerica' THEN 'south_america'
  WHEN 'Oceania' THEN 'oceania'
  ELSE continent
END;
```

---

## Files to Modify

### Primary Files (Enum Definitions)
1. `/monorepo/libs/common/exception/src/const/exception-kind.enum.ts`
2. `/monorepo/libs/common/exception/src/const/socket-exception-code.enum.ts`
3. `/monorepo/libs/database/src/entity/TrafficSourceCategory.entity.ts`
4. `/monorepo/libs/feature/auth/shared/src/source/util/geoip.util.ts`

### Secondary Files (Usage/References)
- Search for: `ExceptionKind.` in codebase
- Search for: `SocketExceptionCode.` in codebase
- Search for: `TopicCategory.` in codebase
- Search for: `Continent.` in codebase

### Database Migration Files
- Create new migration: `monorepo/database/migrations/YYYY-MM-DD-HHmmss-convert-enums-to-snake-case.ts`

---

## Testing Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] API endpoints return correct enum values
- [ ] Database queries work with new enum values
- [ ] Bot commands work correctly
- [ ] Admin panel displays correct values
- [ ] No breaking changes in external APIs
- [ ] Documentation updated
- [ ] Migration rollback tested

---

## Notes

1. **ISO Standard Codes:** CurrencyCode and CountryCode (values) are excluded as they represent international standards
2. **Numeric Codes:** SocketExceptionCode values are JSON-RPC standard error codes and should remain numeric
3. **Breaking Changes:** All conversions are breaking changes and require careful migration
4. **Database Impact:** TopicCategory, Continent, and ExceptionKind are likely stored in database and need data migration
5. **API Impact:** These enum changes will affect API responses and require API version bump or backward compatibility layer

---

**End of Report**
