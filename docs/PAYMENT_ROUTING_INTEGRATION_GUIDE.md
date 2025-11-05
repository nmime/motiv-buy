# Payment Routing System - Integration Guide

**Date:** 2025-11-05
**Status:** ⚠️ IMPLEMENTATION IN PROGRESS
**Branch:** `claude/analyze-payments-providers-011CUnKN2miADbBvgmAGGWY3`

---

## Progress Overview

### ✅ COMPLETED (80%)

1. **Database Entities** - 3 entities created
   - PaymentProviderConfigEntity
   - ProviderCurrencySupportEntity
   - ProviderRoutingRuleEntity

2. **Repositories** - 3 repositories implemented
   - PaymentProviderConfigRepository (240 lines)
   - ProviderCurrencySupportRepository (250 lines)
   - ProviderRoutingRuleRepository (230 lines)

3. **Routing Service** - Smart routing logic implemented
   - ProviderRoutingService (340 lines)
   - Context-based routing
   - Rule evaluation
   - Provider validation

4. **API Updates** - DTO changes for user control
   - CreateInvoiceDto (added `provider` field)
   - CreateTransferDto (added `provider` and `destination` fields)

### ⏳ REMAINING (20%)

1. **Service Integration** - Update PaymentService to use routing
2. **Module Configuration** - Import new dependencies
3. **Database Migration** - Create tables with indexes
4. **Seed Data** - Initial provider configuration
5. **Testing** - Integration tests

---

## Step-by-Step Integration

### STEP 1: Update PaymentService (15 minutes)

**File:** `libs/feature/payment/main/src/service/payment.service.ts`

#### Changes Required:

```typescript
// 1. Add import
import { ProviderRoutingService, RoutingContext } from './provider-routing.service';

// 2. Inject service in constructor
constructor(
  // ... existing dependencies ...
  private readonly routingService: ProviderRoutingService,
) {}

// 3. Update createTopUp method signature (remove default parameter)
async createTopUp(
  userId: string,
  dto: CreateInvoiceDto,
  providerType?: PaymentProvider,  // ← Remove default, make optional
): AsyncResult<InvoiceResponseDto, Error> {
  try {
    this.logger.log(`Creating top-up invoice for user ${userId}`);

    // NEW: Determine provider using smart routing
    let selectedProvider: PaymentProvider;

    if (providerType || dto.provider) {
      // User specified provider explicitly
      selectedProvider = providerType || dto.provider!;
    } else {
      // Use smart routing
      const context: RoutingContext = {
        currency: dto.currency,
        amount: dto.amount,
        userId,
        operation: 'deposit',
        // Add more context if available
        // userCountry: user.country,
        // platform: 'telegram',
        // isVip: user.isVip,
      };

      const routingResult = await this.routingService.selectDepositProvider(context);

      if (routingResult.err) {
        this.logger.error('Failed to select provider', routingResult.val);
        return Err(new Error('No suitable payment provider available'));
      }

      selectedProvider = routingResult.val;
    }

    this.logger.log(`Selected provider: ${selectedProvider}`);

    // Get the appropriate payment provider
    const provider = this.providerFactory.getProvider(selectedProvider);

    // ... rest of existing code (no changes) ...
  }
}

// 4. Update createWithdrawal method similarly
async createWithdrawal(
  userId: string,
  dto: CreateTransferDto,
  providerType?: PaymentProvider,  // ← Remove default, make optional
): AsyncResult<TransferResponseDto, Error> {
  // ... existing balance locking code ...

  try {
    // NEW: Determine provider using smart routing
    let selectedProvider: PaymentProvider;

    if (providerType || dto.provider) {
      selectedProvider = providerType || dto.provider!;
    } else {
      // Use smart routing
      const context: RoutingContext = {
        currency: dto.currency,
        amount: dto.amount,
        userId,
        operation: 'withdrawal',
        // Add more context if available
      };

      const routingResult = await this.routingService.selectWithdrawalProvider(context);

      if (routingResult.err) {
        this.logger.error('Failed to select provider', routingResult.val);
        return Err(new Error('No suitable payment provider available'));
      }

      selectedProvider = routingResult.val;
    }

    this.logger.log(`Selected provider for withdrawal: ${selectedProvider}`);

    // Get the appropriate payment provider
    const provider = this.providerFactory.getProvider(selectedProvider);

    // Create transfer via payment provider
    const transferResult = await provider.createTransfer({
      userId: dto.userId,
      amount: dto.amount,
      currency: cryptocurrency,
      comment: dto.comment,
      destination: dto.destination,  // ← NEW: Pass destination
    });

    // ... rest of existing code ...
  }
}
```

