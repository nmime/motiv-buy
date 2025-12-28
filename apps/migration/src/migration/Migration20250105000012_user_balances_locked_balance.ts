import { Migration } from '@mikro-orm/migrations';

/**
 * Add locked_balance column to user_balances table
 */
export class Migration20250105000012UserBalancesLockedBalance extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE user_balances
        ADD COLUMN IF NOT EXISTS locked_balance decimal(20,8) NOT NULL DEFAULT '0.00000000';
    `);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE user_balances
        DROP COLUMN IF EXISTS locked_balance;
    `);

    await Promise.resolve();
  }
}
