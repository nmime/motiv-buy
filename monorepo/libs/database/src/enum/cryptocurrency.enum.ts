/**
 * Cryptocurrency types supported by payment providers
 * Note: This enum includes both mainnet and testnet currencies
 */
export enum Cryptocurrency {
  /**
   * Tether USD (Mainnet)
   */
  Usdt = 'USDT',

  /**
   * Toncoin (Mainnet)
   */
  Ton = 'TON',

  /**
   * Bitcoin (Mainnet)
   */
  Btc = 'BTC',

  /**
   * Ethereum (Mainnet)
   */
  Eth = 'ETH',

  /**
   * Binance Coin (Mainnet)
   */
  Bnb = 'BNB',

  /**
   * Tron (Mainnet)
   */
  Trx = 'TRX',

  /**
   * USD Coin (Mainnet)
   */
  Usdc = 'USDC',

  /**
   * Jetton (Testnet only - @CryptoBot test environment)
   * Not available in production
   */
  Jet = 'JET',
}
