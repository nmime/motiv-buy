/**
 * Cryptocurrency and fiat currency types supported by payment providers
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
   * Litecoin (Mainnet)
   */
  Ltc = 'LTC',

  /**
   * Dogecoin (Mainnet)
   */
  Doge = 'DOGE',

  /**
   * DAI Stablecoin (Mainnet)
   */
  Dai = 'DAI',

  /**
   * Dash (Mainnet)
   */
  Dash = 'DASH',

  /**
   * Bitcoin Cash (Mainnet)
   */
  Bch = 'BCH',

  /**
   * Solana (Mainnet)
   */
  Sol = 'SOL',

  /**
   * Russian Ruble (Fiat)
   */
  Rub = 'RUB',

  /**
   * US Dollar (Fiat)
   */
  Usd = 'USD',

  /**
   * Euro (Fiat)
   */
  Eur = 'EUR',

  /**
   * Jetton (Testnet only - @CryptoBot test environment)
   * Not available in production
   */
  Jet = 'JET',
}
