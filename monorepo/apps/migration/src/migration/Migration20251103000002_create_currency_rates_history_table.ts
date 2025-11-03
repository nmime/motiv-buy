import { Migration } from '@mikro-orm/migrations';

export class Migration20251103000002_create_currency_rates_history_table extends Migration {
  async up(): Promise<void> {
    // Create currency_rates_history table
    this.addSql(`
      CREATE TABLE "currency_rates_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        "currency_id" uuid NOT NULL,
        "provider" varchar(30) NOT NULL CHECK ("provider" IN (
          'COINGECKO',
          'BINANCE',
          'CRYPTOCOMPARE',
          'COINCAP',
          'KRAKEN',
          'EXCHANGERATE_API',
          'FRANKFURTER',
          'FREECURRENCY_API',
          'CENTRAL_BANK',
          'MANUAL'
        )),
        "rate_to_usd" decimal(20, 8) NOT NULL,
        "reliability_score" integer NOT NULL DEFAULT 100,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk__currency_rates_history__currency" FOREIGN KEY ("currency_id")
          REFERENCES "currencies" ("id") ON DELETE CASCADE
      );
    `);

    // Add indexes
    this.addSql(`
      CREATE INDEX "ix__currency_rates_history__currency_id" ON "currency_rates_history" ("currency_id");
    `);

    this.addSql(`
      CREATE INDEX "ix__currency_rates_history__provider" ON "currency_rates_history" ("provider");
    `);

    this.addSql(`
      CREATE INDEX "ix__currency_rates_history__created_at" ON "currency_rates_history" ("created_at");
    `);

    this.addSql(`
      CREATE INDEX "ix__currency_rates_history__currency_provider"
      ON "currency_rates_history" ("currency_id", "provider");
    `);

    // Add comment
    this.addSql(`
      COMMENT ON TABLE "currency_rates_history" IS
      'Historical exchange rates from multiple providers for weighted averaging';
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS "currency_rates_history";');
  }
}
