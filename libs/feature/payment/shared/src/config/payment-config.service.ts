import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { CurrencyCode } from '@app/database';
import {
  CryptoBotConfig,
  HelekeConfiguration,
  PaymentConfig,
  PaymentPollingConfig,
  PaymentUpdateStrategy,
  PaymentWebhookConfig,
  YooKassaConfig,
} from './payment-config.interface';

/**
 * Payment configuration service with Joi validation.
 * Provides type-safe access to payment-related environment variables.
 */
@Injectable()
export class PaymentConfigService {
  static readonly validationSchema: Joi.ObjectSchema = Joi.object({
    // CryptoBot
    CRYPTO_BOT_API_TOKEN: Joi.string().optional(),
    CRYPTO_BOT_API_URL: Joi.string().uri().optional(),
    CRYPTO_BOT_TESTNET: Joi.boolean().default(false),
    CRYPTO_BOT_TIMEOUT: Joi.number().min(1000).max(30000).default(10000),
    CRYPTO_BOT_MAX_RETRIES: Joi.number().min(0).max(5).default(3),
    CRYPTO_BOT_UPDATE_STRATEGY: Joi.string().valid('WEBHOOK', 'POLLING', 'HYBRID').default('HYBRID'),
    CRYPTO_BOT_WEBHOOK_URL: Joi.string().uri().optional(),
    CRYPTO_BOT_WEBHOOK_SECRET: Joi.string().optional(),
    CRYPTO_BOT_WEBHOOK_TIMEOUT: Joi.number().min(5).max(60).default(30),
    CRYPTO_BOT_WEBHOOK_VERIFY: Joi.boolean().default(true),

    // Heleket
    HELEKET_API_TOKEN: Joi.string().optional(),
    HELEKET_MERCHANT_ID: Joi.string().optional(),
    HELEKET_API_URL: Joi.string().uri().default('https://api.heleket.com/v1'),
    HELEKET_TEST_MODE: Joi.boolean().default(false),
    HELEKET_TIMEOUT: Joi.number().min(1000).max(30000).default(10000),
    HELEKET_MAX_RETRIES: Joi.number().min(0).max(5).default(3),
    HELEKET_SUCCESS_URL: Joi.string().uri().optional(),
    HELEKET_FAIL_URL: Joi.string().uri().optional(),
    HELEKET_UPDATE_STRATEGY: Joi.string().valid('WEBHOOK', 'POLLING', 'HYBRID').default('HYBRID'),
    HELEKET_WEBHOOK_URL: Joi.string().uri().optional(),

    // YooKassa
    YOOKASSA_SHOP_ID: Joi.string().optional(),
    YOOKASSA_SECRET_KEY: Joi.string().optional(),
    YOOKASSA_API_URL: Joi.string().uri().default('https://api.yookassa.ru/v3'),
    YOOKASSA_TEST_MODE: Joi.boolean().default(false),
    YOOKASSA_TIMEOUT: Joi.number().min(1000).max(30000).default(10000),
    YOOKASSA_MAX_RETRIES: Joi.number().min(0).max(5).default(3),
    YOOKASSA_RETURN_URL: Joi.string().uri().optional(),
    YOOKASSA_UPDATE_STRATEGY: Joi.string().valid('WEBHOOK', 'POLLING', 'HYBRID').default('HYBRID'),
    YOOKASSA_WEBHOOK_URL: Joi.string().uri().optional(),
    YOOKASSA_WEBHOOK_IPS: Joi.string().optional(),

    // Payment Limits
    PAYMENT_MIN_TOPUP: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .default('1.00'),
    PAYMENT_MAX_TOPUP: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .default('100000.00'),
    PAYMENT_MIN_WITHDRAWAL: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .default('1.00'),
    PAYMENT_MAX_WITHDRAWAL: Joi.string()
      .pattern(/^\d+(\.\d+)?$/)
      .default('100000.00'),
    PAYMENT_INVOICE_EXPIRATION: Joi.number().min(60).max(2678400).default(86400),
    PAYMENT_MAX_TX_PER_DAY: Joi.number().min(1).max(1000).default(100),

    // Base Currency (for balance storage and display)
    PAYMENT_BASE_CURRENCY: Joi.string().valid('USD', 'EUR', 'RUB').default('USD'),

    // Feature Flags
    PAYMENT_FEATURE_TOPUP: Joi.boolean().default(true),
    PAYMENT_FEATURE_WITHDRAWAL: Joi.boolean().default(true),
    PAYMENT_FEATURE_HISTORY: Joi.boolean().default(true),
    PAYMENT_FEATURE_AUTO_CREDIT: Joi.boolean().default(true),
    PAYMENT_FEATURE_TESTNET: Joi.boolean().default(false),

    // Polling
    PAYMENT_POLLING_ENABLED: Joi.boolean().default(true),
    PAYMENT_POLLING_INTERVAL: Joi.number().min(5000).max(300000).default(30000),
    PAYMENT_POLLING_MAX_PENDING_AGE: Joi.number().min(1).max(10080).default(1440),
    PAYMENT_POLLING_BATCH_SIZE: Joi.number().min(1).max(500).default(50),
    PAYMENT_POLLING_CRYPTOBOT: Joi.boolean().default(true),
    PAYMENT_POLLING_HELEKE: Joi.boolean().default(true),
    PAYMENT_POLLING_YOOKASSA: Joi.boolean().default(true),
  });

