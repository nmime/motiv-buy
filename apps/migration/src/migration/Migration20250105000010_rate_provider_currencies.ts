import { Migration } from '@mikro-orm/migrations';

/**
 * Rate Provider Currencies Migration
 *
 * Creates rate_provider_currencies table and seeds currency mappings for each provider.
 * Moves hardcoded currency mappings from CurrencyRateService to database.
 *
 * Provider currency mappings:
 * - CoinGecko: Uses coin IDs (bitcoin, ethereum, etc.)
 * - Binance: Uses trading pairs (BTCUSDT, ETHUSDT, etc.)
 * - Kraken: Uses exchange-specific pair names (XXBTZUSD, XETHZUSD, etc.)
 * - ExchangeRate-API/Frankfurter: Uses currency codes (EUR, RUB)
 */
export class Migration20250105000010RateProviderCurrencies extends Migration {
  async up(): Promise<void> {
    // Create rate_provider_currencies table
    this.addSql(`
      CREATE TABLE rate_provider_currencies (
        id uuid NOT NULL DEFAULT uuidv7(),
        provider_id uuid NOT NULL,
        currency_id uuid NOT NULL,
        provider_symbol varchar(50) NOT NULL,
        is_enabled boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk__rate_provider_currencies PRIMARY KEY (id),
        CONSTRAINT uq__rate_provider_currencies__provider_currency UNIQUE (provider_id, currency_id),
        CONSTRAINT fk__rate_provider_currencies__provider FOREIGN KEY (provider_id)
          REFERENCES currency_rate_providers (id) ON DELETE CASCADE,
        CONSTRAINT fk__rate_provider_currencies__currency FOREIGN KEY (currency_id)
          REFERENCES currencies (id) ON DELETE CASCADE
      );
    `);

    // Create indexes
    this.addSql(`
      CREATE INDEX ix__rate_provider_currencies__provider ON rate_provider_currencies (provider_id);
      CREATE INDEX ix__rate_provider_currencies__currency ON rate_provider_currencies (currency_id);
      CREATE INDEX ix__rate_provider_currencies__is_enabled ON rate_provider_currencies (is_enabled);
    `);

    // Seed CoinGecko currency mappings (all crypto currencies)
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, CASE c.code
        WHEN 'BTC' THEN 'bitcoin'
        WHEN 'ETH' THEN 'ethereum'
        WHEN 'USDT' THEN 'tether'
        WHEN 'USDC' THEN 'usd-coin'
        WHEN 'BNB' THEN 'binancecoin'
        WHEN 'TON' THEN 'the-open-network'
        WHEN 'TRX' THEN 'tron'
        WHEN 'LTC' THEN 'litecoin'
        WHEN 'DOGE' THEN 'dogecoin'
        WHEN 'DAI' THEN 'dai'
        WHEN 'DASH' THEN 'dash'
        WHEN 'BCH' THEN 'bitcoin-cash'
        WHEN 'SOL' THEN 'solana'
      END, 10
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'coingecko'
        AND c.code IN ('BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL')
      ON CONFLICT DO NOTHING;
    `);

    // Seed Binance currency mappings
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, CASE c.code
        WHEN 'BTC' THEN 'BTCUSDT'
        WHEN 'ETH' THEN 'ETHUSDT'
        WHEN 'BNB' THEN 'BNBUSDT'
        WHEN 'TON' THEN 'TONUSDT'
        WHEN 'TRX' THEN 'TRXUSDT'
        WHEN 'LTC' THEN 'LTCUSDT'
        WHEN 'DOGE' THEN 'DOGEUSDT'
        WHEN 'SOL' THEN 'SOLUSDT'
        WHEN 'BCH' THEN 'BCHUSDT'
        WHEN 'DASH' THEN 'DASHUSDT'
        WHEN 'DAI' THEN 'DAIUSDT'
        WHEN 'USDC' THEN 'USDCUSDT'
      END, 20
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'binance'
        AND c.code IN ('BTC', 'ETH', 'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'SOL', 'BCH', 'DASH', 'DAI', 'USDC')
      ON CONFLICT DO NOTHING;
    `);

    // Seed CryptoCompare currency mappings
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, c.code, 30
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'cryptocompare'
        AND c.code IN ('BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL')
      ON CONFLICT DO NOTHING;
    `);

    // Seed CoinCap currency mappings
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, CASE c.code
        WHEN 'BTC' THEN 'bitcoin'
        WHEN 'ETH' THEN 'ethereum'
        WHEN 'USDT' THEN 'tether'
        WHEN 'USDC' THEN 'usd-coin'
        WHEN 'BNB' THEN 'binance-coin'
        WHEN 'TON' THEN 'toncoin'
        WHEN 'TRX' THEN 'tron'
        WHEN 'LTC' THEN 'litecoin'
        WHEN 'DOGE' THEN 'dogecoin'
        WHEN 'DAI' THEN 'multi-collateral-dai'
        WHEN 'DASH' THEN 'dash'
        WHEN 'BCH' THEN 'bitcoin-cash'
        WHEN 'SOL' THEN 'solana'
      END, 40
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'coincap'
        AND c.code IN ('BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL')
      ON CONFLICT DO NOTHING;
    `);

    // Seed Kraken currency mappings
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, CASE c.code
        WHEN 'BTC' THEN 'XXBTZUSD'
        WHEN 'ETH' THEN 'XETHZUSD'
        WHEN 'LTC' THEN 'XLTCZUSD'
        WHEN 'DOGE' THEN 'XDGUSD'
        WHEN 'SOL' THEN 'SOLUSD'
        WHEN 'BCH' THEN 'BCHUSD'
        WHEN 'DASH' THEN 'DASHUSD'
        WHEN 'TRX' THEN 'TRXUSD'
        WHEN 'DAI' THEN 'DAIUSD'
        WHEN 'USDC' THEN 'USDCUSD'
        WHEN 'USDT' THEN 'USDTZUSD'
      END, 50
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'kraken'
        AND c.code IN ('BTC', 'ETH', 'LTC', 'DOGE', 'SOL', 'BCH', 'DASH', 'TRX', 'DAI', 'USDC', 'USDT')
      ON CONFLICT DO NOTHING;
    `);

    // Seed ExchangeRate-API currency mappings (fiat)
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, c.code, 10
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'exchangerate_api'
        AND c.code IN ('EUR', 'RUB')
      ON CONFLICT DO NOTHING;
    `);

    // Seed Frankfurter currency mappings (fiat - EUR only, RUB not supported by ECB)
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, c.code, 20
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'frankfurter'
        AND c.code IN ('EUR')
      ON CONFLICT DO NOTHING;
    `);

    // Seed FreeCurrency API currency mappings (fiat)
    this.addSql(`
      INSERT INTO rate_provider_currencies (provider_id, currency_id, provider_symbol, priority)
      SELECT p.id, c.id, c.code, 30
      FROM currency_rate_providers p, currencies c
      WHERE p.name = 'freecurrency_api'
        AND c.code IN ('EUR', 'RUB')
      ON CONFLICT DO NOTHING;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop indexes
    this.addSql(`
      DROP INDEX IF EXISTS ix__rate_provider_currencies__provider;
      DROP INDEX IF EXISTS ix__rate_provider_currencies__currency;
      DROP INDEX IF EXISTS ix__rate_provider_currencies__is_enabled;
    `);

    // Drop table
    this.addSql(`DROP TABLE IF EXISTS rate_provider_currencies;`);

    await Promise.resolve();
  }
}
