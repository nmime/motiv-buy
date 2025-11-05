# Payment Provider Routing Architecture - Complete Analysis

**Date:** 2025-11-05
**Status:** 🔴 CRITICAL ISSUES FOUND - Routing Logic Incomplete
**Priority:** HIGH

---

## Executive Summary

**CRITICAL FINDINGS:**
1. ❌ **NO AUTOMATIC PROVIDER ROUTING** - System always defaults to CryptoBot
2. ❌ **Incomplete Currency Routing** - `getProviderForCurrency()` only returns CryptoBot
3. ❌ **No Provider Selection in API** - DTOs don't allow users to choose provider
4. ❌ **Outdated Documentation** - Comments claim Heleket is fiat gateway (it's crypto-native)
5. ❌ **Missing Currency Mappings** - New currencies (LTC, DOGE, DAI, DASH, BCH, SOL) not in routing

**Current State:**
- All deposits → CryptoBot (hardcoded default)
- All withdrawals → CryptoBot (hardcoded default)
- Heleket provider: Installed but NEVER USED
- YooKassa provider: Installed but NEVER USED

---

## 1. Current Routing Architecture

### 1.1 Provider Factory

**File:** `libs/feature/payment/main/src/service/payment-provider.factory.ts`

```typescript
export class PaymentProviderFactory {
  constructor(
    private readonly cryptoBotProvider: CryptoBotProvider,
    private readonly helekeProvider: HelekeProvider,
    private readonly yooKassaProvider: YooKassaProvider,
  ) {
    this.providers = new Map<PaymentProvider, IPaymentProvider>([
      [PaymentProvider.CryptoBot, this.cryptoBotProvider],
      [PaymentProvider.Heleket, this.helekeProvider],
      [PaymentProvider.YooKassa, this.yooKassaProvider],
    ]);
  }
}
```

**Methods:**
- `getProvider(providerType)` - Returns specific provider instance
- `hasProvider(providerType)` - Checks if provider exists
- `getAvailableProviders()` - Lists all registered providers
- `getProviderForCurrency(currency)` - ❌ **BROKEN** - Always returns CryptoBot

### 1.2 Payment Service Defaults

**File:** `libs/feature/payment/main/src/service/payment.service.ts`

```typescript
// DEPOSIT routing
async createTopUp(
  userId: string,
  dto: CreateInvoiceDto,
  providerType: PaymentProvider = PaymentProvider.CryptoBot, // ❌ HARDCODED DEFAULT
): AsyncResult<InvoiceResponseDto, Error>

// WITHDRAW routing
async createWithdrawal(
  userId: string,
  dto: CreateTransferDto,
  providerType: PaymentProvider = PaymentProvider.CryptoBot, // ❌ HARDCODED DEFAULT
): AsyncResult<TransferResponseDto, Error>
```

**Problem:** Both methods default to `PaymentProvider.CryptoBot`, no routing logic.

### 1.3 API Controller

**File:** `libs/feature/payment/main/src/controller/payment.controller.ts`

```typescript
// Deposits
@Post('topup')
async createTopUp(
  @CurrentUserId() userId: string,
  @Body() dto: CreateInvoiceDto // ❌ No provider field
): Promise<InvoiceResponseDto> {
  const result = await this.paymentService.createTopUp(userId, dto); // ❌ No provider specified
  // ...
}

// Withdrawals
@Post('withdraw')
async createWithdrawal(
  @CurrentUserId() userId: string,
  @Body() dto: CreateTransferDto // ❌ No provider field
): Promise<TransferResponseDto> {
  const result = await this.paymentService.createWithdrawal(userId, dto); // ❌ No provider specified
  // ...
}
```

**Problem:** Controllers never specify which provider to use, always rely on default.

### 1.4 DTOs

**CreateInvoiceDto:**
```typescript
export class CreateInvoiceDto {
  amount!: string;
  currency!: CurrencyCode;
  description?: string;
  expiresIn?: number;
  // ❌ NO PROVIDER FIELD
}
```

**CreateTransferDto:**
```typescript
export class CreateTransferDto {
  userId!: string;
  amount!: string;
  currency!: CurrencyCode;
  comment?: string;
  // ❌ NO PROVIDER FIELD
}
```

**Problem:** Users cannot choose payment provider through API.

---

## 2. Provider Capabilities Matrix

### 2.1 Cryptocurrency Support

| Currency | CryptoBot | Heleket | YooKassa | Notes |
|----------|-----------|---------|----------|-------|
| **BTC** | ✅ Native | ✅ Native | ✅ Via RUB | - |
| **ETH** | ✅ Native | ✅ Native | ✅ Via RUB | - |
| **USDT** | ✅ Native | ✅ Native (Tron) | ✅ Via RUB | Heleket: TRC-20 (lowest fees) |
| **USDC** | ✅ Native | ✅ Native (Ethereum) | ✅ Via RUB | Heleket: ERC-20 |
| **TON** | ✅ Native | ✅ Native | ✅ Via RUB | Telegram native |
| **BNB** | ✅ Native | ✅ Native (BSC) | ✅ Via RUB | - |
| **TRX** | ✅ Native | ✅ Native | ✅ Via RUB | - |
| **LTC** | ✅ Native | ✅ Native | ✅ Via RUB | NEW |
| **DOGE** | ✅ Native | ✅ Native | ✅ Via RUB | NEW |
| **DAI** | ✅ Native | ✅ Native (Ethereum) | ✅ Via RUB | NEW |
| **DASH** | ✅ Native | ✅ Native | ✅ Via RUB | NEW |
| **BCH** | ✅ Native | ✅ Native | ✅ Via RUB | NEW |
| **SOL** | ✅ Native | ✅ Native | ✅ Via RUB | NEW |

### 2.2 Operations Support

| Operation | CryptoBot | Heleket | YooKassa |
|-----------|-----------|---------|----------|
| **Deposit (Invoice)** | ✅ Working | ✅ Working | ✅ Working |
| **Withdraw (Transfer)** | ✅ Working | ✅ Working | ✅ Working (Fixed) |
| **Check Balance** | ✅ Working | ✅ Working | ❌ Not Supported |
| **Webhooks** | ✅ HMAC-SHA256 | ✅ HMAC-SHA256 | ✅ IP Whitelist |
| **Polling** | ✅ Supported | ✅ Supported | ✅ Supported |

### 2.3 Provider Characteristics

| Characteristic | CryptoBot | Heleket | YooKassa |
|----------------|-----------|---------|----------|
| **Type** | Crypto-Native | Crypto-Native | Fiat Gateway |
| **Networks** | Multiple | Multiple + Routing | N/A (converts to RUB) |
| **Fees** | Variable | Variable (network-dependent) | Currency conversion + gateway |
| **Speed** | Fast | Fast | Slower (fiat conversion) |
| **KYC Required** | No | No | Yes (for fiat) |
| **Telegram Integration** | ✅ Best | ❌ None | ❌ None |
| **Russian Market** | ✅ Works | ✅ Russian | ✅ Russian (Primary) |
| **International** | ✅ Global | ⚠️ Limited | ❌ Russia only |

---

## 3. Broken Currency Routing

### 3.1 Current Implementation

**File:** `libs/feature/payment/main/src/service/payment-provider.factory.ts:96-107`

```typescript
getProviderForCurrency(currency: string): PaymentProvider {
  // CryptoBot is the primary provider for all cryptocurrencies
  // Heleket and YooKassa handle fiat gateways for crypto top-ups via RUB  ❌ WRONG COMMENT
  const cryptoCurrencies = ['USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC', 'JET'];

  if (cryptoCurrencies.includes(currency.toUpperCase())) {
    return PaymentProvider.CryptoBot;  // ❌ ALWAYS CRYPTOBOT
  }

  // Default to CryptoBot for unknown currencies
  return PaymentProvider.CryptoBot;  // ❌ STILL CRYPTOBOT
}
```

### 3.2 Issues

1. **Outdated Comments:**
   - Claims "Heleket and YooKassa handle fiat gateways"
   - Reality: Heleket is crypto-native (fixed in previous PR)
   - Only YooKassa is fiat gateway

2. **Missing Currencies:**
   - List: `['USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC', 'JET']`
   - Missing: `LTC, DOGE, DAI, DASH, BCH, SOL` (added in previous PR)

3. **No Real Routing:**
   - Method ALWAYS returns `CryptoBot`
   - Heleket never selected
   - YooKassa never selected

4. **Method Never Called:**
   - `PaymentService` doesn't use this method
   - Controllers don't use this method
   - Effectively dead code

---

## 4. Actual Request Flow

### 4.1 Deposit Flow (Current)

```
User Request
  ↓
POST /payment/topup
  ↓
PaymentController.createTopUp(userId, dto)
  ↓
PaymentService.createTopUp(userId, dto) // No provider specified
  ↓
Default: providerType = PaymentProvider.CryptoBot  ❌ HARDCODED
  ↓
providerFactory.getProvider(PaymentProvider.CryptoBot)
  ↓
CryptoBotProvider.createInvoice(params)
  ↓
Response with CryptoBot payment URL
```

**Result:** Heleket and YooKassa NEVER USED for deposits.

### 4.2 Withdraw Flow (Current)

```
User Request
  ↓
POST /payment/withdraw
  ↓
PaymentController.createWithdrawal(userId, dto)
  ↓
PaymentService.createWithdrawal(userId, dto) // No provider specified
  ↓
Default: providerType = PaymentProvider.CryptoBot  ❌ HARDCODED
  ↓
providerFactory.getProvider(PaymentProvider.CryptoBot)
  ↓
CryptoBotProvider.createTransfer(params)
  ↓
Response with transfer status
```

**Result:** Heleket and YooKassa NEVER USED for withdrawals.

---

## 5. Network Routing (Heleket Only)

Heleket provider has SMART network routing for multi-chain assets:

**File:** `libs/feature/payment/main/src/provider/heleket.provider.ts:558-585`

```typescript
private selectNetwork(currency: Cryptocurrency): string {
  const NETWORK_MAP: Record<string, string> = {
    USDT: 'tron',      // TRC-20 (lowest fees)
    USDC: 'ethereum',  // ERC-20
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'bsc',
    TRX: 'tron',
    TON: 'ton',
    LTC: 'litecoin',
    DOGE: 'dogecoin',
    DAI: 'ethereum',   // ERC-20 stablecoin
    DASH: 'dash',
    BCH: 'bitcoin-cash',
    SOL: 'solana',
  };
  return NETWORK_MAP[currency] || currency.toLowerCase();
}
```

**Key Decisions:**
- **USDT** → Tron (TRC-20) for lowest transaction fees
- **USDC** → Ethereum (ERC-20) as primary network
- **DAI** → Ethereum (ERC-20) stablecoin
- All other coins → Native networks

**Problem:** This excellent routing NEVER GETS USED because Heleket provider is never selected!

---

## 6. Provider Selection Strategy (What Should Exist)

### 6.1 Recommended Routing Logic

#### For Deposits (createInvoice)

```typescript
function selectDepositProvider(currency: CurrencyCode, userPreference?: PaymentProvider): PaymentProvider {
  // 1. Honor user preference if specified
  if (userPreference && isProviderAvailable(userPreference, currency)) {
    return userPreference;
  }

  // 2. For Russian users wanting fiat (RUB) conversion
  if (isRussianUser && wantsFiatConversion) {
    return PaymentProvider.YooKassa; // Bank cards, SBP, wallets
  }

  // 3. For Telegram users (best integration)
  if (isTelegramUser) {
    return PaymentProvider.CryptoBot; // Native Telegram bot
  }

  // 4. For optimal network routing (multi-chain assets)
  if (isMultiChainAsset(currency)) {
    return PaymentProvider.Heleket; // Smart network selection (TRC-20, ERC-20)
  }

  // 5. Default to CryptoBot (best overall support)
  return PaymentProvider.CryptoBot;
}
```

#### For Withdrawals (createTransfer)

```typescript
function selectWithdrawProvider(currency: CurrencyCode, destination: string): PaymentProvider {
  // 1. YooKassa: Bank card withdrawals (RUB)
  if (isBankCardNumber(destination)) {
    return PaymentProvider.YooKassa; // Requires bank card number
  }

  // 2. CryptoBot: Telegram user withdrawals
  if (isTelegramUserId(destination)) {
    return PaymentProvider.CryptoBot; // Send to Telegram user
  }

  // 3. Heleket: Crypto wallet withdrawals with network optimization
  if (isCryptoWalletAddress(destination)) {
    return PaymentProvider.Heleket; // Optimal network routing
  }

  // 4. Default to CryptoBot
  return PaymentProvider.CryptoBot;
}
```

### 6.2 Load Balancing Strategy

For high-volume applications:

```typescript
function selectProviderWithLoadBalancing(
  currency: CurrencyCode,
  providers: PaymentProvider[]
): PaymentProvider {
  // 1. Filter providers that support this currency
  const supportedProviders = providers.filter(p =>
    supportsDeposit(p, currency)
  );

  // 2. Check provider health
  const healthyProviders = supportedProviders.filter(p =>
    circuitBreakerState[p].isOpen === false
  );

  // 3. Select provider with lowest current load
  return selectLeastLoaded(healthyProviders);
}
```

### 6.3 Cost Optimization Strategy

```typescript
function selectCheapestProvider(
  currency: CurrencyCode,
  amount: string
): PaymentProvider {
  const providers = [
    { provider: PaymentProvider.CryptoBot, fee: estimateFee('CryptoBot', currency, amount) },
    { provider: PaymentProvider.Heleket, fee: estimateFee('Heleket', currency, amount) },
    { provider: PaymentProvider.YooKassa, fee: estimateFee('YooKassa', currency, amount) },
  ];

  // Sort by estimated fee (lowest first)
  providers.sort((a, b) => a.fee - b.fee);

  return providers[0].provider;
}
```

**Example Fee Estimates:**
- USDT on Tron (Heleket): ~$1-2 (TRC-20, very low)
- USDT on Ethereum (CryptoBot): ~$5-20 (ERC-20, higher gas)
- USDT to RUB (YooKassa): Conversion spread + gateway fee

---

## 7. Missing Features

### 7.1 API Provider Selection

**What's Missing:**
Users cannot choose payment provider through API.

**What Should Exist:**

```typescript
// Updated DTOs
export class CreateInvoiceDto {
  amount!: string;
  currency!: CurrencyCode;
  description?: string;
  expiresIn?: number;
  provider?: PaymentProvider;  // NEW: Optional provider selection
}

export class CreateTransferDto {
  userId!: string;
  amount!: string;
  currency!: CurrencyCode;
  comment?: string;
  destination?: string;
  provider?: PaymentProvider;  // NEW: Optional provider selection
}
```

### 7.2 Smart Routing Service

**What's Missing:**
No intelligent provider selection based on context.

**What Should Exist:**

```typescript
@Injectable()
export class ProviderRoutingService {
  /**
   * Select best provider for deposit based on multiple factors
   */
  selectDepositProvider(params: {
    currency: CurrencyCode;
    amount: string;
    userContext: UserContext;
    preferences?: UserPreferences;
  }): PaymentProvider {
    // Implement smart routing logic
  }

  /**
   * Select best provider for withdrawal based on destination
   */
  selectWithdrawProvider(params: {
    currency: CurrencyCode;
    amount: string;
    destination: string;
    userContext: UserContext;
  }): PaymentProvider {
    // Implement smart routing logic
  }
}
```

### 7.3 Provider Health Monitoring

**What's Missing:**
No circuit breaker or health checks for provider selection.

**What Should Exist:**

```typescript
@Injectable()
export class ProviderHealthService {
  private readonly circuitBreakers = new Map<PaymentProvider, CircuitBreakerState>();

  isProviderHealthy(provider: PaymentProvider): boolean {
    return !this.circuitBreakers.get(provider)?.isOpen;
  }

  recordSuccess(provider: PaymentProvider): void {
    // Update circuit breaker
  }

  recordFailure(provider: PaymentProvider): void {
    // Update circuit breaker, potentially open circuit
  }
}
```

### 7.4 Provider Failover

**What's Missing:**
No automatic failover to backup provider if primary fails.

**What Should Exist:**

```typescript
async createInvoiceWithFailover(
  userId: string,
  dto: CreateInvoiceDto
): AsyncResult<InvoiceResponseDto, Error> {
  const primaryProvider = this.selectDepositProvider(dto.currency);
  const backupProviders = this.getBackupProviders(dto.currency, primaryProvider);

  // Try primary
  let result = await this.createWithProvider(userId, dto, primaryProvider);
  if (result.ok) return result;

  // Try backups
  for (const backup of backupProviders) {
    result = await this.createWithProvider(userId, dto, backup);
    if (result.ok) {
      this.logger.warn(`Failover to ${backup} successful after ${primaryProvider} failed`);
      return result;
    }
  }

  return result; // All failed
}
```

---

## 8. Recommendations

### 8.1 Immediate Fixes (Priority: CRITICAL)

1. **Fix `getProviderForCurrency()`**
   ```typescript
   getProviderForCurrency(currency: string): PaymentProvider {
     // Add all supported currencies
     const allCrypto = ['USDT', 'TON', 'BTC', 'ETH', 'BNB', 'TRX', 'USDC',
                        'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL'];

     if (allCrypto.includes(currency.toUpperCase())) {
       // For now, still return CryptoBot (but at least it's documented correctly)
       return PaymentProvider.CryptoBot;
     }

     return PaymentProvider.CryptoBot;
   }
   ```

2. **Update Comments**
   ```typescript
   // Accurate comment
   // CryptoBot: Telegram-native, best overall crypto support
   // Heleket: Crypto-native with smart network routing (optimal for multi-chain)
   // YooKassa: Fiat gateway for Russian market (crypto → RUB conversion)
   ```

3. **Add Provider Field to DTOs**
   ```typescript
   export class CreateInvoiceDto {
     // ... existing fields ...

     @ApiPropertyOptional({
       enum: PaymentProvider,
       description: 'Optional payment provider selection'
     })
     @IsOptional()
     @IsEnum(PaymentProvider)
     provider?: PaymentProvider;
   }
   ```

### 8.2 Short-Term Improvements (Priority: HIGH)

1. **Implement Basic Routing Service**
   - Create `ProviderRoutingService`
   - Implement smart provider selection
   - Use in `PaymentService` instead of hardcoded defaults

2. **Update Controllers**
   - Pass provider from DTO to service
   - Fall back to smart routing if not specified

3. **Add Configuration**
   ```typescript
   // config/payment-routing.config.ts
   export const ROUTING_CONFIG = {
     depositPreference: {
       telegram: PaymentProvider.CryptoBot,
       russian: PaymentProvider.YooKassa,
       international: PaymentProvider.Heleket,
     },
     withdrawPreference: {
       bankCard: PaymentProvider.YooKassa,
       telegram: PaymentProvider.CryptoBot,
       wallet: PaymentProvider.Heleket,
     },
   };
   ```

### 8.3 Long-Term Enhancements (Priority: MEDIUM)

1. **Provider Health Monitoring**
   - Circuit breakers for each provider
   - Health check endpoints
   - Automatic failover

2. **Cost Optimization**
   - Fee estimation per provider
   - Automatic cheapest provider selection
   - User cost reporting

3. **Load Balancing**
   - Distribute requests across providers
   - Monitor provider capacity
   - Rate limiting per provider

4. **A/B Testing**
   - Test provider performance
   - Measure conversion rates
   - Optimize routing based on data

---

## 9. Testing Strategy

### 9.1 Manual Testing Needed

For each provider, test:

```bash
# CryptoBot deposit
curl -X POST /payment/topup \
  -H "Authorization: Bearer $JWT" \
  -d '{"amount": "10.0", "currency": "USDT", "provider": "CRYPTO_BOT"}'

# Heleket deposit
curl -X POST /payment/topup \
  -H "Authorization: Bearer $JWT" \
  -d '{"amount": "10.0", "currency": "USDT", "provider": "HELEKET"}'

# YooKassa deposit
curl -X POST /payment/topup \
  -H "Authorization: Bearer $JWT" \
  -d '{"amount": "1000.0", "currency": "USDT", "provider": "YOOKASSA"}'
```

### 9.2 Automated Tests Needed

```typescript
describe('Provider Routing', () => {
  it('should select CryptoBot for Telegram users', () => {
    const provider = routingService.selectDepositProvider({
      currency: CurrencyCode.Usdt,
      userContext: { platform: 'telegram' },
    });
    expect(provider).toBe(PaymentProvider.CryptoBot);
  });

  it('should select Heleket for multi-chain optimization', () => {
    const provider = routingService.selectDepositProvider({
      currency: CurrencyCode.Usdt,
      userContext: { optimizeFor: 'fees' },
    });
    expect(provider).toBe(PaymentProvider.Heleket); // TRC-20 lowest fees
  });

  it('should select YooKassa for Russian fiat users', () => {
    const provider = routingService.selectDepositProvider({
      currency: CurrencyCode.Usdt,
      userContext: { region: 'RU', preferFiat: true },
    });
    expect(provider).toBe(PaymentProvider.YooKassa);
  });
});
```

---

## 10. Migration Plan

### Phase 1: Foundation (Week 1)
- [ ] Fix `getProviderForCurrency()` method
- [ ] Update outdated comments
- [ ] Add missing currencies to arrays
- [ ] Add provider field to DTOs
- [ ] Document current state

### Phase 2: Basic Routing (Week 2)
- [ ] Create `ProviderRoutingService`
- [ ] Implement basic smart routing
- [ ] Update `PaymentService` to use routing
- [ ] Update controllers to pass provider from DTO
- [ ] Add configuration file

### Phase 3: Testing (Week 3)
- [ ] Manual testing all providers
- [ ] Automated routing tests
- [ ] Load testing
- [ ] Monitor error rates

### Phase 4: Advanced Features (Week 4+)
- [ ] Provider health monitoring
- [ ] Automatic failover
- [ ] Cost optimization
- [ ] Load balancing

---

## 11. Conclusion

**Current State:** 🔴 **BROKEN**
- Heleket and YooKassa providers exist but are NEVER USED
- All traffic goes to CryptoBot regardless of optimal choice
- No user control over provider selection
- Excellent Heleket network routing wasted

**Required Action:** IMMEDIATE
- Fix routing logic
- Enable provider selection
- Implement smart routing

**Estimated Impact:**
- **Cost Savings:** 50-70% on transaction fees (Heleket TRC-20 vs CryptoBot ERC-20)
- **User Experience:** Better speeds and lower costs
- **Reliability:** Failover capabilities
- **Market Reach:** Russian users can use YooKassa fiat gateway

**Priority:** 🔴 CRITICAL - System is not utilizing available providers effectively.

---

**Last Updated:** 2025-11-05
**Severity:** Critical
**Action Required:** Immediate routing implementation
