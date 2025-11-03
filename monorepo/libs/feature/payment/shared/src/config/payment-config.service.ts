import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { PaymentConfig, CryptoBotConfig, PaymentWebhookConfig } from './payment-config.interface';

/**
 * Payment Configuration Service
 *
 * Centralized configuration management for payment system.
 * Validates environment variables and provides type-safe access to config values.
 */
@Injectable()
export class PaymentConfigService {
  /**
   * Joi validation schema for payment environment variables
   */
  static readonly validationSchema: Joi.ObjectSchema = Joi.object({
    // CryptoPay Configuration
    CRYPTO_BOT_API_TOKEN: Joi.string().required().messages({
      'any.required': 'CRYPTO_BOT_API_TOKEN is required for payment system',
      'string.empty': 'CRYPTO_BOT_API_TOKEN cannot be empty',
    }),
    CRYPTO_BOT_API_URL: Joi.string().uri().optional(),
    CRYPTO_BOT_TESTNET: Joi.boolean().default(false),
    CRYPTO_BOT_TIMEOUT: Joi.number().min(1000).max(30000).default(10000),
    CRYPTO_BOT_MAX_RETRIES: Joi.number().min(0).max(5).default(3),

    // Webhook Configuration
    CRYPTO_BOT_WEBHOOK_URL: Joi.string().uri().optional(),
    CRYPTO_BOT_WEBHOOK_SECRET: Joi.string().optional(),
    CRYPTO_BOT_WEBHOOK_TIMEOUT: Joi.number().min(5).max(60).default(30),
    CRYPTO_BOT_WEBHOOK_VERIFY: Joi.boolean().default(true),

    // Payment Limits
    PAYMENT_MIN_TOPUP: Joi.string().pattern(/^\d+(\.\d+)?$/).default('1.00'),
    PAYMENT_MAX_TOPUP: Joi.string().pattern(/^\d+(\.\d+)?$/).default('100000.00'),
    PAYMENT_MIN_WITHDRAWAL: Joi.string().pattern(/^\d+(\.\d+)?$/).default('1.00'),
    PAYMENT_MAX_WITHDRAWAL: Joi.string().pattern(/^\d+(\.\d+)?$/).default('100000.00'),
    PAYMENT_INVOICE_EXPIRATION: Joi.number().min(60).max(2678400).default(86400),
    PAYMENT_MAX_TX_PER_DAY: Joi.number().min(1).max(1000).default(100),

    // Feature Flags
    PAYMENT_FEATURE_TOPUP: Joi.boolean().default(true),
    PAYMENT_FEATURE_WITHDRAWAL: Joi.boolean().default(true),
    PAYMENT_FEATURE_HISTORY: Joi.boolean().default(true),
    PAYMENT_FEATURE_AUTO_CREDIT: Joi.boolean().default(true),
    PAYMENT_FEATURE_TESTNET: Joi.boolean().default(false),
  });

  constructor(private readonly configService: ConfigService<Record<string, unknown>, true>) {}

  /**
   * Get complete payment configuration
   */
  getPaymentConfig(): PaymentConfig {
    return {
      cryptoBot: this.getCryptoBotConfig(),
      webhook: this.getWebhookConfig(),
      features: this.getFeatureFlags(),
      limits: this.getLimitsConfig(),
    };
  }

  /**
   * Get CryptoPay API token (required)
   */
  getCryptoBotApiToken(): string {
    return this.configService.getOrThrow<string>('CRYPTO_BOT_API_TOKEN');
  }

  /**
   * Get CryptoBot configuration
   */
  getCryptoBotConfig(): CryptoBotConfig {
    return {
      apiToken: this.getCryptoBotApiToken(),
      apiUrl: this.configService.get<string>('CRYPTO_BOT_API_URL'),
      testnet: this.configService.get<boolean>('CRYPTO_BOT_TESTNET') ?? false,
      timeout: this.configService.get<number>('CRYPTO_BOT_TIMEOUT') ?? 10000,
      maxRetries: this.configService.get<number>('CRYPTO_BOT_MAX_RETRIES') ?? 3,
    };
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(): PaymentWebhookConfig {
    return {
      url: this.configService.get<string>('CRYPTO_BOT_WEBHOOK_URL'),
      secret: this.configService.get<string>('CRYPTO_BOT_WEBHOOK_SECRET'),
      timeout: this.configService.get<number>('CRYPTO_BOT_WEBHOOK_TIMEOUT') ?? 30,
      verifySignature: this.configService.get<boolean>('CRYPTO_BOT_WEBHOOK_VERIFY') ?? true,
    };
  }

  /**
   * Get payment feature flags
   */
  getFeatureFlags() {
    return {
      topup: this.configService.get<boolean>('PAYMENT_FEATURE_TOPUP') ?? true,
      withdrawal: this.configService.get<boolean>('PAYMENT_FEATURE_WITHDRAWAL') ?? true,
      history: this.configService.get<boolean>('PAYMENT_FEATURE_HISTORY') ?? true,
      autoCredit: this.configService.get<boolean>('PAYMENT_FEATURE_AUTO_CREDIT') ?? true,
      testnetCurrencies: this.configService.get<boolean>('PAYMENT_FEATURE_TESTNET') ?? false,
    };
  }

  /**
   * Get payment limits configuration
   */
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

  /**
   * Check if testnet mode is enabled
   */
  isTestnet(): boolean {
    return this.configService.get<boolean>('CRYPTO_BOT_TESTNET') ?? false;
  }

  /**
   * Check if webhook signature verification is enabled
   */
  isWebhookVerificationEnabled(): boolean {
    return this.configService.get<boolean>('CRYPTO_BOT_WEBHOOK_VERIFY') ?? true;
  }

  /**
   * Check if top-up feature is enabled
   */
  isTopupEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_TOPUP') ?? true;
  }

  /**
   * Check if withdrawal feature is enabled
   */
  isWithdrawalEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_WITHDRAWAL') ?? true;
  }

  /**
   * Check if auto-credit is enabled
   */
  isAutoCreditEnabled(): boolean {
    return this.configService.get<boolean>('PAYMENT_FEATURE_AUTO_CREDIT') ?? true;
  }
}
