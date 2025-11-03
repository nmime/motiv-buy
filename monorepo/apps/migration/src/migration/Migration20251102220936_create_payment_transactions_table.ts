import { Migration } from '@mikro-orm/migrations';

/**
 * Payment Transactions Migration
 *
 * Creates the payment_transactions table for tracking cryptocurrency payments
 * through various payment providers (CryptoBot, etc.)
 *
 * Features:
 * - Support for multiple cryptocurrencies (USDT, TON, BTC, ETH, LTC, BNB, TRX, USDC, JET)
 * - Transaction types: TOP_UP and WITHDRAW
 * - Payment providers: CRYPTO_BOT (extensible for future providers)
 * - Transaction status tracking with comprehensive states
 * - Automatic timestamp management with triggers
 * - Optimized indexes for common query patterns
 */
export class Migration20251102220936CreatePaymentTransactionsTable extends Migration {
  async up(): Promise<void> {
    // 1. Create ENUM types for type-safe constraints
    this.addSql(`
      CREATE TYPE payment_transaction_type AS ENUM ('TOP_UP', 'WITHDRAW');
    `);

    this.addSql(`
      CREATE TYPE payment_provider AS ENUM ('CRYPTO_BOT');
    `);

    this.addSql(`
      CREATE TYPE payment_currency AS ENUM (
        'USDT',
        'TON',
        'BTC',
        'ETH',
        'LTC',
        'BNB',
        'TRX',
        'USDC',
        'JET'
      );
    `);

    this.addSql(`
      CREATE TYPE payment_transaction_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'EXPIRED'
      );
    `);

    // 2. Create payment_transactions table
    this.addSql(`
      CREATE TABLE payment_transactions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id varchar(255) NOT NULL,
        type payment_transaction_type NOT NULL,
        provider payment_provider NOT NULL,
        provider_transaction_id varchar(255),
        amount decimal(20,8) NOT NULL,
        currency payment_currency NOT NULL,
        status payment_transaction_status NOT NULL,
        pay_url text,
        description text,
        fee decimal(20,8),
        metadata jsonb DEFAULT '{}'::jsonb,
        paid_at timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 3. Add check constraints for data integrity
    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__amount_positive
        CHECK (amount > 0);
    `);

    this.addSql(`
      ALTER TABLE payment_transactions
        ADD CONSTRAINT chk__payment_transactions__fee_non_negative
        CHECK (fee IS NULL OR fee >= 0);
    `);

    // 4. Create indexes for query optimization
    // Primary lookup by user_id
    this.addSql(`
      CREATE INDEX idx__payment_transactions__user_id
        ON payment_transactions (user_id);
    `);

    // Filter by status
    this.addSql(`
      CREATE INDEX idx__payment_transactions__status
        ON payment_transactions (status);
    `);

    // Unique constraint and index for provider transaction ID
    this.addSql(`
      CREATE UNIQUE INDEX idx__payment_transactions__provider_transaction_id
        ON payment_transactions (provider_transaction_id)
        WHERE provider_transaction_id IS NOT NULL;
    `);

    // Sort by creation date (most recent first)
    this.addSql(`
      CREATE INDEX idx__payment_transactions__created_at
        ON payment_transactions (created_at DESC);
    `);

    // Composite index for user's transactions filtered by status
    this.addSql(`
      CREATE INDEX idx__payment_transactions__user_status
        ON payment_transactions (user_id, status);
    `);

    // 5. Add updated_at trigger (using existing function from startup migration)
    this.addSql(`
      CREATE TRIGGER update_payment_transactions_updated_at
        BEFORE UPDATE ON payment_transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Ensure async compliance
    await Promise.resolve();
  }

  async down(): Promise<void> {
    // 1. Drop trigger first
    this.addSql(`
      DROP TRIGGER IF EXISTS update_payment_transactions_updated_at
        ON payment_transactions;
    `);

    // 2. Drop table (CASCADE will drop associated indexes)
    this.addSql(`
      DROP TABLE IF EXISTS payment_transactions CASCADE;
    `);

    // 3. Drop ENUM types
    this.addSql('DROP TYPE IF EXISTS payment_transaction_status CASCADE;');
    this.addSql('DROP TYPE IF EXISTS payment_currency CASCADE;');
    this.addSql('DROP TYPE IF EXISTS payment_provider CASCADE;');
    this.addSql('DROP TYPE IF EXISTS payment_transaction_type CASCADE;');

    // Ensure async compliance
    await Promise.resolve();
  }
}
