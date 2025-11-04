# Balance & Payments Feature - Provider Analysis

## Executive Summary

This document analyzes the current balance and payments system, focusing on payment provider architecture and the
implementation strategy for integrating multiple providers (CryptoBot, Heleket, YooKassa) with proper isolation.

## Current State

### ✅ Implemented Components

#### 1. **Payment System Architecture**

```
apps/
├── api/              # REST API backend
└── bot/              # Telegram bot interface

libs/
├── common/           # Cross-domain utilities (logger, validation, etc.)
├── database/         # Database entities & repositories
└── feature/
    ├── auth/         # Authentication system
    ├── payment/      # Payment processing (CRYPTO_BOT only)
    ├── balance/      # Balance management
    └── ...
```

#### 2. **Database Layer**

**Payment Transaction Entity** (`libs/database/src/entity/PaymentTransaction.entity.ts`)

- Supports multiple payment providers via `PaymentProvider` enum
- Currently only `CryptoBot` is defined
- Stores provider-specific transaction IDs, amounts, fees, metadata
- Supports both top-up and withdraw transaction types

**User Balance Entity** (`libs/database/src/entity/UserBalance.entity.ts`)

- Multi-currency balance support
- Tracks available and locked balances
- Uses decimal(20,8) for precise financial calculations
- One balance per user per currency

#### 3. **Provider Interface** (`libs/feature/payment/shared/src/interface/payment-provider.interface.ts`)

```typescript
export interface IPaymentProvider {
  createInvoice(params): AsyncResult<PaymentInvoice, Error>;
  getInvoice(invoiceId): AsyncResult<PaymentTransaction, Error>;
  getInvoices(params?): AsyncResult<PaymentTransaction[], Error>;
  createTransfer(params): AsyncResult<PaymentTransfer, Error>;
  getTransfer(transferId): AsyncResult<PaymentTransfer, Error>;
  getTransfers(params?): AsyncResult<PaymentTransfer[], Error>;
  getBalances(): AsyncResult<PaymentBalance[], Error>;
  verifyWebhook(signature, body): boolean;
}
```

**Key Benefits:**

- ✅ Abstract interface allows multiple provider implementations
- ✅ All providers return standardized types
- ✅ Result pattern for error handling
- ✅ Webhook signature verification for security

#### 4. **CryptoBot Provider** (`libs/feature/payment/main/src/provider/crypto-bot.provider.ts`)

**Fully Implemented:**

- ✅ Create payment invoices
- ✅ Check invoice status
- ✅ Create withdrawals/transfers
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Currency mapping (USDT, TON, BTC, ETH, BNB, TRX, USDC, JET)
- ✅ Transaction history queries
- ✅ Balance queries

**Integration:**

- Uses Result pattern for error handling
- Comprehensive logging
- Type-safe with TypeScript
- Webhook processing for async events

#### 5. **Payment Service** (`libs/feature/payment/main/src/service/payment.service.ts`)

**Core Features:**

- ✅ Top-up invoice creation
- ✅ Withdrawal with balance validation
- ✅ Pessimistic locking for race condition prevention
- ✅ Webhook processing (invoice_paid, invoice_expired, transfer_completed, etc.)
- ✅ Automatic balance crediting/refunding
- ✅ Transaction status synchronization
- ✅ Comprehensive error handling and rollback

**Security Measures:**

- Database transactions with pessimistic locking
- Idempotency checks for webhook processing
- Balance rollback on failed withdrawals
- Currency validation

#### 6. **Balance Service** (`libs/feature/balance/main/src/service/balance.service.ts`)

**Core Features:**

- ✅ Multi-currency balance management
- ✅ Transaction history with filtering
- ✅ Top-up request via payment invoice
- ✅ Withdrawal request with currency conversion
- ✅ Pending withdrawal tracking
- ✅ Total earned calculation

## Gaps & Requirements

### ❌ Missing Providers

#### 1. **Heleket Provider**

- ❌ Not implemented
- ❌ No configuration interface
- ❌ No API integration

#### 2. **YooKassa Provider**

- ❌ Not implemented
- ❌ No configuration interface
- ❌ No API integration

#### 3. **Provider Configuration**

