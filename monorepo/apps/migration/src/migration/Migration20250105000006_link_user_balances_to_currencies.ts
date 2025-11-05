import { Migration } from '@mikro-orm/migrations';

/**
 * Link User Balances to Currencies - Schema Migration
 *
 * This is a schema-only migration that establishes relationships between
 * user_balances and currencies tables through foreign key constraints.
 *
 * Steps:
 * 1. Populates currency_id in user_balances for existing records
 * 2. Makes currency_id NOT NULL
 * 3. Adds foreign key constraint
 * 4. Updates unique constraint to use currency_id instead of currency
 *
 * Prerequisites:
 * - currencies table must exist (Migration 04)
 * - currencies must be seeded (Migration 05)
 */
export class Migration20250105000006LinkUserBalancesToCurrencies extends Migration {
  async up(): Promise<void> {
    // 1. Populate currency_id for existing user_balances records
    // Map old currency varchar field to new currency_id foreign key
    this.addSql(`
      UPDATE user_balances
      SET currency_id = (
        SELECT id FROM currencies
        WHERE UPPER(currencies.code) = UPPER(user_balances.currency)
      )
      WHERE currency_id IS NULL;
    `);

    // 2. Make currency_id NOT NULL after populating it
    this.addSql(`
      ALTER TABLE user_balances
        ALTER COLUMN currency_id SET NOT NULL;
    `);

    // 3. Add foreign key constraint
    this.addSql(`
      ALTER TABLE user_balances
        ADD CONSTRAINT fk__user_balances__currency
        FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT;
    `);

    // 4. Update unique constraint to use currency_id instead of currency
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

    // Ensure async compliance
    await Promise.resolve();
  }
}
