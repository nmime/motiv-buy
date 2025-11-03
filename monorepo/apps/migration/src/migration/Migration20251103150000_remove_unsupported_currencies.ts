import { Migration } from '@mikro-orm/migrations';

/**
 * Remove currencies that are not supported in XRocket database
 * Removes: LTC (Litecoin)
 * Note: USDC is kept as it's commonly used despite not being in XRocket
 */
export class Migration20251103150000_remove_unsupported_currencies extends Migration {
  async up(): Promise<void> {
    // Remove LTC from currencies table
    this.addSql(`
      DELETE FROM "currencies"
      WHERE "code" = 'Ltc';
    `);
  }

  async down(): Promise<void> {
    // Re-insert LTC if rolling back
    this.addSql(`
      INSERT INTO "currencies" ("code", "name", "symbol", "type", "rate_to_usd", "decimal_places")
      VALUES
        ('Ltc', 'Litecoin', 'Ł', 'CRYPTO', '70.0', 8)
      ON CONFLICT (code) DO NOTHING;
    `);
  }
}