**Key Changes:**
- Remove hardcoded `PaymentProvider.CryptoBot` defaults
- Inject `ProviderRoutingService`
- Use `dto.provider` if user specified
- Otherwise call `selectDepositProvider()` or `selectWithdrawalProvider()`
- Pass `destination` parameter to withdrawals

---

### STEP 2: Update PaymentMainModule (5 minutes)

**File:** `libs/feature/payment/main/src/payment-main.module.ts`

#### Changes Required:

```typescript
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PaymentSharedModule } from '@app/feature-payment-shared';
import { DatabaseModule, PaymentTransactionEntity } from '@app/database';
import { BalanceMainModule } from '@app/feature-balance-main';

// NEW IMPORTS
import {
  PaymentProviderConfigRepository,
  ProviderCurrencySupportRepository,
  ProviderRoutingRuleRepository,
} from '@app/database';

import { CryptoBotProvider } from './provider/crypto-bot.provider';
import { HelekeProvider } from './provider/heleket.provider';
import { YooKassaProvider } from './provider/yookassa.provider';
import { PaymentProviderFactory } from './service/payment-provider.factory';
import { PaymentService } from './service/payment.service';
import { PaymentPollingService } from './service/payment-polling.service';
import { ProviderRoutingService } from './service/provider-routing.service';  // NEW
import { PaymentController } from './controller/payment.controller';
import { PaymentWebhookController } from './controller/payment-webhook.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([PaymentTransactionEntity]),
    PaymentSharedModule,
    DatabaseModule,
    BalanceMainModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    // Provider implementations
    CryptoBotProvider,
    HelekeProvider,
    YooKassaProvider,

    // Factories and services
    PaymentProviderFactory,
    PaymentService,
    PaymentPollingService,

    // NEW: Routing infrastructure
    ProviderRoutingService,
    PaymentProviderConfigRepository,
    ProviderCurrencySupportRepository,
    ProviderRoutingRuleRepository,
  ],
  exports: [PaymentService, PaymentProviderFactory],
})
export class PaymentMainModule {}
```

**Key Changes:**
- Import 3 new repositories
- Import `ProviderRoutingService`
- Add all to providers array

---

### STEP 3: Create Database Migration (10 minutes)

**Create file:** `monorepo/apps/api/src/migrations/Migration_YYYYMMDDHHMMSS_add_provider_routing.ts`

```typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration_YYYYMMDDHHMMSS_add_provider_routing extends Migration {
  async up(): Promise<void> {
    // 1. Create payment_provider_configs table
    this.addSql(`
      CREATE TABLE payment_provider_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        provider VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        provider_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        supports_deposits BOOLEAN NOT NULL DEFAULT TRUE,
        supports_withdrawals BOOLEAN NOT NULL DEFAULT TRUE,
        supports_balance_check BOOLEAN NOT NULL DEFAULT TRUE,
        priority INTEGER NOT NULL DEFAULT 100,
        reliability_score INTEGER NOT NULL DEFAULT 95,
        update_strategy VARCHAR(20) NOT NULL DEFAULT 'HYBRID',
        webhook_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        webhook_verification_method VARCHAR(20),
        polling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        polling_interval_ms INTEGER NOT NULL DEFAULT 30000,
        api_url VARCHAR(255),
        api_timeout_ms INTEGER NOT NULL DEFAULT 10000,
        max_retries INTEGER NOT NULL DEFAULT 3,
        base_fee_percentage DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
        fixed_fee_usd DECIMAL(20,8) NOT NULL DEFAULT 0.00000000,
        supports_telegram_integration BOOLEAN NOT NULL DEFAULT FALSE,
        supports_network_routing BOOLEAN NOT NULL DEFAULT FALSE,
        supports_fiat_conversion BOOLEAN NOT NULL DEFAULT FALSE,
        supports_bank_cards BOOLEAN NOT NULL DEFAULT FALSE,
        min_deposit_usd DECIMAL(20,8),
        max_deposit_usd DECIMAL(20,8),
        min_withdrawal_usd DECIMAL(20,8),
        max_withdrawal_usd DECIMAL(20,8),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes
    this.addSql(`CREATE INDEX ix__payment_provider_configs__status ON payment_provider_configs(status);`);
    this.addSql(`CREATE INDEX ix__payment_provider_configs__is_enabled ON payment_provider_configs(is_enabled);`);
    this.addSql(`CREATE INDEX ix__payment_provider_configs__priority ON payment_provider_configs(priority);`);

    // 2. Create provider_currency_support table
    this.addSql(`
      CREATE TABLE provider_currency_support (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        provider_id UUID NOT NULL REFERENCES payment_provider_configs(id) ON DELETE CASCADE,
        currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
        network VARCHAR(30) NOT NULL DEFAULT 'NATIVE',
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
        supports_deposits BOOLEAN NOT NULL DEFAULT TRUE,
        supports_withdrawals BOOLEAN NOT NULL DEFAULT TRUE,
        fee_percentage DECIMAL(10,4),
        fixed_fee DECIMAL(20,8),
        network_fee_estimate DECIMAL(20,8),
        min_deposit_amount DECIMAL(20,8),
        max_deposit_amount DECIMAL(20,8),
        min_withdrawal_amount DECIMAL(20,8),
        max_withdrawal_amount DECIMAL(20,8),
        avg_confirmation_time_seconds INTEGER DEFAULT 0,
        reliability_score INTEGER NOT NULL DEFAULT 95,
        routing_priority INTEGER NOT NULL DEFAULT 100,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider_id, currency_id, network)
      );
    `);

    // Indexes
    this.addSql(`CREATE INDEX ix__provider_currency_support__provider ON provider_currency_support(provider_id);`);
    this.addSql(`CREATE INDEX ix__provider_currency_support__currency ON provider_currency_support(currency_id);`);
    this.addSql(`CREATE INDEX ix__provider_currency_support__is_enabled ON provider_currency_support(is_enabled);`);
    this.addSql(`CREATE INDEX ix__provider_currency_support__is_preferred ON provider_currency_support(is_preferred);`);

    // 3. Create provider_routing_rules table
    this.addSql(`
      CREATE TABLE provider_routing_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        rule_type VARCHAR(30) NOT NULL,
        provider_id UUID REFERENCES payment_provider_configs(id) ON DELETE CASCADE,
        currency_id UUID REFERENCES currencies(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL DEFAULT 100,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        conditions JSONB,
        active_from_time TIME,
        active_to_time TIME,
        active_days_of_week VARCHAR(7)[],
        active_from_date DATE,
        active_to_date DATE,
        min_amount_usd DECIMAL(20,8),
        max_amount_usd DECIMAL(20,8),
        allowed_countries VARCHAR(2)[],
        blocked_countries VARCHAR(2)[],
        allowed_platforms VARCHAR(20)[],
        verified_users_only BOOLEAN NOT NULL DEFAULT FALSE,
        vip_users_only BOOLEAN NOT NULL DEFAULT FALSE,
        fallback_rule_id UUID,
        weight INTEGER NOT NULL DEFAULT 100,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Indexes
    this.addSql(`CREATE INDEX ix__provider_routing_rules__rule_type ON provider_routing_rules(rule_type);`);
    this.addSql(`CREATE INDEX ix__provider_routing_rules__is_enabled ON provider_routing_rules(is_enabled);`);
    this.addSql(`CREATE INDEX ix__provider_routing_rules__priority ON provider_routing_rules(priority);`);
    this.addSql(`CREATE INDEX ix__provider_routing_rules__provider ON provider_routing_rules(provider_id);`);
    this.addSql(`CREATE INDEX ix__provider_routing_rules__currency ON provider_routing_rules(currency_id);`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS provider_routing_rules CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS provider_currency_support CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS payment_provider_configs CASCADE;`);
  }
}
```

**Run Migration:**
```bash
npm run migration:create
npm run migration:up
```

---

### STEP 4: Create Seed Data Service (30 minutes)

**Create file:** `libs/database/src/seed/payment-provider.seed.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  PaymentProviderConfigEntity,
  ProviderStatus,
  ProviderType,
  UpdateStrategy,
} from '../entity/PaymentProviderConfig.entity';
import {
  ProviderCurrencySupportEntity,
  NetworkType,
} from '../entity/ProviderCurrencySupport.entity';
import {
  ProviderRoutingRuleEntity,
  RoutingRuleType,
} from '../entity/ProviderRoutingRule.entity';
import { PaymentProvider, CurrencyCode } from '../enum';

