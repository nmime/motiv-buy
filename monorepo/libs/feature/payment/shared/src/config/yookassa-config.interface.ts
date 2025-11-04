/**
 * YooKassa Payment Provider Configuration Interface
 *
 * Configuration for YooKassa payment provider integration.
 * YooKassa is a Russian payment service supporting cards, bank transfers, SBP, and other methods.
 *
 * @interface YooKassaConfig
 */
export interface YooKassaConfig {
  /** YooKassa shop ID (required) */
  shopId: string;

  /** YooKassa secret key (required) */
  secretKey: string;

  /** API base URL (optional, defaults to production) */
  apiUrl?: string;

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

  /** Supported currencies (optional, defaults to RUB) */
  supportedCurrencies?: string[];

  /** Enable automatic payment confirmation (optional, defaults to false) */
  autoCapture?: boolean;

  /** Payment default expiration time in seconds (optional, defaults to 86400) */
  defaultExpiration?: number;

  /** Success redirect URL (optional) */
  successUrl?: string;

  /** Cancel redirect URL (optional) */
  cancelUrl?: string;
}

/**
 * YooKassa Webhook Configuration
 *
 * @interface YooKassaWebhookConfig
 */
export interface YooKassaWebhookConfig {
  /** Webhook URL */
  url?: string;

  /** Webhook secret for signature verification */
  secret?: string;

  /** Enable signature verification */
  verifySignature?: boolean;

  /** Webhook timeout in seconds */
  timeout?: number;

  /** Webhook event types to subscribe to */
  eventTypes?: string[];
}

/**
 * YooKassa Feature Flags
 *
 * @interface YooKassaFeatureFlags
 */
export interface YooKassaFeatureFlags {
  /** Enable top-up payments */
  topup?: boolean;

  /** Enable refunds */
  refunds?: boolean;

  /** Enable refunds via webhook */
  refundsViaWebhook?: boolean;

  /** Enable payment links */
  paymentLinks?: boolean;

  /** Enable saved payment methods */
  savedPaymentMethods?: boolean;

  /** Enable transaction history */
  history?: boolean;

  /** Enable test mode currencies */
  testMode?: boolean;

  /** Enable two-stage payments (authorization only) */
  twoStagePayments?: boolean;
}

/**
 * YooKassa Limits Configuration
 *
 * @interface YooKassaLimitsConfig
 */
export interface YooKassaLimitsConfig {
  /** Minimum payment amount */
  minAmount?: string;

  /** Maximum payment amount */
  maxAmount?: string;

  /** Payment expiration time in seconds */
  paymentExpiration?: number;

  /** Maximum transactions per user per day */
  maxTransactionsPerDay?: number;

  /** Maximum amount per transaction */
  maxAmountPerTransaction?: string;

  /** Minimum refund amount */
  minRefundAmount?: string;

  /** Maximum refund amount */
  maxRefundAmount?: string;
}

/**
 * YooKassa Payment Method Types
 *
 * @interface YooKassaPaymentMethod
 */
export interface YooKassaPaymentMethod {
  /** Payment method type */
  type: 'bank_card' | 'sbp' | 'cash' | 'installments' | 'yoomoney';

  /** Payment method details */
  details?: Record<string, unknown>;
}

/**
 * YooKassa Payment Data
 *
 * @interface YooKassaPaymentData
 */
export interface YooKassaPaymentData {
  /** Payment amount */
  amount: {
    value: string;
    currency: string;
  };

  /** Confirmation method */
  confirmation: {
    type: 'redirect' | 'inline' | 'external';
    return_url?: string;
  };

  /** Payment method */
  payment_method?: YooKassaPaymentMethod;

  /** Capture behavior */
  capture?: boolean;

  /** Description */
  description?: string;

  /** Order ID */
  order_id?: string;

  /** Metadata */
  metadata?: Record<string, string>;
}
