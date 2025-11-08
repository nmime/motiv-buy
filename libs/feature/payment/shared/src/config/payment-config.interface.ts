/**
 * Payment update strategy type
 * Determines how payment status updates are received
 */
export enum PaymentUpdateStrategy {
  /** Use webhooks only (push-based) */
  Webhook = 'webhook',
  /** Use polling only (pull-based) */
  Polling = 'polling',
  /** Use both webhooks and polling (hybrid - most reliable) */
  Hybrid = 'hybrid',
}

/**
 * Payment Configuration Interface
 *
 * Defines the structure for payment system configuration including
 * provider integrations, webhook settings, and provider-specific options.
 * Each provider has isolated context and configuration.
 *
 * @interface PaymentConfig
 */
export interface PaymentConfig {
  /** CryptoPay (CryptoBot) configuration */
  cryptoBot: CryptoBotConfig;

  /** Heleket payment gateway configuration */
  heleket: HelekeConfiguration;

  /** YooKassa payment gateway configuration */
  yooKassa: YooKassaConfig;

  /** Webhook configuration */
  webhook?: PaymentWebhookConfig;

  /** Polling configuration */
  polling?: PaymentPollingConfig;

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

  /** Payment update strategy (defaults to Hybrid) */
  updateStrategy?: PaymentUpdateStrategy;

  /** Webhook URL for receiving callbacks */
  webhookUrl?: string;
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

  /** YooKassa allowed IP addresses for webhook verification */
  yooKassaAllowedIps?: string[];
}

/**
 * Payment Polling Configuration
 *
 * Configuration for polling-based status updates.
 */
export interface PaymentPollingConfig {
  /** Enable polling service */
  enabled?: boolean;

  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  interval?: number;

  /** Maximum age of pending transactions to poll (in minutes, default: 1440 = 24 hours) */
  maxPendingAge?: number;

  /** Batch size for polling queries (default: 50) */
  batchSize?: number;

  /** Enable polling for specific providers */
  providers?: {
    cryptoBot?: boolean;
    heleke?: boolean;
    yooKassa?: boolean;
  };
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

/**
 * Heleket Payment Gateway Configuration
 *
 * Configuration for Heleket payment processing integration.
 * Heleket is a Russian payment gateway supporting cards, SBP, and electronic wallets.
 */
export interface HelekeConfiguration {
  /** Heleket API token (required) */
  apiToken: string;

  /** Heleket merchant ID (required) */
  merchantId: string;

  /** API base URL (optional, defaults to production) */
  apiUrl?: string;

  /** Use test mode (defaults to false) */
  testMode?: boolean;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Max retries for API requests */
  maxRetries?: number;

  /** Success callback URL */
  successUrl?: string;

  /** Failure callback URL */
  failUrl?: string;

  /** Payment update strategy (defaults to Hybrid) */
  updateStrategy?: PaymentUpdateStrategy;

  /** Webhook URL for receiving callbacks */
  webhookUrl?: string;
}

/**
 * YooKassa Payment Gateway Configuration
 *
 * Configuration for YooKassa (formerly Yandex.Kassa) integration.
 * YooKassa supports various payment methods including cards, wallets, and bank transfers.
 */
export interface YooKassaConfig {
  /** YooKassa shop ID (required) */
  shopId: string;

  /** YooKassa secret key (required) */
  secretKey: string;

  /** API base URL (optional, defaults to production) */
  apiUrl?: string;

  /** Use test mode (defaults to false) */
  testMode?: boolean;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Max retries for API requests */
  maxRetries?: number;

  /** Return URL after payment */
  returnUrl?: string;

  /** Payment update strategy (defaults to Hybrid) */
  updateStrategy?: PaymentUpdateStrategy;

  /** Webhook URL for receiving callbacks */
  webhookUrl?: string;

  /** Allowed IP addresses for webhook verification */
  allowedWebhookIps?: string[];
}
