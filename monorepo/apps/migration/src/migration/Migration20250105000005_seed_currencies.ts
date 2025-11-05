import { Migration } from '@mikro-orm/migrations';

/**
 * Seed Currencies Data Migration
 *
 * Seeds initial currency data and links user_balances to currencies table.
 *
 * Currencies seeded:
 * - Fiat: USD, EUR, RUB
 * - Crypto: USDT, TON, BTC, ETH, BNB, TRX, USDC, LTC, DOGE, DAI, DASH, BCH, SOL
 *
 * This migration also:
 * - Populates currency_id in user_balances for existing records
 * - Makes currency_id NOT NULL
 * - Adds foreign key constraint
 * - Updates unique constraint to use currency_id
 */
export class Migration20250105000005SeedCurrencies extends Migration {
  async up(): Promise<void> {
    // ========================================
    // PART 1: SEED CURRENCY DATA
    // ========================================

    this.addSql(`
      INSERT INTO currencies (code, name, symbol, type, rate_to_usd, decimal_places)
      VALUES
        -- Fiat currencies
        ('USD', 'US Dollar', '$', 'FIAT', '1.0', 2),
        ('EUR', 'Euro', '€', 'FIAT', '0.92', 2),
        ('RUB', 'Russian Ruble', '₽', 'FIAT', '0.011', 2),

        -- Major cryptocurrencies
        ('BTC', 'Bitcoin', '₿', 'CRYPTO', '45000.0', 8),
        ('ETH', 'Ethereum', 'Ξ', 'CRYPTO', '2500.0', 8),
        ('USDT', 'Tether', '₮', 'CRYPTO', '1.0', 6),
        ('USDC', 'USD Coin', 'USDC', 'CRYPTO', '1.0', 6),
        ('BNB', 'Binance Coin', 'BNB', 'CRYPTO', '300.0', 8),
        ('TON', 'Toncoin', 'TON', 'CRYPTO', '2.5', 8),
        ('TRX', 'Tron', 'TRX', 'CRYPTO', '0.10', 6),

        -- Additional cryptocurrencies
        ('LTC', 'Litecoin', 'Ł', 'CRYPTO', '70.0', 8),
        ('DOGE', 'Dogecoin', 'Ð', 'CRYPTO', '0.08', 8),
        ('DAI', 'Dai', 'DAI', 'CRYPTO', '1.0', 8),
        ('DASH', 'Dash', 'DASH', 'CRYPTO', '30.0', 8),
        ('BCH', 'Bitcoin Cash', 'BCH', 'CRYPTO', '250.0', 8),
        ('SOL', 'Solana', 'SOL', 'CRYPTO', '100.0', 8)
      ON CONFLICT (code) DO NOTHING;
    `);

    // ========================================
    // PART 2: LINK USER_BALANCES TO CURRENCIES
    // ========================================

    // Update existing user_balances records to link to currencies table
    // Map old currency varchar field to new currency_id foreign key
    this.addSql(`
      UPDATE user_balances
      SET currency_id = (
        SELECT id FROM currencies
        WHERE UPPER(currencies.code) = UPPER(user_balances.currency)
      )
      WHERE currency_id IS NULL;
    `);

    // Make currency_id NOT NULL after populating it
    this.addSql(`
      ALTER TABLE user_balances
        ALTER COLUMN currency_id SET NOT NULL;
    `);

    // Add foreign key constraint
    this.addSql(`
      ALTER TABLE user_balances
        ADD CONSTRAINT fk__user_balances__currency
        FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT;
    `);

    // Update unique constraint to use currency_id instead of currency
    this.addSql(`
      ALTER TABLE user_balances
        DROP CONSTRAINT IF EXISTS uq__user_balances__user_currency;
    `);

    this.addSql(`
      ALTER TABLE user_balances
        ADD CONSTRAINT uq__user_balances__user_currency_id
        UNIQUE (user_id, currency_id);
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Restore old structure
    this.addSql(`
      ALTER TABLE user_balances
        DROP CONSTRAINT IF EXISTS uq__user_balances__user_currency_id;
    `);

    this.addSql(`
      ALTER TABLE user_balances
        DROP CONSTRAINT IF EXISTS fk__user_balances__currency;
    `);

    this.addSql(`
      ALTER TABLE user_balances
        ALTER COLUMN currency_id DROP NOT NULL;
    `);

    this.addSql(`
      ALTER TABLE user_balances
        ADD CONSTRAINT uq__user_balances__user_currency
        UNIQUE (user_id, currency);
    `);

    // Delete seeded currency data
    this.addSql(`
      DELETE FROM currencies
      WHERE code IN (
        'USD', 'EUR', 'RUB', 'BTC', 'ETH', 'USDT', 'USDC',
        'BNB', 'TON', 'TRX', 'LTC', 'DOGE', 'DAI', 'DASH', 'BCH', 'SOL'
      );
    `);

    // Ensure async compliance
    await Promise.resolve();
  }
}
