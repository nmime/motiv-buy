import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  PaymentProviderConfigEntity,
  ProviderCurrencySupportEntity,
  ProviderRoutingRuleEntity,
  CurrencyEntity,
} from '../entity';
import {
  PaymentProvider,
  CurrencyCode,
  ProviderType,
  ProviderStatus,
  NetworkType,
  RoutingRuleType,
} from '../enum';

/**
 * Seed data service for payment routing configuration
 * Initializes provider configs, currency support, and routing rules
 */
@Injectable()
export class PaymentRoutingSeeder {
  private readonly logger = new Logger(PaymentRoutingSeeder.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Seed all payment routing data
   */
  async seed(): Promise<void> {
    this.logger.log('Starting payment routing seed...');

    await this.seedProviderConfigs();
    await this.seedCurrencySupport();
    await this.seedRoutingRules();

    this.logger.log('Payment routing seed completed successfully');
  }

  /**
   * Seed provider configurations
   */
  private async seedProviderConfigs(): Promise<void> {
    this.logger.log('Seeding provider configurations...');

    const providers = [
      {
        provider: PaymentProvider.CryptoBot,
        providerType: ProviderType.CryptoNative,
        isEnabled: true,
        status: ProviderStatus.Active,
        priority: 10, // Highest priority (default)
        reliabilityScore: 98,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsTelegramIntegration: true,
        supportsNetworkRouting: false,
        autoRoutingEnabled: true,
        maintenanceMode: false,
        maxConcurrentRequests: 100,
        rateLimitPerMinute: 60,
        features: {
          webhooks: true,
          polling: true,
          invoiceExpiration: true,
          transferTracking: true,
        },
        config: {
          webhookUrl: '/api/payment/webhook/crypto-bot',
          signatureVerification: 'hmac-sha256',
        },
      },
      {
        provider: PaymentProvider.Heleket,
        providerType: ProviderType.CryptoNative,
        isEnabled: true,
        status: ProviderStatus.Active,
        priority: 20,
        reliabilityScore: 95,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsTelegramIntegration: false,
        supportsNetworkRouting: true, // Heleket supports multi-network
        autoRoutingEnabled: true,
        maintenanceMode: false,
        maxConcurrentRequests: 50,
        rateLimitPerMinute: 30,
        features: {
          webhooks: true,
          polling: true,
          networkSelection: true,
          lowFees: true,
        },
        config: {
          webhookUrl: '/api/payment/webhook/heleket',
          signatureVerification: 'hmac-sha256',
          preferredNetwork: 'tron', // Prefer TRC-20 for USDT
        },
      },
      {
        provider: PaymentProvider.YooKassa,
        providerType: ProviderType.FiatGateway,
        isEnabled: true,
        status: ProviderStatus.Active,
        priority: 30,
        reliabilityScore: 97,
        supportsDeposits: true,
        supportsWithdrawals: true,
        supportsTelegramIntegration: false,
        supportsNetworkRouting: false,
        autoRoutingEnabled: true,
        maintenanceMode: false,
        maxConcurrentRequests: 50,
        rateLimitPerMinute: 30,
        features: {
          webhooks: true,
          polling: true,
          fiatToRub: true,
          bankCards: true,
        },
        config: {
          webhookUrl: '/api/payment/webhook/yookassa',
          signatureVerification: 'ip-whitelist',
          allowedIps: ['185.71.76.0/27', '185.71.77.0/27'],
        },
      },
    ];

    for (const data of providers) {
      const existing = await this.em.findOne(PaymentProviderConfigEntity, {
        provider: data.provider,
      });

      if (existing) {
        this.logger.log(`Provider ${data.provider} already exists, skipping`);
        continue;
      }

      const entity = this.em.create(PaymentProviderConfigEntity, data);
      this.em.persist(entity);
      this.logger.log(`Created provider config: ${data.provider}`);
    }

    await this.em.flush();
    this.logger.log('Provider configurations seeded');
  }

  /**
   * Seed currency support for each provider
   */
  private async seedCurrencySupport(): Promise<void> {
    this.logger.log('Seeding currency support...');

    // Find all provider configs
    const cryptoBot = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.CryptoBot,
    });
    const heleket = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.Heleket,
    });
    const yookassa = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.YooKassa,
    });

    if (!cryptoBot || !heleket || !yookassa) {
      throw new Error('Provider configs not found. Run seedProviderConfigs first.');
    }

    // Define currency support for each provider
    const currencySupport = [
      // CryptoBot - supports all crypto currencies
      { provider: cryptoBot, code: CurrencyCode.Usdt, network: NetworkType.Tron, isPreferred: false, priority: 20 },
      { provider: cryptoBot, code: CurrencyCode.Usdt, network: NetworkType.Ethereum, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Ton, network: NetworkType.TON, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Btc, network: NetworkType.Bitcoin, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Eth, network: NetworkType.Ethereum, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Bnb, network: NetworkType.BSC, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Trx, network: NetworkType.Tron, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Usdc, network: NetworkType.Ethereum, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Ltc, network: NetworkType.Litecoin, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Doge, network: NetworkType.Dogecoin, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Dai, network: NetworkType.Ethereum, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Dash, network: NetworkType.Dash, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Bch, network: NetworkType.BitcoinCash, isPreferred: true, priority: 10 },
      { provider: cryptoBot, code: CurrencyCode.Sol, network: NetworkType.Solana, isPreferred: true, priority: 10 },

      // Heleket - supports USDT on multiple networks (LOWEST FEES via Tron)
      { provider: heleket, code: CurrencyCode.Usdt, network: NetworkType.Tron, isPreferred: true, priority: 5, networkFee: '1.0' },
      { provider: heleket, code: CurrencyCode.Usdt, network: NetworkType.Ethereum, isPreferred: false, priority: 15, networkFee: '15.0' },
      { provider: heleket, code: CurrencyCode.Usdt, network: NetworkType.BSC, isPreferred: false, priority: 10, networkFee: '0.5' },

      // YooKassa - RUB only
      { provider: yookassa, code: CurrencyCode.Rub, network: NetworkType.Native, isPreferred: true, priority: 10 },
    ];

    for (const data of currencySupport) {
      const currency = await this.em.findOne(CurrencyEntity, { code: data.code });

      if (!currency) {
        this.logger.warn(`Currency ${data.code} not found, skipping`);
        continue;
      }

      const existing = await this.em.findOne(ProviderCurrencySupportEntity, {
        provider: data.provider.id,
        currency: currency.id,
        network: data.network,
      });

      if (existing) {
        this.logger.log(
          `Currency support ${data.provider.provider}/${data.code}/${data.network} already exists, skipping`,
        );
        continue;
      }

      const entity = this.em.create(ProviderCurrencySupportEntity, {
        provider: data.provider,
        currency,
        network: data.network,
        isEnabled: true,
        isPreferred: data.isPreferred,
        routingPriority: data.priority,
        supportsDeposits: true,
        supportsWithdrawals: true,
        minDepositAmount: '1.0',
        minWithdrawalAmount: '1.0',
        networkFeeEstimate: data.networkFee || null,
        reliabilityScore: 95,
      });

      this.em.persist(entity);
      this.logger.log(`Created currency support: ${data.provider.provider}/${data.code}/${data.network}`);
    }

    await this.em.flush();
    this.logger.log('Currency support seeded');
  }

  /**
   * Seed routing rules
   */
  private async seedRoutingRules(): Promise<void> {
    this.logger.log('Seeding routing rules...');

    const cryptoBot = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.CryptoBot,
    });
    const heleket = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.Heleket,
    });
    const yookassa = await this.em.findOne(PaymentProviderConfigEntity, {
      provider: PaymentProvider.YooKassa,
    });
    const usdtCurrency = await this.em.findOne(CurrencyEntity, { code: CurrencyCode.Usdt });
    const rubCurrency = await this.em.findOne(CurrencyEntity, { code: CurrencyCode.Rub });

    if (!cryptoBot || !heleket || !yookassa || !usdtCurrency || !rubCurrency) {
      throw new Error('Required providers or currencies not found');
    }

    const rules = [
      // Rule 1: Cost optimization - Heleket for USDT (lowest fees via Tron)
      {
        name: 'USDT Cost Optimization',
        description: 'Route USDT to Heleket for lowest network fees (TRC-20)',
        ruleType: RoutingRuleType.CostOptimization,
        provider: heleket,
        currency: usdtCurrency,
        isEnabled: true,
        priority: 10,
        weight: 1,
      },

      // Rule 2: Telegram integration - CryptoBot for Telegram users
      {
        name: 'Telegram Users to CryptoBot',
        description: 'Route Telegram users to CryptoBot for seamless integration',
        ruleType: RoutingRuleType.RegionBased,
        provider: cryptoBot,
        currency: null, // Applies to all currencies
        isEnabled: true,
        priority: 5,
        weight: 1,
        allowedPlatforms: ['telegram'],
      },

      // Rule 3: Russian users - YooKassa for RUB
      {
        name: 'Russian Users to YooKassa',
        description: 'Route Russian users to YooKassa for RUB payments',
        ruleType: RoutingRuleType.RegionBased,
        provider: yookassa,
        currency: rubCurrency,
        isEnabled: true,
        priority: 15,
        weight: 1,
        allowedCountries: ['RU', 'BY', 'KZ'],
      },

      // Rule 4: Default fallback - CryptoBot
      {
        name: 'Default Provider',
        description: 'Default fallback to CryptoBot for all other cases',
        ruleType: RoutingRuleType.Default,
        provider: cryptoBot,
        currency: null,
        isEnabled: true,
        priority: 1000,
        weight: 1,
      },
    ];

    for (const data of rules) {
      const existing = await this.em.findOne(ProviderRoutingRuleEntity, {
        name: data.name,
      });

      if (existing) {
        this.logger.log(`Routing rule "${data.name}" already exists, skipping`);
        continue;
      }

      const entity = this.em.create(ProviderRoutingRuleEntity, data);
      this.em.persist(entity);
      this.logger.log(`Created routing rule: ${data.name}`);
    }

    await this.em.flush();
    this.logger.log('Routing rules seeded');
  }

  /**
   * Clear all seeded data (for testing)
   */
  async clear(): Promise<void> {
    this.logger.log('Clearing payment routing data...');

    await this.em.nativeDelete(ProviderRoutingRuleEntity, {});
    await this.em.nativeDelete(ProviderCurrencySupportEntity, {});
    await this.em.nativeDelete(PaymentProviderConfigEntity, {});

    this.logger.log('Payment routing data cleared');
  }
}
