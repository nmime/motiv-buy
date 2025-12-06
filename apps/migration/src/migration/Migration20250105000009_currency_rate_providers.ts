import { Migration } from '@mikro-orm/migrations';

/**
 * Currency Rate Providers Migration
 *
 * Creates currency_rate_providers table and seeds default provider configurations.
 *
 * Providers seeded:
 * - Crypto: CoinGecko, Binance, CryptoCompare, Kraken, CoinCodex, Huobi, OKX
 * - Fiat: ExchangeRate-API, Frankfurter, FreeCurrencyApi, Coinbase, OpenExchangeRates
 */
export class Migration20250105000009CurrencyRateProviders extends Migration {
  async up(): Promise<void> {
    // Create currency_rate_providers table
    this.addSql(`
      CREATE TABLE currency_rate_providers (
        id uuid NOT NULL DEFAULT uuidv7(),
        name varchar(50) NOT NULL,
        type varchar(20) NOT NULL,
        reliability integer NOT NULL DEFAULT 80,
        is_enabled boolean NOT NULL DEFAULT true,
        quota_per_minute integer NULL,
        quota_per_month integer NULL,
        requires_auth boolean NOT NULL DEFAULT false,
        api_key_env_var varchar(100) NULL,
        base_url varchar(255) NULL,
        priority integer NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk__currency_rate_providers PRIMARY KEY (id),
        CONSTRAINT uq__currency_rate_providers__name UNIQUE (name),
        CONSTRAINT ck__currency_rate_providers__type CHECK (type IN ('crypto', 'fiat')),
        CONSTRAINT ck__currency_rate_providers__reliability CHECK (reliability >= 0 AND reliability <= 100)
      );
    `);

    // Create indexes
    this.addSql(`
      CREATE INDEX ix__currency_rate_providers__type ON currency_rate_providers (type);
      CREATE INDEX ix__currency_rate_providers__is_enabled ON currency_rate_providers (is_enabled);
      CREATE INDEX ix__currency_rate_providers__priority ON currency_rate_providers (priority);
    `);

    // Seed default provider configurations
    this.addSql(`
      INSERT INTO currency_rate_providers (name, type, reliability, is_enabled, quota_per_minute, quota_per_month, requires_auth, api_key_env_var, priority)
      VALUES
        -- Crypto providers
        ('coingecko', 'crypto', 95, true, 50, NULL, false, NULL, 10),
        ('binance', 'crypto', 90, true, 2400, NULL, false, NULL, 20),
        ('cryptocompare', 'crypto', 85, true, NULL, 100000, true, 'CRYPTOCOMPARE_API_KEY', 30),
        ('kraken', 'crypto', 90, true, NULL, NULL, false, NULL, 40),
        ('coincodex', 'crypto', 85, true, NULL, NULL, false, NULL, 50),
        ('huobi', 'crypto', 85, true, NULL, NULL, false, NULL, 60),
        ('okx', 'crypto', 85, true, NULL, NULL, false, NULL, 70),

        -- Fiat providers
        ('exchangerate_api', 'fiat', 100, true, NULL, 1500, false, NULL, 10),
        ('frankfurter', 'fiat', 95, true, NULL, NULL, false, NULL, 20),
        ('freecurrency_api', 'fiat', 85, true, NULL, 5000, true, 'FREECURRENCY_API_KEY', 30),
        ('coinbase', 'fiat', 95, true, NULL, NULL, false, NULL, 40),
        ('openexchangerates', 'fiat', 90, true, NULL, NULL, true, 'OPEN_EXCHANGE_RATES_API_KEY', 50)
      ON CONFLICT (name) DO NOTHING;
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop indexes
    this.addSql(`
      DROP INDEX IF EXISTS ix__currency_rate_providers__type;
      DROP INDEX IF EXISTS ix__currency_rate_providers__is_enabled;
      DROP INDEX IF EXISTS ix__currency_rate_providers__priority;
    `);

    // Drop table
    this.addSql(`DROP TABLE IF EXISTS currency_rate_providers;`);

    await Promise.resolve();
  }
}
