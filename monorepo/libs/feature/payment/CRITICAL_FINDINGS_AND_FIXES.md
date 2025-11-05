# CRITICAL FINDINGS & REQUIRED FIXES

## Executive Summary

After thorough verification against official documentation and SDK implementations, **critical issues** have been identified in the payment provider integrations that require immediate correction before production deployment.

---

## 🚨 CRITICAL ISSUE #1: Heleket Provider Misimplementation

### Current (WRONG) Implementation

```typescript
// heleket.provider.ts line 194-201
const rubAmount = this.convertCryptoToRub(params.amount, params.currency);

const requestParams = {
  merchantId: this.merchantId,
  amount: rubAmount,      // ❌ WRONG: Converting to RUB
  currency: 'RUB',        // ❌ WRONG: Hardcoded RUB
};
```

### Reality

**Heleket is a CRYPTOCURRENCY NATIVE payment gateway**, NOT a fiat gateway!

**Official API Structure** (from go-heleket SDK):
```go
invoiceReq := &heleket.InvoiceRequest{
    Amount: "10",
    Currency: "USDT",     // ✅ Direct crypto
    Network: "tron",      // ✅ Blockchain network
    OrderId: "order-123",
}
```

### Supported Cryptocurrencies

Heleket natively supports:
- **BTC** (Bitcoin)
- **ETH** (Ethereum)
- **USDT** (Tether) - Ethereum, Tron, TON networks
- **USDC** (USD Coin)
- **BNB** (Binance Coin)
- **TON** (The Open Network)
- **TRX** (Tron)
- **LTC** (Litecoin)
- **DOGE** (Dogecoin)
- **DAI**
- **DASH**
- **BCH** (Bitcoin Cash)
- **SOL** (Solana)

### Impact

- ❌ **Heleket cannot process payments** (wrong API format)
- ❌ **Network parameter missing** (required for USDT/USDC)
- ❌ **Hardcoded rates** cause incorrect pricing
- ❌ **RUB conversion unnecessary** and breaks API

### Required Fix

**Heleket should be implemented like CryptoBot:**

```typescript
async createInvoice(params: {
  userId: string;
  amount: string;
  currency: Cryptocurrency;
  description?: string;
}): AsyncResult<PaymentInvoice, Error> {
  const requestParams = {
    merchantId: this.merchantId,
    amount: params.amount,              // ✅ Direct crypto amount
    currency: params.currency,          // ✅ Crypto currency (USDT, BTC, etc.)
    network: this.selectNetwork(params.currency), // ✅ Network selection
    orderId: `USER_${params.userId}_${Date.now()}`,
    description: params.description,
  };
  // ...
}

private selectNetwork(currency: Cryptocurrency): string {
  // Network mapping for multi-chain assets
  const networkMap: Record<string, string> = {
    USDT: 'tron',      // Default to Tron for lower fees
    USDC: 'ethereum',
    TRX: 'tron',
    ETH: 'ethereum',
    BTC: 'bitcoin',
    // ...
  };
  return networkMap[currency] || currency.toLowerCase();
}
```

---

## 🚨 CRITICAL ISSUE #2: Hardcoded Exchange Rates

### Current Implementation

**Both Heleket and YooKassa use hardcoded rates:**

```typescript
const EXCHANGE_RATES: Record<string, string> = {
  USDT: '95.5',       // ❌ Static rate
  BTC: '6500000.0',   // ❌ Will become outdated
  ETH: '350000.0',
  // ...
};
```

### Reality

**CurrencyRateService already exists** and provides:
- ✅ Real-time rates from 8 providers (CoinGecko, Binance, Kraken, etc.)
- ✅ Updates every 10 minutes via cron job
- ✅ Circuit breaker pattern for failing providers
- ✅ Weighted averages from multiple sources
- ✅ Stablecoin validation (3% tolerance)
- ✅ Rate limiting and quota management
- ✅ Historical rate tracking

### Impact

- ❌ **Incorrect pricing** for all YooKassa transactions
- ❌ **Financial losses** from rate discrepancies
- ❌ **User complaints** about wrong amounts
- ⚠️ **Heleket rates irrelevant** (should use crypto natively)

### Required Fix

