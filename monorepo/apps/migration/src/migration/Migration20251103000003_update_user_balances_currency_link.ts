import { Migration } from '@mikro-orm/migrations';

export class Migration20251103000003_update_user_balances_currency_link extends Migration {
  async up(): Promise<void> {
    // Add new currency_id column
    this.addSql(`
      ALTER TABLE "user_balances"
      ADD COLUMN "currency_id" uuid;
    `);

    // Get Rub currency ID and set it for all existing balances
    this.addSql(`
      UPDATE "user_balances"
      SET "currency_id" = (SELECT "id" FROM "currencies" WHERE "code" = 'Rub')
      WHERE "currency" = 'RUB';
    `);

    // Make currency_id NOT NULL after data migration
    this.addSql(`
      ALTER TABLE "user_balances"
      ALTER COLUMN "currency_id" SET NOT NULL;
    `);

    // Add foreign key constraint
    this.addSql(`
      ALTER TABLE "user_balances"
      ADD CONSTRAINT "fk__user_balances__currency"
      FOREIGN KEY ("currency_id") REFERENCES "currencies" ("id")
      ON DELETE RESTRICT;
    `);

    // Drop old currency column index and constraint
    this.addSql(`
      DROP INDEX IF EXISTS "ix__user_balances__currency";
    `);

    // Create new index for currency_id
    this.addSql(`
      CREATE INDEX "ix__user_balances__currency_id" ON "user_balances" ("currency_id");
    `);

    // Update unique constraint to use currency_id instead of currency
    this.addSql(`
      ALTER TABLE "user_balances" DROP CONSTRAINT IF EXISTS "uq__user_balances__user_currency";
    `);

    this.addSql(`
      ALTER TABLE "user_balances"
      ADD CONSTRAINT "uq__user_balances__user_currency_id"
      UNIQUE ("user_id", "currency_id");
    `);

    // Keep old currency column for now (for backwards compatibility)
    // It will be removed in a future migration after full transition
    this.addSql(`
      COMMENT ON COLUMN "user_balances"."currency" IS
      'DEPRECATED: Use currency_id instead. Kept for backwards compatibility.';
    `);
  }

  async down(): Promise<void> {
    // Restore old structure
    this.addSql(`
      ALTER TABLE "user_balances" DROP CONSTRAINT IF EXISTS "uq__user_balances__user_currency_id";
    `);

    this.addSql(`
      ALTER TABLE "user_balances" DROP CONSTRAINT IF EXISTS "fk__user_balances__currency";
    `);

    this.addSql(`
      DROP INDEX IF EXISTS "ix__user_balances__currency_id";
    `);

    this.addSql(`
      ALTER TABLE "user_balances" DROP COLUMN IF EXISTS "currency_id";
    `);

    this.addSql(`
      CREATE INDEX "ix__user_balances__currency" ON "user_balances" ("currency");
    `);

    this.addSql(`
      ALTER TABLE "user_balances"
      ADD CONSTRAINT "uq__user_balances__user_currency"
      UNIQUE ("user_id", "currency");
    `);
  }
}
