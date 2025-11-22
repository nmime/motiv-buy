import { Migration } from '@mikro-orm/migrations';

/**
 * Balance System Migration
 *
 * Creates user balance management tables with all constraints and indexes:
 * - user_balances: Current balance per currency (will link to currencies table later)
 * - user_balance_history: Transaction history and audit log
 *
 * Note: This migration creates balances with currency varchar field.
 * A later migration will add currency_id foreign key after currencies table is created.
 */
export class Migration20250105000002BalanceSystem extends Migration {
  async up(): Promise<void> {
    // 1. Create user_balances table with foreign key and unique constraint
    this.addSql(`
      CREATE TABLE user_balances (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL,
        balance decimal(20,8) NOT NULL DEFAULT 0,
        reserved decimal(20,8) NOT NULL DEFAULT 0,
        currency varchar(10) NOT NULL DEFAULT 'RUB',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_balances__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq__user_balances__user_currency UNIQUE (user_id, currency)
      );
    `);

    this.addSql('CREATE INDEX ix__user_balances__user_id ON user_balances (user_id);');
    this.addSql('CREATE INDEX ix__user_balances__currency ON user_balances (currency);');

    this.addSql(`
      CREATE TRIGGER update_user_balances_updated_at
        BEFORE UPDATE ON user_balances
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 2. Create user_balance_history table with foreign key
    this.addSql(`
      CREATE TABLE user_balance_history (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL,
        amount decimal(20,8) NOT NULL,
        previous_balance decimal(20,8) NOT NULL,
        new_balance decimal(20,8) NOT NULL,
        transaction_type varchar(20) NOT NULL,
        description text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__user_balance_history__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    this.addSql('CREATE INDEX ix__user_balance_history__user_id ON user_balance_history (user_id);');
    this.addSql('CREATE INDEX ix__user_balance_history__transaction_type ON user_balance_history (transaction_type);');
    this.addSql('CREATE INDEX ix__user_balance_history__created_at ON user_balance_history (created_at);');

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop tables (CASCADE will drop constraints and triggers)
    this.addSql('DROP TABLE IF EXISTS user_balance_history CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_balances CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}
