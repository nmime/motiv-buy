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
