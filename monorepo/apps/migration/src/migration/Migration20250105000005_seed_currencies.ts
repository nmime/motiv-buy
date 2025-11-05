import { Migration } from '@mikro-orm/migrations';

/**
 * Seed Currencies Data Migration
 *
 * Seeds initial currency data only.
 *
 * Currencies seeded:
 * - Fiat: USD, EUR, RUB
 * - Crypto: USDT, TON, BTC, ETH, BNB, TRX, USDC, LTC, DOGE, DAI, DASH, BCH, SOL
 */
export class Migration20250105000005SeedCurrencies extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      INSERT INTO currencies (code, name, symbol, type, rate_to_usd, decimal_places)
      VALUES
        -- Fiat currencies
        ('USD', 'US Dollar', '$', 'fiat', '1.0', 2),
        ('EUR', 'Euro', '€', 'fiat', '0.92', 2),
        ('RUB', 'Russian Ruble', '₽', 'fiat', '0.011', 2),

        -- Major cryptocurrencies
        ('BTC', 'Bitcoin', '₿', 'crypto', '45000.0', 8),
        ('ETH', 'Ethereum', 'Ξ', 'crypto', '2500.0', 8),
        ('USDT', 'Tether', '₮', 'crypto', '1.0', 6),
        ('USDC', 'USD Coin', 'USDC', 'crypto', '1.0', 6),
        ('BNB', 'Binance Coin', 'BNB', 'crypto', '300.0', 8),
        ('TON', 'Toncoin', 'TON', 'crypto', '2.5', 8),
        ('TRX', 'Tron', 'TRX', 'crypto', '0.10', 6),

        -- Additional cryptocurrencies
        ('LTC', 'Litecoin', 'Ł', 'crypto', '70.0', 8),
        ('DOGE', 'Dogecoin', 'Ð', 'crypto', '0.08', 8),
        ('DAI', 'Dai', 'DAI', 'crypto', '1.0', 8),
        ('DASH', 'Dash', 'DASH', 'crypto', '30.0', 8),
        ('BCH', 'Bitcoin Cash', 'BCH', 'crypto', '250.0', 8),
        ('SOL', 'Solana', 'SOL', 'crypto', '100.0', 8)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
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
