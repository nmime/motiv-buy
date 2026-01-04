/**
 * Heleket Payment Provider Configuration Interface
 *
 * Configuration for Heleket payment provider integration.
 * Heleket is a universal payment solution supporting various payment methods.
 *
 * @interface HeleketConfig
 */
export interface HeleketConfig {
  /** Heleket API key (required) */
  apiKey: string;

  /** Heleket merchant identifier (required) */
  merchantId: string;

  /** API base URL (optional, defaults to production) */
  apiUrl?: string;

  /** Secret key for webhook signature verification (required) */
  secretKey: string;

  /** Use test/development environment (optional, defaults to false) */
  testMode?: boolean;

  /** Request timeout in milliseconds (optional, defaults to 30000) */
  timeout?: number;

  /** Maximum retries for API requests (optional, defaults to 3) */
  maxRetries?: number;

  /** Webhook URL for callbacks (optional) */
  webhookUrl?: string;

  /** Enable automatic webhook signature verification (optional, defaults to true) */
  verifyWebhookSignature?: boolean;

  /** Supported currencies (optional, auto-detected from account) */
  supportedCurrencies?: string[];

  /** Minimum payment amount (optional) */
  minAmount?: string;

  /** Maximum payment amount (optional) */
  maxAmount?: string;
}

/**
 * Heleket Webhook Configuration
 *
 * @interface HeleketWebhookConfig
 */
export interface HeleketWebhookConfig {
  /** Webhook URL */
  url?: string;

  /** Webhook secret for signature verification */
  secret?: string;

  /** Enable signature verification */
  verifySignature?: boolean;

  /** Webhook timeout in seconds */
  timeout?: number;
}

/**
 * Heleket Feature Flags
 *
 * @interface HeleketFeatureFlags
 */
export interface HeleketFeatureFlags {
  /** Enable top-up payments */
  topup?: boolean;

  /** Enable withdrawals */
  withdrawal?: boolean;

  /** Enable refunds */
  refunds?: boolean;

  /** Enable recurring payments */
  recurring?: boolean;

  /** Enable payment links */
  paymentLinks?: boolean;

  /** Enable transaction history */
  history?: boolean;

  /** Enable test mode currencies */
  testMode?: boolean;
}

/**
 * Heleket Limits Configuration
 *
 * @interface HeleketLimitsConfig
 */
export interface HeleketLimitsConfig {
  /** Minimum top-up amount */
  minTopupAmount?: string;

  /** Maximum top-up amount */
  maxTopupAmount?: string;

  /** Minimum withdrawal amount */
  minWithdrawalAmount?: string;

  /** Maximum withdrawal amount */
  maxWithdrawalAmount?: string;

  /** Payment expiration time in seconds */
  paymentExpiration?: number;

  /** Maximum transactions per user per day */
  maxTransactionsPerDay?: number;

  /** Maximum amount per transaction */
  maxAmountPerTransaction?: string;
}
