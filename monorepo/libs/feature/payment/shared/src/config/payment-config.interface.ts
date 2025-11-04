import type { CryptoBotConfig } from './crypto-bot-config.interface';
import type { HeleketConfig } from './heleket-config.interface';
import type { YooKassaConfig } from './yookassa-config.interface';

/**
 * Payment Configuration Interface
 *
 * Defines the structure for payment system configuration including
 * CryptoPay integration, webhook settings, and provider-specific options.
 *
 * @interface PaymentConfig
 */
export interface PaymentConfig {
  /** CryptoPay (CryptoBot) configuration */
  cryptoBot: CryptoBotConfig;

  /** Heleket configuration (optional) */
  heleket?: HeleketConfig;

  /** YooKassa configuration (optional) */
  yookassa?: YooKassaConfig;

  /** Default payment provider (optional, defaults to CryptoBot) */
  defaultProvider?: string;

  /** Webhook configuration */
  webhook?: PaymentWebhookConfig;

  /** Payment feature flags */
  features?: PaymentFeatureFlags;

  /** Performance and limits */
  limits?: PaymentLimitsConfig;
}

/**
 * Payment Webhook Configuration
 *
 * Configuration for webhook endpoints and security.
 */
export interface PaymentWebhookConfig {
  /** Webhook URL for CryptoPay callbacks */
  url?: string;

  /** Webhook secret for signature verification */
  secret?: string;

  /** Maximum webhook processing time in seconds */
  timeout?: number;

  /** Enable webhook signature verification */
  verifySignature?: boolean;
}

/**
 * Payment Feature Flags
 *
 * Toggle payment features and experimental functionality.
 */
export interface PaymentFeatureFlags {
  /** Enable cryptocurrency top-up */
  topup?: boolean;

  /** Enable cryptocurrency withdrawal */
  withdrawal?: boolean;

  /** Enable transaction history */
  history?: boolean;

  /** Enable automatic balance crediting via webhooks */
  autoCredit?: boolean;

  /** Enable testnet currencies (JET) */
  testnetCurrencies?: boolean;
}

/**
 * Payment Limits Configuration
 *
 * Rate limits and transaction constraints.
 */
export interface PaymentLimitsConfig {
  /** Minimum top-up amount */
  minTopupAmount?: string;

  /** Maximum top-up amount */
  maxTopupAmount?: string;

  /** Minimum withdrawal amount */
  minWithdrawalAmount?: string;

  /** Maximum withdrawal amount */
  maxWithdrawalAmount?: string;

  /** Invoice expiration time in seconds */
  invoiceExpiration?: number;

  /** Maximum transactions per user per day */
  maxTransactionsPerDay?: number;
}