- ❌ Only CryptoBot config exists
- ❌ No unified configuration for multiple providers
- ❌ No provider selection logic

## Provider Isolation Strategy

### Current Architecture

```
PaymentMainModule
├── CryptoBotProvider (✓ Implemented)
├── PaymentService (orchestrates providers)
└── PaymentSharedModule
    ├── IPaymentProvider (interface)
    └── PaymentConfigService
```

### Recommended Architecture

```
PaymentMainModule
├── ProviderRegistry
│   ├── CryptoBotProvider (✓)
│   ├── HeleketProvider (needs implementation)
│   └── YooKassaProvider (needs implementation)
├── PaymentService (provider-agnostic)
└── PaymentSharedModule
    ├── IPaymentProvider (interface)
    ├── PaymentConfigService (unified config)
    └── ProviderConfig interfaces
```

## Implementation Plan

### Phase 1: Provider Infrastructure

#### 1.1 Extend Provider Enum

**File: `libs/database/src/enum/payment-provider.enum.ts`**

```typescript
export enum PaymentProvider {
  CryptoBot = 'CRYPTO_BOT',
  Heleket = 'HELEKET',
  YooKassa = 'YOOKASSA',
}
```

#### 1.2 Create Provider Registry

**File: `libs/feature/payment/main/src/provider/provider-registry.service.ts`**

```typescript

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<PaymentProvider, IPaymentProvider>();

  constructor(
    private cryptoBot: CryptoBotProvider,
    private heleket: HeleketProvider, // To be implemented
    private yookassa: YooKassaProvider, // To be implemented
  ) {
    this.providers.set(PaymentProvider.CryptoBot, cryptoBot);
    this.providers.set(PaymentProvider.Heleket, heleket);
    this.providers.set(PaymentProvider.YooKassa, yookassa);
  }

  getProvider(provider: PaymentProvider): IPaymentProvider {
    const p = this.providers.get(provider);
    if (!p) {
      throw new Error(`Provider not found: ${provider}`);
    }
    return p;
  }
}
```

#### 1.3 Update Configuration

**File: `libs/feature/payment/shared/src/config/payment-config.interface.ts`**

```typescript
export interface PaymentConfig {
  cryptoBot: CryptoBotConfig;
  heleket?: HeleketConfig; // Add
  yookassa?: YooKassaConfig; // Add
  webhook?: PaymentWebhookConfig;
  features?: PaymentFeatureFlags;
  limits?: PaymentLimitsConfig;
  defaultProvider?: PaymentProvider; // Add provider selection
}
```

### Phase 2: Heleket Provider

#### 2.1 Create Heleket Config

**File: `libs/feature/payment/shared/src/config/heleket-config.interface.ts`**

```typescript
export interface HeleketConfig {
  apiKey: string;
  apiUrl?: string;
  merchantId: string;
  secretKey: string;
  timeout?: number;
  maxRetries?: number;
}
```

#### 2.2 Implement Heleket Provider

**File: `libs/feature/payment/main/src/provider/heleket.provider.ts`**

```typescript

@Injectable()
export class HeleketProvider implements IPaymentProvider {
  // Implement all IPaymentProvider methods
  // Use Heleket's API endpoints
  // Map Heleket-specific data to PaymentInvoice/PaymentTransaction types
  // Implement webhook signature verification
}
```

**Key Considerations:**

- Heleket is a fiat payment processor (cards, bank transfers)
- Different from CryptoBot (crypto-only)
- May use different status flow
- May have different currency support
- Webhook format will be different

### Phase 3: YooKassa Provider

#### 3.1 Create YooKassa Config

**File: `libs/feature/payment/shared/src/config/yookassa-config.interface.ts`**

```typescript
export interface YooKassaConfig {
  shopId: string;
  secretKey: string;
  apiUrl?: string;
  timeout?: number;
  maxRetries?: number;
}
```

#### 3.2 Implement YooKassa Provider

**File: `libs/feature/payment/main/src/provider/yookassa.provider.ts`**

```typescript
@Injectable()
export class YooKassaProvider implements IPaymentProvider {
  // Implement all IPaymentProvider methods
  // Use YooKassa's API endpoints
  // Map YooKassa-specific data to PaymentInvoice/PaymentTransaction types
  // Implement webhook signature verification
}
```