  constructor(private readonly configService: ConfigService<Record<string, unknown>, true>) {}

  private parseUpdateStrategy(value: string | undefined): PaymentUpdateStrategy {
    const normalized = (value ?? 'hybrid').toLowerCase();
    const validStrategies: Record<string, PaymentUpdateStrategy> = {
      webhook: PaymentUpdateStrategy.Webhook,
      polling: PaymentUpdateStrategy.Polling,
      hybrid: PaymentUpdateStrategy.Hybrid,
    };

    return validStrategies[normalized] ?? PaymentUpdateStrategy.Hybrid;
  }

  getPaymentConfig(): PaymentConfig {
    return {
      cryptoBot: this.getCryptoBotConfig(),
      heleket: this.getHelekeConfig(),
      yooKassa: this.getYooKassaConfig(),
      webhook: this.getWebhookConfig(),
      polling: this.getPollingConfig(),
      features: this.getFeatureFlags(),
      limits: this.getLimitsConfig(),
    };
  }

  getCryptoBotApiToken(): string | undefined {
    return this.configService.get<string>('CRYPTO_BOT_API_TOKEN');
  }

  getCryptoBotApiUrl(): string {
    const explicitUrl = this.configService.get<string>('CRYPTO_BOT_API_URL');
    if (explicitUrl) {
      return explicitUrl;
    }

    return this.isTestnet() ? 'https://testnet-pay.crypt.bot/api' : 'https://pay.crypt.bot/api';
  }

  isTestnet(): boolean {
    return this.configService.get<boolean>('CRYPTO_BOT_TESTNET') ?? false;
  }

  getCryptoBotConfig(): CryptoBotConfig {
    return {
      apiToken: this.getCryptoBotApiToken() ?? undefined,
      apiUrl: this.getCryptoBotApiUrl(),
      testnet: this.isTestnet(),
      timeout: this.configService.get<number>('CRYPTO_BOT_TIMEOUT') ?? 10000,
      maxRetries: this.configService.get<number>('CRYPTO_BOT_MAX_RETRIES') ?? 3,
      updateStrategy: this.parseUpdateStrategy(this.configService.get<string>('CRYPTO_BOT_UPDATE_STRATEGY')),
      webhookUrl: this.configService.get<string>('CRYPTO_BOT_WEBHOOK_URL'),
    };
  }

  getHelekeConfig(): HelekeConfiguration {
    return {
      apiToken: this.configService.get<string>('HELEKET_API_TOKEN') ?? undefined,
      merchantId: this.configService.get<string>('HELEKET_MERCHANT_ID') ?? undefined,
      apiUrl: this.configService.get<string>('HELEKET_API_URL'),
      testMode: this.configService.get<boolean>('HELEKET_TEST_MODE') ?? false,
      timeout: this.configService.get<number>('HELEKET_TIMEOUT') ?? 10000,
      maxRetries: this.configService.get<number>('HELEKET_MAX_RETRIES') ?? 3,
      successUrl: this.configService.get<string>('HELEKET_SUCCESS_URL'),
      failUrl: this.configService.get<string>('HELEKET_FAIL_URL'),
      updateStrategy: this.parseUpdateStrategy(this.configService.get<string>('HELEKET_UPDATE_STRATEGY')),
      webhookUrl: this.configService.get<string>('HELEKET_WEBHOOK_URL'),
    };
  }

  getYooKassaConfig(): YooKassaConfig {
    const ipString = this.configService.get<string>('YOOKASSA_WEBHOOK_IPS');

    return {
      shopId: this.configService.get<string>('YOOKASSA_SHOP_ID') ?? undefined,
      secretKey: this.configService.get<string>('YOOKASSA_SECRET_KEY') ?? undefined,
      apiUrl: this.configService.get<string>('YOOKASSA_API_URL'),
      testMode: this.configService.get<boolean>('YOOKASSA_TEST_MODE') ?? false,
      timeout: this.configService.get<number>('YOOKASSA_TIMEOUT') ?? 10000,
      maxRetries: this.configService.get<number>('YOOKASSA_MAX_RETRIES') ?? 3,
      returnUrl: this.configService.get<string>('YOOKASSA_RETURN_URL'),
      updateStrategy: this.parseUpdateStrategy(this.configService.get<string>('YOOKASSA_UPDATE_STRATEGY')),
      webhookUrl: this.configService.get<string>('YOOKASSA_WEBHOOK_URL'),
      allowedWebhookIps: ipString ? ipString.split(',').map((ip) => ip.trim()) : undefined,
    };
  }