/**
 * Seed service for payment provider configuration
 * Creates initial provider configs, currency support, and routing rules
 */
@Injectable()
export class PaymentProviderSeedService implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderSeedService.name);

  constructor(private readonly em: EntityManager) {}

  async onModuleInit() {
    // Optionally run seed automatically in development
    // await this.seed();
  }

  /**
   * Main seed method - call this manually or via API
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting payment provider seed...');

      await this.seedProviderConfigs();
      await this.seedCurrencySupport();
      await this.seedRoutingRules();

      this.logger.log('✅ Payment provider seed completed successfully');
    } catch (error) {
      this.logger.error('❌ Payment provider seed failed', error);
      throw error;
    }
  }

  /**
   * Seed provider configurations
   */
  private async seedProviderConfigs(): Promise<void> {
    this.logger.log('Seeding provider configurations...');

    const providers = [
      {
        provider: PaymentProvider.CryptoBot,
        displayName: 'CryptoBot (Crypto Pay)',
        providerType: ProviderType.CryptoNative,
        status: ProviderStatus.Active,
        isEnabled: true,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsBalanceCheck: true,
        priority: 10, // Highest priority (Telegram native)
        reliabilityScore: 95,
        updateStrategy: UpdateStrategy.Hybrid,
        webhookEnabled: true,
        webhookVerificationMethod: 'HMAC-SHA256',
        pollingEnabled: true,
        pollingIntervalMs: 30000,
        apiUrl: 'https://pay.crypt.bot/api',
        apiTimeoutMs: 10000,
        maxRetries: 3,
        baseFeePercentage: '0.0000', // No platform fee
        fixedFeeUsd: '0.00000000',
        supportsTelegramIntegration: true,
        supportsNetworkRouting: false,
        supportsFiatConversion: false,
        supportsBankCards: false,
        metadata: {
          description: 'Telegram-native cryptocurrency payment gateway',
          bestFor: ['telegram_users', 'instant_payments'],
        },
      },
      {
        provider: PaymentProvider.Heleket,
        displayName: 'Heleket',
        providerType: ProviderType.CryptoNative,
        status: ProviderStatus.Active,
        isEnabled: true,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsBalanceCheck: true,
        priority: 20, // Second priority (best for cost optimization)
        reliabilityScore: 90,
        updateStrategy: UpdateStrategy.Hybrid,
        webhookEnabled: true,
        webhookVerificationMethod: 'HMAC-SHA256',
        pollingEnabled: true,
        pollingIntervalMs: 30000,
        apiUrl: 'https://api.heleket.com/v1',
        apiTimeoutMs: 10000,
        maxRetries: 3,
        baseFeePercentage: '0.0050', // 0.5% platform fee
        fixedFeeUsd: '0.00000000',
        supportsTelegramIntegration: false,
        supportsNetworkRouting: true, // Smart network routing
        supportsFiatConversion: false,
        supportsBankCards: false,
        metadata: {
          description: 'Multi-network crypto gateway with cost optimization',
          bestFor: ['cost_optimization', 'multi_chain'],
        },
      },
      {
        provider: PaymentProvider.YooKassa,
        displayName: 'YooKassa (Yandex Kassa)',
        providerType: ProviderType.FiatGateway,
        status: ProviderStatus.Active,
        isEnabled: true,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsBalanceCheck: false, // YooKassa doesn't provide balance API
        priority: 30, // Third priority (fiat gateway for Russian market)
        reliabilityScore: 95,
        updateStrategy: UpdateStrategy.Hybrid,
        webhookEnabled: true,
        webhookVerificationMethod: 'IP_WHITELIST',
        pollingEnabled: true,
        pollingIntervalMs: 30000,
        apiUrl: 'https://api.yookassa.ru/v3',
        apiTimeoutMs: 10000,
        maxRetries: 3,
        baseFeePercentage: '0.0200', // 2% platform fee + conversion
        fixedFeeUsd: '0.00000000',
        supportsTelegramIntegration: false,
        supportsNetworkRouting: false,
        supportsFiatConversion: true, // Crypto → RUB conversion
        supportsBankCards: true,
        metadata: {
          description: 'Russian fiat payment gateway with crypto conversion',
          bestFor: ['russian_market', 'fiat_payments', 'bank_cards'],
        },
      },
    ];

    for (const data of providers) {
      const existing = await this.em.findOne(PaymentProviderConfigEntity, {
        provider: data.provider,
      });

      if (!existing) {
        const entity = this.em.create(PaymentProviderConfigEntity, data);
        this.em.persist(entity);
        this.logger.log(`  Created provider: ${data.displayName}`);
      } else {
        this.logger.log(`  Provider already exists: ${data.displayName}`);
      }
    }

    await this.em.flush();
  }

  /**
   * Seed currency support for all providers
   */
  private async seedCurrencySupport(): Promise<void> {
    this.logger.log('Seeding currency support...');

    // Get all providers and currencies
    const cryptoBot = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.CryptoBot,
    });
    const heleket = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.Heleket,
    });
    const yooKassa = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.YooKassa,
    });

    if (!cryptoBot || !heleket || !yooKassa) {
      throw new Error('Providers not found - run provider config seed first');
    }

    // All supported cryptocurrencies
    const allCryptos = [
      CurrencyCode.Btc,
      CurrencyCode.Eth,
      CurrencyCode.Usdt,
      CurrencyCode.Usdc,
      CurrencyCode.Ton,
      CurrencyCode.Bnb,
      CurrencyCode.Trx,
      CurrencyCode.Ltc,
      CurrencyCode.Doge,
      CurrencyCode.Dai,
      CurrencyCode.Dash,
      CurrencyCode.Bch,
      CurrencyCode.Sol,
    ];

    let count = 0;

    // CryptoBot: All cryptocurrencies, native networks
    for (const code of allCryptos) {
      const currency = await this.em.findOne('CurrencyEntity', { code });
      if (!currency) continue;

      const exists = await this.em.count(ProviderCurrencySupportEntity, {
        provider: cryptoBot,
        currency,
        network: NetworkType.Native,
      });

      if (exists === 0) {
        const support = this.em.create(ProviderCurrencySupportEntity, {
          provider: cryptoBot,
          currency,
          network: NetworkType.Native,
          isEnabled: true,
          isPreferred: true, // Native is preferred for CryptoBot
          supportsDeposits: true,
          supportsWithdrawals: true,
          routingPriority: 10,
          reliabilityScore: 95,
        });
        this.em.persist(support);
        count++;
      }
    }

    // Heleket: Multi-network support with smart routing
    const helekeSupport = [
      { code: CurrencyCode.Usdt, network: NetworkType.Tron, preferred: true }, // TRC-20 (cheapest)
      { code: CurrencyCode.Usdt, network: NetworkType.Ethereum, preferred: false }, // ERC-20
      { code: CurrencyCode.Usdc, network: NetworkType.Ethereum, preferred: true }, // ERC-20
      { code: CurrencyCode.Btc, network: NetworkType.Bitcoin, preferred: true },
      { code: CurrencyCode.Eth, network: NetworkType.Ethereum, preferred: true },
      { code: CurrencyCode.Bnb, network: NetworkType.BSC, preferred: true },
      { code: CurrencyCode.Trx, network: NetworkType.Tron, preferred: true },
      { code: CurrencyCode.Ton, network: NetworkType.TON, preferred: true },
      { code: CurrencyCode.Ltc, network: NetworkType.Litecoin, preferred: true },
      { code: CurrencyCode.Doge, network: NetworkType.Dogecoin, preferred: true },
      { code: CurrencyCode.Dai, network: NetworkType.Ethereum, preferred: true }, // ERC-20
      { code: CurrencyCode.Dash, network: NetworkType.Dash, preferred: true },
      { code: CurrencyCode.Bch, network: NetworkType.BitcoinCash, preferred: true },
      { code: CurrencyCode.Sol, network: NetworkType.Solana, preferred: true },
    ];

    for (const item of helekeSupport) {
      const currency = await this.em.findOne('CurrencyEntity', { code: item.code });
      if (!currency) continue;

      const exists = await this.em.count(ProviderCurrencySupportEntity, {
        provider: heleket,
        currency,
        network: item.network,
      });

      if (exists === 0) {
        const support = this.em.create(ProviderCurrencySupportEntity, {
          provider: heleket,
          currency,
          network: item.network,
          isEnabled: true,
          isPreferred: item.preferred,
          supportsDeposits: true,
          supportsWithdrawals: true,
          routingPriority: 20,
          reliabilityScore: 90,
        });
        this.em.persist(support);
        count++;
      }
    }

    // YooKassa: All cryptocurrencies (converted to RUB)
    for (const code of allCryptos) {
      const currency = await this.em.findOne('CurrencyEntity', { code });
      if (!currency) continue;

      const exists = await this.em.count(ProviderCurrencySupportEntity, {
        provider: yooKassa,
        currency,
        network: NetworkType.Native, // Doesn't matter, converts to RUB
      });

      if (exists === 0) {
        const support = this.em.create(ProviderCurrencySupportEntity, {
          provider: yooKassa,
          currency,
          network: NetworkType.Native,
          isEnabled: true,
          isPreferred: false,
          supportsDeposits: true,
          supportsWithdrawals: true,
          routingPriority: 30,
          reliabilityScore: 95,
        });
        this.em.persist(support);
        count++;
      }
    }

    await this.em.flush();
    this.logger.log(`  Created ${count} currency support entries`);
  }

  /**
   * Seed default routing rules
   */
  private async seedRoutingRules(): Promise<void> {
    this.logger.log('Seeding routing rules...');

    const cryptoBot = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.CryptoBot,
    });
    const heleket = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.Heleket,
    });
    const yooKassa = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.YooKassa,
    });

    const rules = [
      {
        name: 'Telegram Users → CryptoBot',
        description: 'Route Telegram platform users to CryptoBot for best integration',
        ruleType: RoutingRuleType.RegionBased,
        provider: cryptoBot,
        currency: null, // Applies to all currencies
        priority: 10,
        isEnabled: true,
        allowedPlatforms: ['telegram'],
        metadata: { reason: 'Best Telegram integration' },
      },
      {
        name: 'Russian Users → YooKassa',
        description: 'Route Russian users to YooKassa fiat gateway',
        ruleType: RoutingRuleType.RegionBased,
        provider: yooKassa,
        currency: null,
        priority: 20,
        isEnabled: true,
        allowedCountries: ['RU', 'BY', 'KZ'],
        metadata: { reason: 'Fiat gateway for CIS region' },
      },
      {
        name: 'Cost Optimization → Heleket',
        description: 'Route to Heleket for cost-optimized multi-chain routing',
        ruleType: RoutingRuleType.CostOptimization,
        provider: heleket,
        currency: null,
        priority: 30,
        isEnabled: true,
        metadata: { reason: 'Lowest fees via smart network routing' },
      },
      {
        name: 'Default Fallback → CryptoBot',
        description: 'Default provider when no other rules match',
        ruleType: RoutingRuleType.Default,
        provider: cryptoBot,
        currency: null,
        priority: 1000, // Lowest priority
        isEnabled: true,
        metadata: { reason: 'Safe default with widest support' },
      },
    ];

    let count = 0;

    for (const ruleData of rules) {
      const exists = await this.em.count(ProviderRoutingRuleEntity, {
        name: ruleData.name,
      });

      if (exists === 0) {
        const rule = this.em.create(ProviderRoutingRuleEntity, ruleData);
        this.em.persist(rule);
        count++;
      }
    }

    await this.em.flush();
    this.logger.log(`  Created ${count} routing rules`);
  }
}
```

**Usage:**
```typescript
// In a controller or service:
await paymentProviderSeedService.seed();
```

---

### STEP 5: Testing (20 minutes)

#### Manual Testing

```bash
# Test deposit with auto-routing
curl -X POST http://localhost:3000/payment/topup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100.0",
    "currency": "USDT"
  }'
