import { Migration } from '@mikro-orm/migrations';

/**
 * Create Traffic Order Balances Table
 *
 * Creates traffic_order_balances table for locked funds management:
 * - Holds locked funds for traffic orders (guaranteed payment pattern)
 * - Tracks spent, available, and refunded amounts
 * - Prevents orders from running out of funds mid-execution
 * - Ensures atomic balance updates with pessimistic locking
 *
 * Balance Invariant: lockedAmount = spentAmount + availableAmount + refundedAmount
 */
export class Migration20250106000002CreateTrafficOrderBalances extends Migration {
  async up(): Promise<void> {
    // Create traffic_order_balances table
    this.addSql(`
      CREATE TABLE traffic_order_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid_v7(),
        traffic_order_id uuid NOT NULL UNIQUE,
        currency_id uuid NOT NULL,
        locked_amount decimal(20,8) NOT NULL,
        spent_amount decimal(20,8) NOT NULL DEFAULT '0',
        available_amount decimal(20,8) NOT NULL,
        refunded_amount decimal(20,8) NOT NULL DEFAULT '0',
        is_settled boolean NOT NULL DEFAULT false,
        settled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk__traffic_order_balances__traffic_order_id
          FOREIGN KEY (traffic_order_id)
          REFERENCES traffic_orders(id)
          ON DELETE CASCADE,
        CONSTRAINT fk__traffic_order_balances__currency_id
          FOREIGN KEY (currency_id)
          REFERENCES currencies(id)
          ON DELETE RESTRICT,
        CONSTRAINT chk__traffic_order_balances__positive_amounts
          CHECK (
            locked_amount >= 0 AND
            spent_amount >= 0 AND
            available_amount >= 0 AND
            refunded_amount >= 0
          ),
        CONSTRAINT chk__traffic_order_balances__balance_invariant
          CHECK (
            locked_amount = spent_amount + available_amount + refunded_amount
          )
      );
    `);

    // Create indexes for fast lookups
    this.addSql(`
      CREATE INDEX ix__traffic_order_balances__traffic_order_id
      ON traffic_order_balances (traffic_order_id);
    `);

    this.addSql(`
      CREATE INDEX ix__traffic_order_balances__currency_id
      ON traffic_order_balances (currency_id);
    `);

    this.addSql(`
      CREATE INDEX ix__traffic_order_balances__is_settled
      ON traffic_order_balances (is_settled);
    `);

    // Add helpful comments
    this.addSql(`
      COMMENT ON TABLE traffic_order_balances IS
      'Locked funds for traffic orders. Ensures guaranteed payment and prevents race conditions.';
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_order_balances.locked_amount IS
      'Total budget locked for order. Transferred from buyer UserBalance on order creation.';
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_order_balances.spent_amount IS
      'Amount paid to sellers for completed tasks. Increases as tasks complete.';
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_order_balances.available_amount IS
      'Remaining funds available for tasks. Decreases as tasks complete.';
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_order_balances.refunded_amount IS
      'Amount refunded to buyer on order cancellation or completion with remaining funds.';
    `);

    this.addSql(`
      COMMENT ON COLUMN traffic_order_balances.is_settled IS
      'Whether balance is fully settled (all funds distributed or refunded).';
    `);

    this.addSql(`
      COMMENT ON CONSTRAINT chk__traffic_order_balances__balance_invariant
      ON traffic_order_balances IS
      'Ensures balance integrity: locked = spent + available + refunded';
    `);
  }

  async down(): Promise<void> {
    // Drop indexes
    this.addSql('DROP INDEX IF EXISTS ix__traffic_order_balances__is_settled;');
    this.addSql('DROP INDEX IF EXISTS ix__traffic_order_balances__currency_id;');
    this.addSql('DROP INDEX IF EXISTS ix__traffic_order_balances__traffic_order_id;');

    // Drop table
    this.addSql('DROP TABLE IF EXISTS traffic_order_balances CASCADE;');
  }
}