  getWebhookConfig(): PaymentWebhookConfig {
    const yooKassaIpString = this.configService.get<string>('YOOKASSA_WEBHOOK_IPS');

    return {
      url: this.configService.get<string>('CRYPTO_BOT_WEBHOOK_URL'),
      secret: this.configService.get<string>('CRYPTO_BOT_WEBHOOK_SECRET'),
      timeout: this.configService.get<number>('CRYPTO_BOT_WEBHOOK_TIMEOUT') ?? 30,
      verifySignature: this.configService.get<boolean>('CRYPTO_BOT_WEBHOOK_VERIFY') ?? true,
      yooKassaAllowedIps: yooKassaIpString ? yooKassaIpString.split(',').map((ip) => ip.trim()) : undefined,
    };
  }

  getPollingConfig(): PaymentPollingConfig {
    return {
      enabled: this.configService.get<boolean>('PAYMENT_POLLING_ENABLED') ?? true,
      interval: this.configService.get<number>('PAYMENT_POLLING_INTERVAL') ?? 30000,
      maxPendingAge: this.configService.get<number>('PAYMENT_POLLING_MAX_PENDING_AGE') ?? 1440,
      batchSize: this.configService.get<number>('PAYMENT_POLLING_BATCH_SIZE') ?? 50,
      providers: {
        cryptoBot: this.configService.get<boolean>('PAYMENT_POLLING_CRYPTOBOT') ?? true,
        heleke: this.configService.get<boolean>('PAYMENT_POLLING_HELEKE') ?? true,
        yooKassa: this.configService.get<boolean>('PAYMENT_POLLING_YOOKASSA') ?? true,
      },
    };
  }

  getFeatureFlags() {
    return {
      topup: this.configService.get<boolean>('PAYMENT_FEATURE_TOPUP') ?? true,
      withdrawal: this.configService.get<boolean>('PAYMENT_FEATURE_WITHDRAWAL') ?? true,
      history: this.configService.get<boolean>('PAYMENT_FEATURE_HISTORY') ?? true,
      autoCredit: this.configService.get<boolean>('PAYMENT_FEATURE_AUTO_CREDIT') ?? true,
      testnetCurrencies: this.configService.get<boolean>('PAYMENT_FEATURE_TESTNET') ?? false,
    };
  }

  getLimitsConfig() {
    return {
      minTopupAmount: this.configService.get<string>('PAYMENT_MIN_TOPUP') ?? '1.00',
      maxTopupAmount: this.configService.get<string>('PAYMENT_MAX_TOPUP') ?? '100000.00',
      minWithdrawalAmount: this.configService.get<string>('PAYMENT_MIN_WITHDRAWAL') ?? '1.00',
      maxWithdrawalAmount: this.configService.get<string>('PAYMENT_MAX_WITHDRAWAL') ?? '100000.00',
      invoiceExpiration: this.configService.get<number>('PAYMENT_INVOICE_EXPIRATION') ?? 86400,
      maxTransactionsPerDay: this.configService.get<number>('PAYMENT_MAX_TX_PER_DAY') ?? 100,
    };
  }

  isWebhookVerificationEnabled(): boolean {
    return this.configService.get<boolean>('CRYPTO_BOT_WEBHOOK_VERIFY') ?? true;
  }

  isTopupEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_TOPUP') ?? true;
  }

  isWithdrawalEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_WITHDRAWAL') ?? true;
  }

  isAutoCreditEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_AUTO_CREDIT') ?? true;
  }

  /**
   * Get base currency for balance storage and display
   * All deposits are converted to this currency
   * All withdrawals are deducted from this currency balance
   */
  getBaseCurrency(): CurrencyCode {
    const currency = this.configService.get<string>('PAYMENT_BASE_CURRENCY') ?? 'USD';
    const currencyMap: Record<string, CurrencyCode> = {
      USD: CurrencyCode.Usd,
      EUR: CurrencyCode.Eur,
      RUB: CurrencyCode.Rub,
    };

    return currencyMap[currency] ?? CurrencyCode.Usd;
  }

  /**
   * Get currency symbol for base currency
   */
  getBaseCurrencySymbol(): string {
    const currency = this.configService.get<string>('PAYMENT_BASE_CURRENCY') ?? 'USD';
    const symbolMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
    };

    return symbolMap[currency] ?? '$';
  }
}