**Key Considerations:**

- YooKassa is a Russian payment processor
- Supports cards, bank transfers, SBP, etc.
- Ruble-focused (RUB as primary currency)
- Different webhook format and signature verification
- May have different transaction lifecycle

### Phase 4: Update Payment Service

#### 4.1 Provider Selection

**File: `libs/feature/payment/main/src/service/payment.service.ts`**

```typescript
export class PaymentService {
  constructor(
    private readonly providerRegistry: PaymentProviderRegistry,
    // ... other dependencies
  ) {
  }

  async createTopUp(userId: string, dto: CreateInvoiceDto): AsyncResult<InvoiceResponseDto, Error> {
    // Get default or specified provider
    const providerType = dto.provider || this.config.getDefaultProvider();
    const provider = this.providerRegistry.getProvider(providerType);

    // Use provider...
  }

  async createWithdrawal(userId: string, dto: CreateTransferDto): AsyncResult<TransferResponseDto, Error> {
    const providerType = dto.provider || this.config.getDefaultProvider();
    const provider = this.providerRegistry.getProvider(providerType);

    // Use provider...
  }
}
```

#### 4.2 Update DTOs

**File: `libs/feature/payment/shared/src/dto/create-invoice.dto.ts`**

```typescript
export class CreateInvoiceDto {
  // ... existing fields
  provider?: PaymentProvider; // Add provider selection
}
```

### Phase 5: Balance Integration

#### 5.1 Multi-Provider Balance Operations

**File: `libs/feature/balance/main/src/service/balance.service.ts`**

```typescript
export class BalanceService {
  async requestTopUp(userId: string, request: TopUpRequestDto): Promise<Result<{...}, Error>> {
    // Determine which provider to use based on:
    // - Requested currency
    // - User preference
    // - System default
    // - Availability

    const provider = this.selectProvider(request.currency);
    // Create invoice via selected provider
  }
}
```

## Provider Selection Logic

### Currency-Based Selection

```typescript
const PROVIDER_CURRENCY_SUPPORT: Record<PaymentProvider, Cryptocurrency[]> = {
  [PaymentProvider.CryptoBot]: [Cryptocurrency.Usdt, Cryptocurrency.Ton, Cryptocurrency.Btc, ...],
  [PaymentProvider.Heleket]: [Cryptocurrency.Rub, Cryptocurrency.Usd], // If supports crypto
  [PaymentProvider.YooKassa]: [Cryptocurrency.Rub],
};

function selectProvider(currency: Cryptocurrency): PaymentProvider {
  // Check which providers support this currency
  // Apply selection rules (user preference, fees, availability)
  // Return selected provider
}
```

### User Preference

```typescript
// Store user's preferred payment method in UserSettings
export interface UserPaymentPreferences {
  preferredTopUpProvider?: PaymentProvider;
  preferredWithdrawalProvider?: PaymentProvider;
  autoWithdrawEnabled?: boolean;
}
```

## Data Model Changes

### 1. Payment Transaction Entity Enhancements

The current entity already supports multiple providers via the `provider` enum field. No changes needed.

**Transaction Flow:**

1. User requests top-up
2. System selects provider (or user chooses)
3. Provider creates invoice
4. Transaction stored with provider identifier
5. Webhook updates transaction status
6. Balance credited when payment confirmed

### 2. User Balance

Current model supports multi-currency. Providers may use different currencies:

- **CryptoBot**: Crypto (USDT, TON, BTC, ETH, etc.)
- **Heleket**: Likely supports RUB, USD, EUR
- **YooKassa**: Primarily RUB

**Solution:** Ensure all providers map to supported currencies in `CurrencyEntity`.

## Testing Strategy

### Unit Tests

- Test each provider implementation independently
- Mock external API calls
- Verify mapping functions
- Test error handling

### Integration Tests

- Test PaymentService with different providers
- Test webhook processing for each provider
- Test balance operations
- Test provider selection logic

### End-to-End Tests

- Test complete payment flows
- Test multi-provider scenarios
- Test failure scenarios and rollbacks

## Security Considerations

### 1. Webhook Verification

Each provider has different signature verification:

- **CryptoBot**: HMAC-SHA256 with SHA256(token) secret
- **Heleket**: TBD - implement based on their docs
- **YooKassa**: TBD - implement based on their docs

### 2. API Credentials

- Store in environment variables
- Never log or expose credentials
- Rotate credentials regularly
- Use testnet/sandbox for testing

### 3. Transaction Integrity

- ✅ Already using pessimistic locking
- ✅ Idempotency checks in place
- ✅ Rollback mechanisms implemented

## Provider-Specific Considerations

### CryptoBot

- ✅ Fully implemented
- ✅ Crypto-only
- ✅ Supports testnet
- ✅ Webhooks for async events

### Heleket

- ⚠️ Needs investigation
- Questions to answer:
    - What currencies does it support?
    - Does it support crypto or just fiat?
    - What's their API rate limit?
    - How do they handle withdrawals?
    - What's their webhook format?
    - Do they have a test environment?

### YooKassa

- ⚠️ Needs investigation
- Questions to answer:
    - What currencies?
    - Withdrawal support?
    - Webhook format?
    - Test environment?
    - API rate limits?
    - KYC requirements?

## Recommended Next Steps

1. **Research Providers**
    - [ ] Get Heleket API documentation
    - [ ] Get YooKassa API documentation
    - [ ] Understand their capabilities and limitations
    - [ ] Verify currency support
    - [ ] Check if they support test/sandbox mode

2. **Update Enums**
    - [ ] Add Heleket to PaymentProvider enum
    - [ ] Add YooKassa to PaymentProvider enum

3. **Create Provider Configs**
    - [ ] Define HeleketConfig interface
    - [ ] Define YooKassaConfig interface
    - [ ] Update PaymentConfig to include all providers

4. **Implement Providers**
    - [ ] Implement HeleketProvider
    - [ ] Implement YooKassaProvider
    - [ ] Add unit tests for each

5. **Provider Registry**
    - [ ] Create PaymentProviderRegistry
    - [ ] Update PaymentService to use registry
    - [ ] Implement provider selection logic

6. **Integration Testing**
    - [ ] Test with each provider
    - [ ] Test webhook processing
    - [ ] Test balance operations
    - [ ] Test error scenarios

7. **Documentation**
    - [ ] Update API documentation
    - [ ] Document provider configuration
    - [ ] Document provider selection logic

## Provider Isolation Best Practices

### 1. Separate Provider Modules

```
libs/feature/payment/main/src/provider/
├── crypto-bot/
│   ├── crypto-bot.provider.ts
│   ├── crypto-bot.config.ts
│   └── crypto-bot.types.ts
├── heleket/
│   ├── heleket.provider.ts
│   ├── heleket.config.ts
│   └── heleket.types.ts
└── yookassa/
    ├── yookassa.provider.ts
    ├── yookassa.config.ts
    └── yookassa.types.ts
```

### 2. Provider-Specific Types

Each provider can have its own types, but must map to common interface types:

- `PaymentInvoice` (common)
- `PaymentTransaction` (common)
- `PaymentTransfer` (common)

### 3. Shared Components

Keep these shared:

- Provider registry
- Payment service
- Database entities
- Webhook controller
- Configuration loading

### 4. Provider-Specific Components

Keep these provider-specific:

- API client
- Request/response mapping
- Signature verification
- Error handling
- Currency mapping

## Conclusion

The current architecture is well-designed for multi-provider integration. The `IPaymentProvider` interface and Result
pattern provide excellent isolation. The main work is:

1. ✅ Foundation is solid
2. ⚠️ Need to research Heleket and YooKassa
3. ⚠️ Implement provider configs
4. ⚠️ Implement both providers
5. ⚠️ Update PaymentService for provider selection
6. ⚠️ Add comprehensive tests

**Estimated Effort:**

- Research: 2-3 days
- Heleket provider: 5-7 days
- YooKassa provider: 5-7 days
- Integration & testing: 3-5 days
- **Total: ~15-20 days**

**Priority:**

1. Research providers (immediate)
2. Implement provider registry (high)
3. Implement Heleket (high)
4. Implement YooKassa (high)
5. Provider selection logic (medium)
6. Testing (ongoing)
