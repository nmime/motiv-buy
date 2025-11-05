import { Migration } from '@mikro-orm/migrations';

/**
 * Balance System Migration
 *
 * Creates user balance management tables:
 * - user_balances: Current balance per currency (will link to currencies table later)
 * - user_balance_history: Transaction history and audit log
 *
 * Note: This migration creates balances with currency varchar field.
 * A later migration will add currency_id foreign key after currencies table is created.
 */
export class Migration20250105000002BalanceSystem extends Migration {
  async up(): Promise<void> {
    // 1. Create user_balances table
    this.addSql(`
      CREATE TABLE user_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        balance decimal(20,8) NOT NULL DEFAULT 0,
        reserved decimal(20,8) NOT NULL DEFAULT 0,
        currency varchar(10) NOT NULL DEFAULT 'RUB',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_balances__user_id ON user_balances (user_id);');
    this.addSql('CREATE INDEX ix__user_balances__currency ON user_balances (currency);');
    this.addSql(`
      CREATE UNIQUE INDEX uq__user_balances__user_currency
        ON user_balances (user_id, currency);
    `);

    // 2. Create user_balance_history table
    this.addSql(`
      CREATE TABLE user_balance_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        user_id uuid NOT NULL,
        amount decimal(20,8) NOT NULL,
        previous_balance decimal(20,8) NOT NULL,
        new_balance decimal(20,8) NOT NULL,
        transaction_type varchar(20) NOT NULL,
        description text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.addSql('CREATE INDEX ix__user_balance_history__user_id ON user_balance_history (user_id);');
    this.addSql('CREATE INDEX ix__user_balance_history__transaction_type ON user_balance_history (transaction_type);');
    this.addSql('CREATE INDEX ix__user_balance_history__created_at ON user_balance_history (created_at);');

    // 3. Add foreign key constraints
    this.addSql(`
      ALTER TABLE user_balances
        ADD CONSTRAINT fk__user_balances__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    this.addSql(`
      ALTER TABLE user_balance_history
        ADD CONSTRAINT fk__user_balance_history__user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    // 4. Add update trigger for user_balances
    this.addSql(`
      CREATE TRIGGER update_user_balances_updated_at
        BEFORE UPDATE ON user_balances
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // 5. Add comments
    this.addSql(`
      COMMENT ON TABLE user_balances IS
      'User balance accounts per currency with reserved amounts for pending transactions';
    `);

    this.addSql(`
      COMMENT ON TABLE user_balance_history IS
      'Complete audit log of all balance changes with before/after snapshots';
    `);

    this.addSql(`
      COMMENT ON COLUMN user_balances.reserved IS
      'Amount reserved for pending transactions (e.g., pending withdrawals)';
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Drop trigger
    this.addSql('DROP TRIGGER IF EXISTS update_user_balances_updated_at ON user_balances;');

    // Drop tables in reverse order (due to foreign key constraints)
    this.addSql('DROP TABLE IF EXISTS user_balance_history CASCADE;');
    this.addSql('DROP TABLE IF EXISTS user_balances CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}