# Should automatically select best provider

# Test deposit with explicit provider
curl -X POST http://localhost:3000/payment/topup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100.0",
    "currency": "USDT",
    "provider": "HELEKET"
  }'
# Should use Heleket

# Test withdrawal
curl -X POST http://localhost:3000/payment/withdraw \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123456789",
    "amount": "50.0",
    "currency": "USDT",
    "provider": "YOOKASSA",
    "destination": "1234567890123456"
  }'
# Should use YooKassa with bank card
```

#### Integration Tests

**Create file:** `libs/feature/payment/main/src/service/provider-routing.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ProviderRoutingService, RoutingContext } from './provider-routing.service';
import { PaymentProvider, CurrencyCode } from '@app/database';

describe('ProviderRoutingService', () => {
  let service: ProviderRoutingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProviderRoutingService,
        // Mock repositories
      ],
    }).compile();

    service = module.get(ProviderRoutingService);
  });

  describe('selectDepositProvider', () => {
    it('should use preferred provider when specified', async () => {
      const context: RoutingContext = {
        currency: CurrencyCode.Usdt,
        amount: '100',
        userId: 'user123',
        preferredProvider: PaymentProvider.Heleket,
        operation: 'deposit',
      };

      const result = await service.selectDepositProvider(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(PaymentProvider.Heleket);
      }
    });

    it('should route Telegram users to CryptoBot', async () => {
      const context: RoutingContext = {
        currency: CurrencyCode.Usdt,
        amount: '100',
        userId: 'user123',
        platform: 'telegram',
        operation: 'deposit',
      };

      const result = await service.selectDepositProvider(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(PaymentProvider.CryptoBot);
      }
    });

    it('should route Russian users to YooKassa', async () => {
      const context: RoutingContext = {
        currency: CurrencyCode.Usdt,
        amount: '100',
        userId: 'user123',
        userCountry: 'RU',
        operation: 'deposit',
      };

      const result = await service.selectDepositProvider(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val).toBe(PaymentProvider.YooKassa);
      }
    });
  });
});
```

---

## Summary

### What's Done ✅

1. **Database Schema** - 3 entities (provider config, currency support, routing rules)
2. **Repositories** - Full CRUD operations for all entities
3. **Routing Service** - Smart provider selection logic
4. **API Updates** - DTOs support provider selection

### What's Left ⏳

1. **Service Integration** - Update PaymentService (15 min)
2. **Module Config** - Add providers to PaymentMainModule (5 min)
3. **Migration** - Create database tables (10 min)
4. **Seed Data** - Initial configuration (30 min)
5. **Testing** - Verify routing works (20 min)

### Total Remaining Time: ~80 minutes

---

## Quick Start Checklist

```bash
# 1. Update PaymentService
vim libs/feature/payment/main/src/service/payment.service.ts
# Add routing logic as shown in STEP 1

# 2. Update PaymentMainModule
vim libs/feature/payment/main/src/payment-main.module.ts
# Add providers as shown in STEP 2

# 3. Create migration
npm run migration:create
# Copy migration code from STEP 3
npm run migration:up

# 4. Create and run seed
# Create seed file as shown in STEP 4
# Run: await paymentProviderSeedService.seed()

# 5. Test
npm run test
curl -X POST http://localhost:3000/payment/topup ...

# 6. Deploy
git add -A
git commit -m "feat: complete payment routing integration"
git push
```

---

## Support

For issues during integration:
1. Check migration ran successfully: `SELECT * FROM payment_provider_configs;`
2. Verify seed data exists: `SELECT COUNT(*) FROM provider_currency_support;`
3. Check logs for routing decisions: Look for "Selected provider: X"
4. Test explicit provider selection first before auto-routing

---

**Last Updated:** 2025-11-05
**Status:** Ready for Integration
**Estimated Completion:** 80 minutes