**YooKassa only** needs rate conversion (it's a fiat gateway):

```typescript
import { CurrencyRateService } from '@app/feature-balance-main';

@Injectable()
export class YooKassaProvider {
  constructor(
    private readonly currencyRateService: CurrencyRateService,
  ) {}

  async createInvoice(params: {
    amount: string;
    currency: Cryptocurrency;
  }): AsyncResult<PaymentInvoice, Error> {
    // Convert crypto to RUB using real-time rates
    const result = await this.currencyRateService.convertAmount(
      params.amount,
      this.mapCryptocurrencyToCurrencyCode(params.currency),
      CurrencyCode.Rub,
    );

    if (result.err) {
      return Err(new Error(`Failed to get exchange rate: ${result.val.message}`));
    }

    const rubAmount = result.val;

    const requestParams = {
      amount: {
        value: rubAmount,
        currency: 'RUB',
      },
      // ...
    };
    // ...
  }
}
```

---

## 🔍 ISSUE #3: Missing Cryptocurrencies

### Current Enum

```typescript
export enum Cryptocurrency {
  Usdt = 'USDT',
  Ton = 'TON',
  Btc = 'BTC',
  Eth = 'ETH',
  Bnb = 'BNB',
  Trx = 'TRX',
  Usdc = 'USDC',
  Jet = 'JET',  // Testnet only
}
```

### Missing Cryptocurrencies

Heleket supports but not in enum:
- ❌ **LTC** (Litecoin)
- ❌ **DOGE** (Dogecoin)
- ❌ **DAI** (DAI Stablecoin)
- ❌ **DASH** (Dash)
- ❌ **BCH** (Bitcoin Cash)
- ❌ **SOL** (Solana)

### Required Fix

```typescript
export enum Cryptocurrency {
  // Existing
  Usdt = 'USDT',
  Ton = 'TON',
  Btc = 'BTC',
  Eth = 'ETH',
  Bnb = 'BNB',
  Trx = 'TRX',
  Usdc = 'USDC',
  Jet = 'JET',

  // Add missing
  Ltc = 'LTC',
  Doge = 'DOGE',
  Dai = 'DAI',
  Dash = 'DASH',
  Bch = 'BCH',
  Sol = 'SOL',
}
```

**Also add to CurrencyCode enum** and **CurrencyRateService mappings**.

---

## 📊 Provider Comparison Matrix

| Feature | CryptoBot | Heleket | YooKassa |
|---------|-----------|---------|----------|
| **Type** | Crypto Native | **Crypto Native** | Fiat Gateway |
| **Accepts** | USDT, BTC, ETH, etc. | **USDT, BTC, ETH, LTC, etc.** | RUB only |
| **Network Selection** | Yes | **Yes (required!)** | N/A |
| **Needs Rate Conversion** | ❌ No | ❌ **No** | ✅ **Yes** |
| **Current Implementation** | ✅ Correct | ❌ **WRONG** | ⚠️ **Needs Rate Service** |

---

## 🛠️ Implementation Plan

### Phase 1: Fix Heleket Provider (HIGH PRIORITY) 🔴

**Steps:**
1. Remove `convertCryptoToRub()` method
2. Accept crypto currencies directly
3. Add network selection logic
4. Update API request structure
5. Add multi-chain support (USDT on Tron/Ethereum)
6. Test with real Heleket API

**Files to modify:**
- `libs/feature/payment/main/src/provider/heleket.provider.ts`

**Estimated time:** 2-3 hours

### Phase 2: Integrate CurrencyRateService in YooKassa (HIGH PRIORITY) 🔴

**Steps:**
1. Inject `CurrencyRateService` into YooKassaProvider
2. Replace `convertCryptoToRub()` with `currencyRateService.convertAmount()`
3. Add error handling for rate fetch failures
4. Add rate caching to reduce database queries
5. Test conversion accuracy

**Files to modify:**
- `libs/feature/payment/main/src/provider/yookassa.provider.ts`
- `libs/feature/payment/main/src/payment-main.module.ts` (add imports)

**Estimated time:** 1-2 hours

### Phase 3: Add Missing Cryptocurrencies (MEDIUM PRIORITY) 🟡

**Steps:**
1. Add currencies to `Cryptocurrency` enum
2. Add currencies to `CurrencyCode` enum
3. Add mapping in `CurrencyRateService`
4. Initialize currencies in database
5. Update documentation

**Files to modify:**
- `libs/database/src/enum/cryptocurrency.enum.ts`
- `libs/database/src/entity/Currency.entity.ts`
- `libs/feature/balance/main/src/service/currency-rate.service.ts`

**Estimated time:** 1 hour

### Phase 4: Update Documentation (MEDIUM PRIORITY) 🟡

**Steps:**
1. Update `PROVIDER_VERIFICATION_REPORT.md`
2. Update `PAYMENT_WEBHOOKS_AND_POLLING.md`
3. Create currency mapping documentation
4. Add provider comparison table

**Estimated time:** 1 hour

### Phase 5: Testing (CRITICAL) 🔴

**Test Cases:**
1. **Heleket**: Create invoice with USDT on Tron network
2. **Heleket**: Create invoice with BTC
3. **Heleket**: Verify webhook signature
4. **YooKassa**: Convert USDT to RUB using real rates
5. **YooKassa**: Verify rate accuracy
6. **All**: Test polling service
7. **All**: Test webhook + polling hybrid mode

**Estimated time:** 2-3 hours

---

## 🎯 Immediate Actions Required

### Before ANY Production Deployment:

1. ✅ **Fix Heleket implementation** (crypto native)
2. ✅ **Integrate CurrencyRateService in YooKassa**
3. ✅ **Remove all hardcoded rates**
4. ✅ **Test with real provider APIs**
5. ✅ **Verify webhook signatures work**
6. ✅ **Test rate conversion accuracy**

### Configuration Required:

```bash
# Environment variables needed
CRYPTO_BOT_API_TOKEN=...
CRYPTO_BOT_UPDATE_STRATEGY=HYBRID
CRYPTO_BOT_WEBHOOK_URL=https://yourdomain.com/payment/webhook/crypto-bot

HELEKET_API_TOKEN=...
HELEKET_MERCHANT_ID=...
HELEKET_UPDATE_STRATEGY=HYBRID
HELEKET_WEBHOOK_URL=https://yourdomain.com/payment/webhook/heleket

YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_UPDATE_STRATEGY=HYBRID
YOOKASSA_WEBHOOK_URL=https://yourdomain.com/payment/webhook/yookassa
YOOKASSA_WEBHOOK_IPS=185.71.76.0/27,185.71.77.0/27,77.75.153.0/25

# Polling
PAYMENT_POLLING_ENABLED=true
PAYMENT_POLLING_INTERVAL=30000
PAYMENT_POLLING_CRYPTOBOT=true
PAYMENT_POLLING_HELEKET=true
PAYMENT_POLLING_YOOKASSA=true

# Rate providers (optional, for faster rates)
CRYPTOCOMPARE_API_KEY=...
FREECURRENCY_API_KEY=...
```

---

## 📈 Expected Outcomes After Fixes

### Heleket Provider

- ✅ Accepts cryptocurrencies natively (like CryptoBot)
- ✅ Supports 13+ cryptocurrencies
- ✅ Network selection for multi-chain assets (USDT, USDC)
- ✅ No rate conversion needed
- ✅ Lower fees (blockchain networks vs fiat gateways)
- ✅ Faster processing (crypto-to-crypto)

### YooKassa Provider

- ✅ Real-time exchange rates (updated every 10 minutes)
- ✅ Accurate pricing (no financial losses)
- ✅ Multi-provider rate aggregation (weighted average)
- ✅ Rate validation (circuit breakers)
- ✅ Historical rate tracking

### Overall System

- ✅ **3 production-ready providers** (all working correctly)
- ✅ **Webhook + Polling** for maximum reliability
- ✅ **18+ supported cryptocurrencies** (with new additions)
- ✅ **Real-time rates** from 8+ providers
- ✅ **Zero hardcoded values**
- ✅ **Production-ready architecture**

---

## 🚫 What NOT to Do

1. ❌ **Don't deploy current Heleket implementation** - it will not work
2. ❌ **Don't use hardcoded rates in production** - causes financial losses
3. ❌ **Don't skip rate service integration** - it already exists!
4. ❌ **Don't treat crypto gateways as fiat gateways** - breaks API

---

## ✅ Verification Checklist

Before marking as production-ready:

- [ ] Heleket accepts crypto natively (no RUB conversion)
- [ ] Heleket includes network parameter
- [ ] YooKassa uses CurrencyRateService
- [ ] No hardcoded exchange rates remain
- [ ] All missing cryptocurrencies added
- [ ] CurrencyRateService mappings updated
- [ ] Webhooks tested with real providers
- [ ] Polling tested with real transactions
- [ ] Rate conversion tested for accuracy
- [ ] All tests passing
- [ ] Documentation updated

---

## 📞 Next Steps

1. **Review this document** with team
2. **Approve implementation plan**
3. **Execute Phase 1 (Fix Heleket)** - URGENT
4. **Execute Phase 2 (Integrate Rates)** - URGENT
5. **Execute remaining phases**
6. **Deploy to staging for testing**
7. **Production deployment after verification**

---

## 📚 References

- Heleket Official Site: https://heleket.com/
- Heleket API Docs: https://doc.heleket.com/
- Heleket Go SDK: https://github.com/rmilansky/go-heleket
- YooKassa API Docs: https://yookassa.ru/developers/api
- CryptoBot API Docs: https://help.send.tg/en/articles/10279948-crypto-pay-api

---

**Document Created**: November 2025
**Priority**: 🚨 **CRITICAL - BLOCKING PRODUCTION**
**Status**: **REQUIRES IMMEDIATE ACTION**
