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

  /** Webhook configuration */
  webhook?: PaymentWebhookConfig;

  /** Payment feature flags */
  features?: PaymentFeatureFlags;

  /** Performance and limits */
  limits?: PaymentLimitsConfig;
}

/**
 * CryptoBot Configuration
 *
 * Configuration for CryptoPay API integration.
 */
export interface CryptoBotConfig {
  /** CryptoPay API token (required) */
  apiToken: string;

  /** API base URL (optional, defaults to production) */
  apiUrl?: string;

  /** Use testnet (defaults to false) */
  testnet?: boolean;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Max retries for API requests */
  maxRetries?: number;
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
