import { Migration } from '@mikro-orm/migrations';

export class Migration20251103000001_create_currencies_table extends Migration {
  async up(): Promise<void> {
    // Create currencies table
    this.addSql(`
      CREATE TABLE "currencies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        "code" varchar(10) NOT NULL UNIQUE,
        "name" varchar(50) NOT NULL,
        "symbol" varchar(10),
        "type" varchar(10) NOT NULL CHECK ("type" IN ('FIAT', 'CRYPTO')),
        "rate_to_usd" decimal(20, 8) NOT NULL DEFAULT '1.0',
        "is_active" boolean NOT NULL DEFAULT true,
        "decimal_places" integer NOT NULL DEFAULT 2,
        "rate_updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Add indexes
    this.addSql(`
      CREATE UNIQUE INDEX "ix__currencies__code" ON "currencies" ("code");
    `);

    this.addSql(`
      CREATE INDEX "ix__currencies__type" ON "currencies" ("type");
    `);

    this.addSql(`
      CREATE INDEX "ix__currencies__is_active" ON "currencies" ("is_active");
    `);

    // Insert default currencies
    this.addSql(`
      INSERT INTO "currencies" ("code", "name", "symbol", "type", "rate_to_usd", "decimal_places")
      VALUES
        ('Usd', 'US Dollar', '$', 'FIAT', '1.0', 2),
        ('Eur', 'Euro', '€', 'FIAT', '0.92', 2),
        ('Rub', 'Russian Ruble', '₽', 'FIAT', '0.011', 2),
        ('Btc', 'Bitcoin', '₿', 'CRYPTO', '45000.0', 8),
        ('Eth', 'Ethereum', 'Ξ', 'CRYPTO', '2500.0', 8),
        ('Usdt', 'Tether', '₮', 'CRYPTO', '1.0', 6),
        ('Usdc', 'USD Coin', 'USDC', 'CRYPTO', '1.0', 6),
        ('Bnb', 'Binance Coin', 'BNB', 'CRYPTO', '300.0', 8),
        ('Ton', 'Toncoin', 'TON', 'CRYPTO', '2.5', 8),
        ('Trx', 'Tron', 'TRX', 'CRYPTO', '0.10', 6),
        ('Ltc', 'Litecoin', 'Ł', 'CRYPTO', '70.0', 8)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Add comment
    this.addSql(`
      COMMENT ON TABLE "currencies" IS
      'Currency definitions with USD-based exchange rates';
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS "currencies" CASCADE;');
  }
}
